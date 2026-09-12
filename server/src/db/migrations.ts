import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Db } from './client.js';

const DOSSIER = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

export interface Migration {
  name: string;
  sql: string;
  /** Empreinte du fichier : une migration déjà jouée ne doit plus changer. */
  checksum: string;
}

/** Migrations du dossier, dans l'ordre de leur nom (0001, 0002…). */
export function loadMigrations(dossier = DOSSIER): Migration[] {
  return readdirSync(dossier)
    .filter((nom) => nom.endsWith('.sql'))
    .sort()
    .map((nom) => {
      const sql = readFileSync(join(dossier, nom), 'utf8');
      return { name: nom, sql, checksum: createHash('sha256').update(sql).digest('hex') };
    });
}

/**
 * Applique les migrations qui manquent, et rien d'autre.
 *
 * Jamais appelé au démarrage du serveur : une base de production ne doit pas
 * changer de forme parce qu'un processus redémarre. C'est une commande
 * explicite (`npm run migrate`), lancée à la construction sur Render.
 *
 * Chaque migration est jouée dans sa propre transaction : une erreur laisse la
 * base dans l'état d'avant, pas à moitié migrée.
 */
export async function migrate(db: Db, migrations = loadMigrations()): Promise<string[]> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      checksum   TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const déjà = new Map(
    (await db.query<{ name: string; checksum: string }>(
      'SELECT name, checksum FROM schema_migrations'
    )).map((ligne) => [ligne.name, ligne.checksum])
  );

  const appliquées: string[] = [];
  for (const migration of migrations) {
    const connue = déjà.get(migration.name);
    if (connue) {
      // Une migration déjà jouée qui change de contenu est une erreur de
      // manipulation : on refuse plutôt que d'appliquer deux vérités.
      if (connue !== migration.checksum) {
        throw new Error(
          `La migration ${migration.name} a déjà été appliquée avec un autre contenu. ` +
            'Créez une nouvelle migration au lieu de modifier celle-ci.'
        );
      }
      continue;
    }

    await db.tx(async (tx) => {
      await tx.exec(migration.sql);
      await tx.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [
        migration.name,
        migration.checksum,
      ]);
    });
    appliquées.push(migration.name);
  }

  return appliquées;
}
