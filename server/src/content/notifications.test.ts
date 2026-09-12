import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

import { openTestDb } from '../db/testDb.js';
import { NotificationService } from './notifications.js';
import { ContentRepository, type Member } from './repository.js';

describe('journal des notifications', () => {
  let service: NotificationService;
  let hafid: Member;
  let salim: Member;

  beforeEach(async () => {
    const db = await openTestDb();
    const content = new ContentRepository(db);
    service = new NotificationService(db);
    hafid = (await content.saveMember({ identifier: '0555000001', firstName: 'Hafid', neighborhoodId: 'bejaia-centre' }));
    salim = (await content.saveMember({ identifier: '0555000002', firstName: 'Salim', neighborhoodId: 'bejaia-centre' }));
  });

  it('dépose la même notification chez plusieurs voisins', async () => {
    await service.notify([hafid.id, salim.id], 'securite', 'Alerte', 'Voiture forcée rue B', 'post-1');

    assert.equal((await service.unread(hafid)), 1);
    assert.equal((await service.unread(salim)), 1);
    assert.equal((await service.list(hafid))[0]!.kind, 'securite');
    assert.equal((await service.list(hafid))[0]!.ref, 'post-1');
    assert.equal((await service.list(hafid))[0]!.read, false);
  });

  it('ne dépose qu’une fois par voisin, même si l’identifiant revient', async () => {
    await service.notify([hafid.id, hafid.id], 'annonce', 'Annonce', 'Table à donner');
    assert.equal((await service.unread(hafid)), 1);
  });

  it('marque une notification, puis toutes', async () => {
    await service.notify([hafid.id], 'reponse', 'Réponse', 'Salim a répondu');
    await service.notify([hafid.id], 'message', 'Message', 'Salim t’a écrit');
    assert.equal((await service.unread(hafid)), 2);

    await service.markRead(hafid, (await service.list(hafid))[0]!.id);
    assert.equal((await service.unread(hafid)), 1);

    await service.markRead(hafid);
    assert.equal((await service.unread(hafid)), 0);
    assert.equal((await service.list(hafid)).every((n) => n.read), true);
  });

  it('ne montre pas les notifications d’un autre voisin', async () => {
    await service.notify([salim.id], 'message', 'Message', 'Pour Salim');
    assert.deepEqual((await service.list(hafid)), []);
    assert.equal((await service.unread(hafid)), 0);
  });

  it('oublie ce qui a plus d’une semaine', async () => {
    await service.notify([hafid.id], 'annonce', 'Vieille annonce', 'Déjà oubliée');
    const plusTard = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
    assert.deepEqual((await service.list(hafid, plusTard)), []);
  });
});
