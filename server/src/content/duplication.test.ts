import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BANNED_WORDS, ALLOWED_WORDS } from './bannedWords.js';
import { NEIGHBORHOODS, TWINNING_THRESHOLD } from './neighborhoods.js';
import { moderateText } from './textModeration.js';

/**
 * Trois fichiers existent en double, côté serveur et côté application :
 * le découpage des quartiers, la liste de mots interdits et le filtre de texte.
 *
 * Ce n'est pas de la négligence — l'application en a besoin hors ligne (choisir
 * son quartier, vérifier sa position, prévenir pendant la frappe) et le serveur
 * en a besoin comme autorité. Mais une copie qui dérive se paierait cher : un
 * quartier que le serveur ne connaît pas, ou un texte refusé après coup alors
 * que l'application l'avait accepté.
 *
 * Ces tests comparent les deux copies. Ils échouent à la première divergence.
 */
describe('copies partagées avec l’application', () => {
  it('décrit les mêmes quartiers', async () => {
    const mobile = await import('../../../mobile/src/data/neighborhoods.js');

    assert.equal(mobile.TWINNING_THRESHOLD, TWINNING_THRESHOLD);
    assert.deepEqual(
      mobile.NEIGHBORHOODS.map((n) => ({ ...n })),
      NEIGHBORHOODS.map((n) => ({ ...n })),
      'mobile/src/data/neighborhoods.ts et server/src/content/neighborhoods.ts ont divergé'
    );
  });

  it('interdit et autorise les mêmes mots', async () => {
    const mobile = await import('../../../mobile/src/domain/moderation/bannedWords.js');

    assert.deepEqual([...mobile.BANNED_WORDS], [...BANNED_WORDS]);
    assert.deepEqual([...mobile.ALLOWED_WORDS], [...ALLOWED_WORDS]);
  });

  it('rend le même verdict sur les mêmes textes', async () => {
    const mobile = await import('../../../mobile/src/domain/moderation/textModeration.js');

    const echantillons = [
      'Quelqu’un aurait une perceuse à me prêter ce week-end ?',
      'On organise un concert samedi',
      'Demande conseil au concierge',
      'espèce de connard',
      'c0nnard',
      'c.o.n.n.a.r.d',
      'c o n n a r d',
      'bande de connards',
      'يا قحبة',
      'salut à tous les voisins du bâtiment',
      '',
    ];

    for (const texte of echantillons) {
      assert.equal(
        mobile.moderateText(texte).clean,
        moderateText(texte).clean,
        `verdict différent pour « ${texte} »`
      );
    }
  });
});
