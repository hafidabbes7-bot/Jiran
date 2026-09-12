import pg from 'pg';

/**
 * Accès à PostgreSQL.
 *
 * Une interface étroite plutôt que le client `pg` partout : le reste du code
 * ne connaît que `query`, `one` et `tx`, ce qui laisse la possibilité de
 * changer de pilote sans rouvrir dix fichiers — et rend les tests lisibles.
 *
 * Toutes les requêtes sont paramétrées (`$1`, `$2`…). Aucune valeur ne doit
 * jamais être concaténée dans du SQL : c'est la seule protection qui tienne
 * contre l'injection.
 */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<T[]>;
  /** Première ligne, ou `undefined`. */
  one<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<T | undefined>;
  /** Plusieurs instructions d'un coup — réservé aux migrations. */
  exec(sql: string): Promise<void>;
  /** Tout ou rien : la fonction reçoit une vue transactionnelle de la base. */
  tx<T>(run: (db: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/**
 * Supabase et la plupart des hébergeurs imposent TLS, mais présentent un
 * certificat signé par une autorité que Node ne connaît pas. On chiffre donc
 * la liaison sans exiger la chaîne complète : c'est ce que fait n'importe quel
 * client Postgres avec `sslmode=require`, et c'est mieux que du clair.
 *
 * En local — `localhost` ou une adresse privée — pas de TLS du tout : il n'y a
 * rien à protéger entre deux processus de la même machine.
 */
export function sslFor(url: string): pg.ConnectionConfig['ssl'] {
  const hôte = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  })();

  const local =
    hôte === 'localhost' ||
    hôte === '127.0.0.1' ||
    hôte === '::1' ||
    hôte === '' ||
    hôte.startsWith('192.168.') ||
    hôte.startsWith('10.');

  if (local) return false;
  if (url.includes('sslmode=disable')) return false;
  return { rejectUnauthorized: false };
}

class PoolDb implements Db {
  constructor(private readonly pool: pg.Pool) {}

  async query<T>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
    const result = await this.pool.query(sql, params as unknown[]);
    return result.rows as T[];
  }

  async one<T>(sql: string, params: readonly unknown[] = []): Promise<T | undefined> {
    const rows = await this.query<T>(sql, params);
    return rows[0];
  }

  async exec(sql: string): Promise<void> {
    await this.pool.query(sql);
  }

  async tx<T>(run: (db: Db) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const résultat = await run(new ClientDb(client));
      await client.query('COMMIT');
      return résultat;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

/** Vue transactionnelle : une seule connexion, pas de transaction imbriquée. */
class ClientDb implements Db {
  constructor(private readonly client: pg.PoolClient) {}

  async query<T>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
    const result = await this.client.query(sql, params as unknown[]);
    return result.rows as T[];
  }

  async one<T>(sql: string, params: readonly unknown[] = []): Promise<T | undefined> {
    return (await this.query<T>(sql, params))[0];
  }

  async exec(sql: string): Promise<void> {
    await this.client.query(sql);
  }

  async tx<T>(run: (db: Db) => Promise<T>): Promise<T> {
    return run(this);
  }

  async close(): Promise<void> {
    // La connexion appartient à la transaction, pas à l'appelant.
  }
}

export function createDb(
  url: string,
  maxConnections = 8,
  /** Tests : laisse le processus se terminer sans attendre les connexions inactives. */
  allowExitOnIdle = false
): Db {
  if (!url) {
    throw new Error(
      'DATABASE_URL manquant. Jiran ne garde plus rien en mémoire ni sur le disque : ' +
        'il lui faut une base PostgreSQL (voir docs/base-de-donnees.md).'
    );
  }

  // Supabase en mode « pooler » n'accepte pas les requêtes préparées nommées ;
  // le client `pg` n'en crée pas par défaut, on reste donc compatible.
  const pool = new pg.Pool({
    connectionString: url,
    ssl: sslFor(url),
    max: maxConnections,
    // Un hébergement gratuit coupe les connexions inactives : mieux vaut les
    // recycler nous-mêmes que découvrir la coupure au milieu d'une requête.
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle,
  });

  pool.on('error', (error) => {
    console.error('[db] connexion inactive perdue', error.message);
  });

  return new PoolDb(pool);
}
