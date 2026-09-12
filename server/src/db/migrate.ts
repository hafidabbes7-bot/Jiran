import { config } from '../config.js';
import { avertissementsAdresse, createDb } from './client.js';
import { migrate } from './migrations.js';

/**
 * Commande de migration : `npm run migrate`.
 *
 * Séparée du serveur à dessein. Sur Render, elle tourne à la construction,
 * avant que le service ne démarre — jamais à chaque réveil du processus.
 */

/**
 * Ce qui s'affiche quand la base n'est pas encore branchée.
 *
 * C'est le message que quelqu'un lira dans le journal de construction de son
 * hébergeur, souvent depuis un téléphone. Une trace d'exécution n'y apprend
 * rien : il faut la marche à suivre, en clair.
 */
const MANQUANT = `
  ┌──────────────────────────────────────────────────────────────┐
  │  DATABASE_URL n'est pas défini : les tables ne peuvent pas    │
  │  être posées, et le serveur ne démarrera pas.                 │
  └──────────────────────────────────────────────────────────────┘

  Jiran a besoin d'une base PostgreSQL. Elle est gratuite chez Supabase :

    1. supabase.com → New project (région Frankfurt)
    2. Project Settings → Database → Connection string → URI
    3. Render → votre service → Environment → Add Environment Variable
       clé : DATABASE_URL       valeur : l'URI copiée à l'étape 2
    4. Relancer le déploiement

  Cette adresse contient le mot de passe de la base : elle se colle dans
  Render, et nulle part dans le code.

  Marche complète : docs/base-de-donnees.md
`;

if (!config.databaseUrl) {
  console.error(MANQUANT);
  process.exit(1);
}

// Dit avant d'essayer ce qui échouera sûrement : un déploiement raté se paie
// en minutes d'attente, et le message d'erreur du réseau n'explique rien.
for (const avertissement of avertissementsAdresse(config.databaseUrl)) {
  console.error(`[migrate] ⚠️  ${avertissement}`);
}

const db = createDb(config.databaseUrl);

try {
  const appliquées = await migrate(db);
  if (appliquées.length === 0) console.info('[migrate] base déjà à jour');
  else console.info(`[migrate] appliquées : ${appliquées.join(', ')}`);
} catch (error) {
  console.error('[migrate] échec :', (error as Error).message);
  console.error(
    "[migrate] si l'adresse est bonne, vérifiez que le projet Supabase est réveillé " +
      '(un projet gratuit se met en pause après une semaine sans usage).'
  );
  process.exitCode = 1;
} finally {
  await db.close();
}
