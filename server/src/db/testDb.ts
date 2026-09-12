import { createDb, type Db } from './client.js';
import { migrate } from './migrations.js';

/**
 * Base de test : une vraie base PostgreSQL, jamais une imitation.
 *
 * Les tests tournaient sur SQLite en mémoire. C'était pratique, et trompeur :
 * les contraintes, les types et les messages d'erreur de PostgreSQL ne sont
 * pas les mêmes, et une suite verte ne prouvait plus grand-chose de ce qui
 * tourne en ligne. Les tests parlent donc au même moteur que la production.
 *
 * L'adresse vient de `TEST_DATABASE_URL`, et d'elle seule : `DATABASE_URL`
 * n'est jamais lue ici. Ce fichier vide des tables et supprime des schémas ; il
 * ne doit pas pouvoir se tromper de base parce qu'une variable de production
 * traînait dans l'environnement.
 */
const URL_TEST = process.env.TEST_DATABASE_URL ?? '';

export const baseDeTestDisponible = Boolean(URL_TEST);

/**
 * Un schéma par processus de test.
 *
 * `node --test` lance les fichiers en parallèle. Sans cloison, le `TRUNCATE`
 * d'un fichier effacerait les données qu'un autre vient d'écrire, et la suite
 * échouerait au hasard, une fois sur cinq. Chaque processus travaille donc
 * dans son propre schéma, invisible des autres.
 */
const SCHÉMA = `jiran_test_${process.pid}`;

function adresseDuSchéma(url: string): string {
  const adresse = new URL(url);
  adresse.searchParams.set('options', `-c search_path=${SCHÉMA}`);
  // Le nom d'application sert de présence : il dit aux autres processus que ce
  // schéma est en cours d'utilisation, et ne doit pas être ramassé.
  adresse.searchParams.set('application_name', SCHÉMA);
  return adresse.toString();
}

let db: Db | undefined;

/**
 * Ouvre la base de test — schéma créé et migré au premier appel — et la rend
 * vide.
 *
 * Le schéma n'est posé qu'une fois : entre deux tests, vider les tables suffit
 * et coûte bien moins cher que de reconstruire toute la structure.
 */
export async function openTestDb(): Promise<Db> {
  if (!URL_TEST) {
    throw new Error(
      'TEST_DATABASE_URL manquant : les tests ont besoin d’une vraie base PostgreSQL ' +
        '(voir docs/base-de-donnees.md).'
    );
  }

  if (!db) {
    db = createDb(adresseDuSchéma(URL_TEST), 4, true);
    // Se signaler avant toute chose : un autre processus qui ramasse les
    // schémas abandonnés doit voir celui-ci comme occupé.
    await db.query('SELECT 1');
    await db.exec(`CREATE SCHEMA IF NOT EXISTS ${SCHÉMA}`);
    await ramasserLesSchémasAbandonnés(db);
    await migrate(db);
  }

  await vider(db);
  return db;
}

/**
 * Supprime les schémas de test qu'aucun processus n'utilise plus.
 *
 * Node ne propose pas de « après toute la suite » commun aux fichiers de test :
 * chaque processus fait donc le ménage des exécutions précédentes en arrivant,
 * plutôt que de laisser un schéma derrière lui à chaque lancement.
 */
async function ramasserLesSchémasAbandonnés(base: Db): Promise<void> {
  const abandonnés = await base.query<{ nspname: string }>(
    `SELECT nspname FROM pg_namespace
     WHERE nspname LIKE 'jiran\\_test\\_%'
       AND nspname <> $1
       AND nspname NOT IN (SELECT application_name FROM pg_stat_activity)`,
    [SCHÉMA]
  );

  for (const schéma of abandonnés) {
    // Le nom vient du catalogue de PostgreSQL et correspond au motif ci-dessus ;
    // aucune valeur extérieure n'entre dans cette commande.
    await base.exec(`DROP SCHEMA IF EXISTS ${schéma.nspname} CASCADE`);
  }
}

/** Vide tout le contenu du schéma de test. Laisse `schema_migrations`. */
export async function vider(base: Db): Promise<void> {
  const tables = await base.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables
     WHERE schemaname = $1 AND tablename <> 'schema_migrations'`,
    [SCHÉMA]
  );

  if (tables.length === 0) return;

  const noms = tables.map((table) => `${SCHÉMA}."${table.tablename}"`).join(', ');
  // Remet les tables à zéro sans se soucier de l'ordre des clés étrangères.
  // Destructif par nature : d'où le schéma de test, qui ne contient que ça.
  await base.exec(`TRUNCATE ${noms} RESTART IDENTITY CASCADE`);
}
