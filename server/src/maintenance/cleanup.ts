import { config } from '../config.js';
import { createDb } from '../db/client.js';
import { createPhotoStorage } from '../storage/photos.js';
import { CleanupService } from './cleanupService.js';
import { PALIERS } from './retention.js';

/**
 * Commande de ménage : `npm run cleanup` (aperçu) ou `npm run cleanup -- --appliquer`.
 *
 * L'aperçu est le défaut. Une commande qui efface des publications ne doit pas
 * être ce qui arrive quand on la lance pour voir ce qu'elle fait.
 */
const appliquer = process.argv.includes('--appliquer') || process.argv.includes('--apply');

const db = createDb(config.databaseUrl);
const service = new CleanupService(db, createPhotoStorage());

try {
  const rapport = await service.run({ aperçu: !appliquer });

  console.info(
    `[cleanup] ${rapport.examinées} publication(s) en base ; ` +
      `${rapport.ids.length} au-delà de leur durée de vie`
  );
  console.info(
    '[cleanup] paliers : ' +
      PALIERS.map((p) => `${p.interactionsMin}+ interaction(s) → ${p.jours} j`).join(', ')
  );

  if (!appliquer) {
    console.info('[cleanup] APERÇU — rien n’a été supprimé. Relancez avec --appliquer.');
  } else {
    console.info(
      `[cleanup] supprimées : ${rapport.supprimées} ; ` +
        `photos retirées du stockage : ${rapport.photosRetirées} ; ` +
        `photos gardées faute de stockage joignable : ${rapport.photosEnÉchec}`
    );
  }
} catch (error) {
  console.error('[cleanup] échec :', (error as Error).message);
  process.exitCode = 1;
} finally {
  await db.close();
}
