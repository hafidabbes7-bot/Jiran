import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

import { CommunityService } from '../content/community.js';
import { MediaService } from '../content/media.js';
import { NotificationService } from '../content/notifications.js';
import { ContentRepository, type Member } from '../content/repository.js';
import type { Db } from '../db/client.js';
import { openTestDb } from '../db/testDb.js';
import type { PhotoStorage } from '../storage/photos.js';
import { CleanupService } from './cleanupService.js';
import { expirée, joursDeConservation } from './retention.js';

/** Stockage de photos en mémoire, pour vérifier ce qui est réellement retiré. */
class StockageEspion implements PhotoStorage {
  readonly name = 'espion';
  readonly fichiers = new Map<string, Uint8Array>();
  échoue = false;

  async upload(path: string, _mime: string, bytes: Uint8Array) {
    this.fichiers.set(path, bytes);
    return { url: `https://exemple.test/${path}`, path };
  }

  async remove(path: string) {
    if (this.échoue) throw new Error('stockage injoignable');
    this.fichiers.delete(path);
  }
}

const jours = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

describe('durée de vie des publications', () => {
  it('garde plus longtemps ce que le quartier a lu', () => {
    assert.equal(joursDeConservation(0), 10);
    assert.equal(joursDeConservation(1), 20);
    assert.equal(joursDeConservation(4), 20);
    assert.equal(joursDeConservation(5), 30);
    assert.equal(joursDeConservation(19), 30);
    assert.equal(joursDeConservation(20), 45);
    assert.equal(joursDeConservation(500), 45);
  });

  it('compte à partir de la publication, pas de la dernière interaction', () => {
    const créée = new Date('2026-01-01T00:00:00Z');
    assert.equal(expirée(créée, 0, new Date('2026-01-10T23:00:00Z')), false);
    assert.equal(expirée(créée, 0, new Date('2026-01-11T00:00:00Z')), true);
    assert.equal(expirée(créée, 30, new Date('2026-02-14T00:00:00Z')), false);
    assert.equal(expirée(créée, 30, new Date('2026-02-15T00:00:00Z')), true);
  });
});

