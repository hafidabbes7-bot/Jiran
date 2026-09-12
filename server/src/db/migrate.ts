import { config } from '../config.js';
import { createDb } from './client.js';
import { migrate } from './migrations.js';

/**
 * Commande de migration : `npm run migrate`.
 *
 * Séparée du serveur à dessein. Sur Render, elle tourne à la construction,
 * avant que le service ne démarre — jamais à chaque réveil du processus.
 */
const db = createDb(config.databaseUrl);

try {
  const appliquées = await migrate(db);
  if (appliquées.length === 0) console.info('[migrate] base déjà à jour');
  else console.info(`[migrate] appliquées : ${appliquées.join(', ')}`);
} catch (error) {
  console.error('[migrate] échec :', (error as Error).message);
  process.exitCode = 1;
} finally {
  await db.close();
}
