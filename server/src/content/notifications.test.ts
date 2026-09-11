import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

import { openDatabase } from './db.js';
import { NotificationService } from './notifications.js';
import { ContentRepository } from './repository.js';

describe('journal des notifications', () => {
  let service: NotificationService;
  let hafid: ReturnType<ContentRepository['saveMember']>;
  let salim: ReturnType<ContentRepository['saveMember']>;

  beforeEach(() => {
    const db = openDatabase(':memory:');
    const content = new ContentRepository(db);
    service = new NotificationService(db);
    hafid = content.saveMember({ phone: '0555000001', firstName: 'Hafid', neighborhoodId: 'bejaia-centre' });
    salim = content.saveMember({ phone: '0555000002', firstName: 'Salim', neighborhoodId: 'bejaia-centre' });
  });

  it('dépose la même notification chez plusieurs voisins', () => {
    service.notify([hafid.id, salim.id], 'securite', 'Alerte', 'Voiture forcée rue B', 'post-1');

    assert.equal(service.unread(hafid), 1);
    assert.equal(service.unread(salim), 1);
    assert.equal(service.list(hafid)[0]!.kind, 'securite');
    assert.equal(service.list(hafid)[0]!.ref, 'post-1');
    assert.equal(service.list(hafid)[0]!.read, false);
  });

  it('ne dépose qu’une fois par voisin, même si l’identifiant revient', () => {
    service.notify([hafid.id, hafid.id], 'annonce', 'Annonce', 'Table à donner');
    assert.equal(service.unread(hafid), 1);
  });

  it('marque une notification, puis toutes', () => {
    service.notify([hafid.id], 'reponse', 'Réponse', 'Salim a répondu');
    service.notify([hafid.id], 'message', 'Message', 'Salim t’a écrit');
    assert.equal(service.unread(hafid), 2);

    service.markRead(hafid, service.list(hafid)[0]!.id);
    assert.equal(service.unread(hafid), 1);

    service.markRead(hafid);
    assert.equal(service.unread(hafid), 0);
    assert.equal(service.list(hafid).every((n) => n.read), true);
  });

  it('ne montre pas les notifications d’un autre voisin', () => {
    service.notify([salim.id], 'message', 'Message', 'Pour Salim');
    assert.deepEqual(service.list(hafid), []);
    assert.equal(service.unread(hafid), 0);
  });

  it('oublie ce qui a plus d’une semaine', () => {
    service.notify([hafid.id], 'annonce', 'Vieille annonce', 'Déjà oubliée');
    const plusTard = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
    assert.deepEqual(service.list(hafid, plusTard), []);
  });
});