describe('ménage quotidien', () => {
  let db: Db;
  let content: ContentRepository;
  let media: MediaService;
  let stockage: StockageEspion;
  let cleanup: CleanupService;
  let hafid: Member;
  let salim: Member;

  beforeEach(async () => {
    db = await openTestDb();
    stockage = new StockageEspion();
    content = new ContentRepository(db);
    media = new MediaService(db, stockage);
    cleanup = new CleanupService(db, stockage);
    hafid = await content.saveMember({
      identifier: '0555000001',
      firstName: 'Hafid',
      neighborhoodId: 'bejaia-centre',
    });
    salim = await content.saveMember({
      identifier: '0555000002',
      firstName: 'Salim',
      neighborhoodId: 'bejaia-centre',
    });
  });

  it('ne supprime rien en aperçu, même sur une publication expirée', async () => {
    await content.createPost(hafid, { category: 'annonce', text: 'Table à donner' }, jours(30));

    const rapport = await cleanup.run();
    assert.equal(rapport.aperçu, true);
    assert.equal(rapport.ids.length, 1, 'elle est bien désignée');
    assert.equal(rapport.supprimées, 0, 'mais rien n’est touché');
    assert.equal((await content.feed(hafid)).length, 1);
  });

  it('supprime une publication sans interaction après dix jours', async () => {
    await content.createPost(hafid, { category: 'annonce', text: 'Vieille annonce' }, jours(11));
    const récente = await content.createPost(
      hafid,
      { category: 'annonce', text: 'Annonce d’hier' },
      jours(9)
    );

    const rapport = await cleanup.run({ aperçu: false });
    assert.equal(rapport.supprimées, 1);

    const fil = await content.feed(hafid);
    assert.equal(fil.length, 1);
    assert.equal(fil[0]!.id, récente);
  });

  it('garde vingt jours une publication qu’un voisin a aimée', async () => {
    const id = await content.createPost(
      hafid,
      { category: 'entraide', text: 'Perceuse à prêter' },
      jours(15)
    );
    await content.setLiked(id, salim, true);

    assert.equal((await cleanup.run({ aperçu: false })).supprimées, 0);
    assert.equal((await content.feed(hafid)).length, 1);
  });

  it('emporte j’aime, réponses et signalements de la publication supprimée', async () => {
    const id = await content.createPost(hafid, { category: 'annonce', text: 'À jeter' }, jours(25));
    await content.setLiked(id, salim, true);
    await content.addComment(id, salim, 'Je prends', jours(25));
    await content.addReport(id, salim, 'spam', jours(25));

    // 2 interactions → 20 jours ; publiée il y a 25 jours, elle part.
    assert.equal((await cleanup.run({ aperçu: false })).supprimées, 1);

    const restes = await Promise.all([
      db.query('SELECT 1 FROM likes WHERE post_id = $1', [id]),
      db.query('SELECT 1 FROM comments WHERE post_id = $1', [id]),
      db.query('SELECT 1 FROM reports WHERE post_id = $1', [id]),
    ]);
    for (const reste of restes) assert.deepEqual(reste, [], 'aucun orphelin');
  });

  it('retire aussi la photo du stockage, et sa ligne en base', async () => {
    const photo = await media.savePhoto(hafid, 'image/jpeg', new Uint8Array(64).fill(3));
    assert.notEqual(typeof photo, 'string');
    if (typeof photo === 'string') return;

    assert.equal(stockage.fichiers.size, 1, 'la photo est bien partie au stockage');

    await content.createPost(
      hafid,
      { category: 'annonce', text: 'Avec photo', photoId: photo.id },
      jours(12)
    );

    const rapport = await cleanup.run({ aperçu: false });
    assert.equal(rapport.supprimées, 1);
    assert.equal(rapport.photosRetirées, 1);
    assert.equal(stockage.fichiers.size, 0, 'le fichier n’est plus dans le stockage');
    assert.deepEqual(await db.query('SELECT 1 FROM photos WHERE id = $1', [photo.id]), []);
  });

  it('garde la publication si le stockage refuse de rendre la photo', async () => {
    const photo = await media.savePhoto(hafid, 'image/jpeg', new Uint8Array(64).fill(3));
    if (typeof photo === 'string') return;

    await content.createPost(
      hafid,
      { category: 'annonce', text: 'Avec photo', photoId: photo.id },
      jours(12)
    );
    stockage.échoue = true;

    const rapport = await cleanup.run({ aperçu: false });
    assert.equal(rapport.supprimées, 0, 'mieux vaut une ligne de trop qu’un fichier orphelin');
    assert.equal(rapport.photosEnÉchec, 1);
    assert.equal((await content.feed(hafid)).length, 1);
  });

  it('ne touche ni aux comptes, ni aux conversations, ni aux notifications', async () => {
    const community = new CommunityService(db);
    const notifications = new NotificationService(db);

    await community.sendMessage(hafid, salim.id, 'Salam, tu as une clé de 13 ?');
    await notifications.notify([salim.id], 'message', 'Hafid t’a écrit', 'Salam');
    await content.createPost(hafid, { category: 'annonce', text: 'Vieille' }, jours(40));

    assert.equal((await cleanup.run({ aperçu: false })).supprimées, 1);

    assert.equal(
      (await content.findMemberByIdentifier('0555000001'))?.firstName,
      'Hafid',
      'les comptes restent'
    );
    const conversations = await community.conversations(salim);
    assert.equal(conversations.length, 1, 'la conversation reste');
    const messages = await community.messages(salim, hafid.id);
    assert.equal(Array.isArray(messages) && messages.length, 1, 'le message reste');
    assert.equal((await notifications.list(salim)).length, 1, 'la notification reste');
  });
});
