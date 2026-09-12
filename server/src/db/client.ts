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
/**
 * Ce qui, dans une adresse, va manifestement échouer une fois en ligne.
 *
 * Le cas qui coûte un déploiement raté : Supabase propose deux adresses, et
 * celle qui s'affiche en premier — `db.<projet>.supabase.co` — n'existe qu'en
 * IPv6. Render n'a pas d'IPv6 sortant. La connexion part, ne trouve rien, et
 * le journal se contente d'un « ENETUNREACH » que personne ne relie à ça.
 *
 * Mieux vaut le dire avant d'essayer que le laisser deviner.
 */
export function avertissementsAdresse(url: string): string[] {
  const avertissements: string[] = [];

  let hôte = '';
  try {
    hôte = new URL(url).hostname;
  } catch {
    return ["L'adresse ne ressemble pas à une URL PostgreSQL (postgresql://…)."];
  }

  if (/^db\..+\.supabase\.co$/.test(hôte)) {
    avertissements.push(
      "Cette adresse Supabase (« db." + hôte.split('.')[1] + ".supabase.co ») n'existe qu'en IPv6, " +
        "que Render ne sait pas joindre. Prenez plutôt l'adresse du « Session pooler », " +
        'de la forme aws-0-<région>.pooler.supabase.com — même page, onglet voisin.'
    );
  }

  if (url.includes('[VOTRE-MOT-DE-PASSE]') || url.includes('[YOUR-PASSWORD]')) {
    avertissements.push(
      "L'adresse contient encore le texte « [YOUR-PASSWORD] » : il faut le remplacer par le " +
        'mot de passe choisi à la création du projet.'
    );
  }

  return avertissements;
}

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

  // Un choix écrit dans l'adresse l'emporte sur toute déduction.
  if (url.includes('sslmode=disable')) return false;
  if (/sslmode=(require|verify-ca|verify-full|prefer)/.test(url)) {
    return { rejectUnauthorized: false };
  }

  if (local) return false;
  return { rejectUnauthorized: false };
}

/** Vrai si l'adresse impose elle-même le chiffrement ou l'écarte. */
export function sslChoisiExplicitement(url: string): boolean {
  return url.includes('sslmode=');
}

/**
 * Vrai si l'échec vient d'un serveur qui ne parle pas TLS.
 *
 * Le cas d'une base sur réseau privé — celle que Render crée à côté du
 * service, par exemple : rien ne sort de la machine, et le chiffrement n'y est
 * pas configuré.
 */
export function serveurSansTls(error: unknown): boolean {
  return /does not support SSL/i.test((error as Error)?.message ?? '');
}

/** Vrai si l'échec vient, à l'inverse, d'un serveur qui exige le chiffrement. */
export function serveurExigeTls(error: unknown): boolean {
  const message = (error as Error)?.message ?? '';
  return /SSL.*required|no encryption|SSL off/i.test(message);
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

/**
 * Ouvre la base en s'accommodant du chiffrement que le serveur veut bien.
 *
 * Il y a autant d'hébergeurs que de réglages TLS : Supabase l'impose avec un
 * certificat maison, une base sur réseau privé ne le propose pas du tout, et
 * l'erreur qui en résulte — « the server does not support SSL connections » —
 * n'apprend rien à qui n'a jamais eu à s'en occuper.
 *
 * Le premier essai suit la déduction de `sslFor`. S'il échoue *pour cette
 * raison précise*, on rouvre dans l'autre sens, une fois, et on le dit dans le
 * journal. Une adresse qui choisit elle-même (`sslmode=…`) est respectée
 * telle quelle : un chiffrement demandé ne doit jamais être abandonné en
 * silence.
 */
export async function connecter(url: string, maxConnections = 8): Promise<Db> {
  const db = createDb(url, maxConnections);

  try {
    await db.query('SELECT 1');
    return db;
  } catch (error) {
    const déduit = !sslChoisiExplicitement(url);
    const chiffréAuPremierEssai = sslFor(url) !== false;
    const inverser =
      déduit &&
      ((chiffréAuPremierEssai && serveurSansTls(error)) ||
        (!chiffréAuPremierEssai && serveurExigeTls(error)));

    if (!inverser) {
      await db.close().catch(() => undefined);
      throw error;
    }

    await db.close().catch(() => undefined);
    const sens = chiffréAuPremierEssai ? 'sans' : 'avec';
    console.info(`[db] ce serveur veut une liaison ${sens} TLS — nouvelle tentative`);

    const second = createDb(`${url}${url.includes('?') ? '&' : '?'}sslmode=${chiffréAuPremierEssai ? 'disable' : 'require'}`, maxConnections);
    await second.query('SELECT 1');
    return second;
  }
}
