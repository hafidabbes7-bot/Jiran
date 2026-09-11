import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

import { CommunityService } from './community.js';
import { openDatabase } from './db.js';
import { ContentRepository } from './repository.js';

describe('vie de quartier', () => {
  let community: CommunityService;
  let content: ContentRepository;
  let hafid: ReturnType<ContentRepository['saveMember']>;
  let salim: ReturnType<ContentRepository['saveMember']>;
  let karim: ReturnType<ContentRepository['saveMember']>;

  beforeEach(() => {
    const db = openDatabase(':memory:');
    content = new ContentRepository(db);
    community = new CommunityService(db);
    hafid = content.saveMember({ phone: '0555000001', firstName: 'Hafid', neighborhoodId: 'bejaia-centre' });
    salim = content.saveMember({ phone: '0555000002', firstName: 'Salim', neighborhoodId: 'bejaia-centre' });
    karim = content.saveMember({ phone: '0555000003', firstName: 'Karim', neighborhoodId: 'oran' });
  });

  describe('messagerie privée', () => {
    it('échange des messages entre voisins du même fil', () => {
      const envoyé = community.sendMessage(hafid, salim.id, 'Salam, tu as une perceuse ?');
      assert.notEqual(typeof envoyé, 'string');

      const vus = community.messages(salim, hafid.id);
      assert.notEqual(typeof vus, 'string');
      if (typeof vus === 'string') return;
      assert.equal(vus.length, 1);
      assert.equal(vus[0]!.fromMe, false);
    });

    it('refuse d’écrire à un voisin d’un autre quartier', () => {
      assert.equal(community.sendMessage(hafid, karim.id, 'Salam'), 'voisin_inconnu');
      assert.equal(community.messages(hafid, karim.id), 'voisin_inconnu');
    });

    it('applique le filtre des publications aux messages privés', () => {
      assert.equal(community.sendMessage(hafid, salim.id, 'espèce de connard'), 'texte_refuse');
    });

    it('compte les non-lus, puis les efface à la lecture', () => {
      community.sendMessage(hafid, salim.id, 'Premier');
      community.sendMessage(hafid, salim.id, 'Deuxième');

      const avant = community.conversations(salim);
      assert.equal(avant[0]!.unread, 2);
      assert.equal(avant[0]!.neighborName, 'Hafid');
      assert.equal(avant[0]!.lastMessage, 'Deuxième');

      community.messages(salim, hafid.id);
      assert.equal(community.conversations(salim)[0]!.unread, 0);
    });
  });

  describe('services recommandés', () => {
    it('compte une recommandation par voisin, pas une par clic', () => {
      const service = community.addService(hafid, { name: 'Amine', trade: 'Plombier' });
      assert.notEqual(typeof service, 'string');
      if (typeof service === 'string') return;
      assert.equal(service.recommendations, 1);

      community.recommend(salim, service.id, 4);
      community.recommend(salim, service.id, 5);
      const vu = community.services(hafid).find((s) => s.id === service.id)!;
      assert.equal(vu.recommendations, 2);
      assert.equal(vu.rating, 5);
    });

    it('ne montre pas l’annuaire d’un autre quartier', () => {
      community.addService(karim, { name: 'Yacine', trade: 'Électricien' });
      assert.deepEqual(community.services(hafid), []);
    });
  });

  describe('objets à emprunter', () => {
    it('suit le prêt et le retour', () => {
      const objet = community.addItem(hafid, 'Perceuse');
      assert.notEqual(typeof objet, 'string');
      if (typeof objet === 'string') return;

      assert.equal(community.borrow(hafid, objet.id), 'pas_ton_objet');
      const emprunté = community.borrow(salim, objet.id, '2026-10-01');
      assert.notEqual(typeof emprunté, 'string');
      if (typeof emprunté === 'string') return;
      assert.equal(emprunté.status, 'emprunte');
      assert.equal(emprunté.borrowedByMe, true);
      assert.equal(emprunté.dueDate, '2026-10-01');

      assert.equal(community.borrow(karim, objet.id), 'deja_emprunte');
      const rendu = community.giveBack(hafid, objet.id);
      assert.notEqual(typeof rendu, 'string');
      if (typeof rendu === 'string') return;
      assert.equal(rendu.status, 'disponible');
    });
  });

  describe('groupes d’intérêt', () => {
    it('réserve le fil du groupe à ses membres', () => {
      const groupe = community.createGroup(hafid, 'Parents d’élèves', '🎒');
      assert.notEqual(typeof groupe, 'string');
      if (typeof groupe === 'string') return;
      assert.equal(groupe.members, 1);

      assert.equal(community.groupPosts(salim, groupe.id), 'pas_membre');
      assert.equal(community.addGroupPost(salim, groupe.id, 'Bonjour à tous'), 'pas_membre');

      community.setGroupMembership(salim, groupe.id, true);
      assert.notEqual(typeof community.addGroupPost(salim, groupe.id, 'Bonjour à tous'), 'string');

      const fil = community.groupPosts(hafid, groupe.id);
      assert.notEqual(typeof fil, 'string');
      if (typeof fil === 'string') return;
      assert.equal(fil.length, 1);
      assert.equal(fil[0]!.authorName, 'Salim');

      community.setGroupMembership(salim, groupe.id, false);
      assert.equal(community.groupPosts(salim, groupe.id), 'pas_membre');
    });
  });

  describe('carte du quartier', () => {
    it('garde les points utiles dans leur quartier', () => {
      community.addPlace(hafid, {
        name: 'Pharmacie de garde',
        kind: 'pharmacie',
        latitude: 36.75,
        longitude: 5.06,
      });
      assert.equal(community.places(salim).length, 1);
      assert.equal(community.places(karim).length, 0);
    });
  });

  describe('mode vacances', () => {
    it('ne montre l’absence qu’aux voisins désignés', () => {
      const absence = community.declareVacation(hafid, {
        startsOn: '2099-07-01',
        endsOn: '2099-07-15',
        note: 'La clé est chez ma sœur',
        watcherIds: [salim.id],
      });
      assert.notEqual(typeof absence, 'string');
      if (typeof absence === 'string') return;
      assert.equal(absence.watchers.length, 1);

      assert.equal(community.watchedVacations(salim).length, 1);
      assert.equal(community.watchedVacations(salim)[0]!.neighborName, 'Hafid');
      assert.equal(community.watchedVacations(karim).length, 0);

      community.cancelVacation(hafid);
      assert.equal(community.vacation(hafid), undefined);
      assert.equal(community.watchedVacations(salim).length, 0);
    });

    it('refuse un veilleur d’un autre quartier', () => {
      assert.equal(
        community.declareVacation(hafid, {
          startsOn: '2099-07-01',
          endsOn: '2099-07-15',
          watcherIds: [karim.id],
        }),
        'voisin_inconnu'
      );
    });

    it('remplace l’absence précédente au lieu de les empiler', () => {
      community.declareVacation(hafid, { startsOn: '2099-07-01', endsOn: '2099-07-15', watcherIds: [salim.id] });
      community.declareVacation(hafid, { startsOn: '2099-08-01', endsOn: '2099-08-10', watcherIds: [salim.id] });
      assert.equal(community.vacation(hafid)?.startsOn, '2099-08-01');
      assert.equal(community.watchedVacations(salim).length, 1);
    });
  });

  describe('collecte des déchets', () => {
    it('partage le calendrier du quartier', () => {
      const créneau = community.addWasteSlot(hafid, { kind: 'ordures', weekday: 1, hour: '19:00' });
      assert.equal(community.wasteSlots(salim).length, 1);
      assert.equal(community.wasteSlots(karim).length, 0);
      assert.equal(community.removeWasteSlot(karim, créneau.id), false);
      assert.equal(community.removeWasteSlot(salim, créneau.id), true);
    });
  });

  describe('actions solidaires', () => {
    it('compte les participants une seule fois', () => {
      const action = community.createSolidarityAction(hafid, {
        title: 'Don du sang à l’hôpital',
        kind: 'sang',
        happensOn: '2099-03-01',
      });
      assert.notEqual(typeof action, 'string');
      if (typeof action === 'string') return;
      assert.equal(action.participants, 1);
      assert.equal(action.joined, true);

      community.setParticipation(salim, action.id, true);
      community.setParticipation(salim, action.id, true);
      const vue = community.solidarityActions(hafid).find((a) => a.id === action.id)!;
      assert.equal(vue.participants, 2);

      community.setParticipation(salim, action.id, false);
      assert.equal(community.solidarityActions(hafid)[0]!.participants, 1);
    });
  });
});

describe('déménagement', () => {
  it('garde le compte, déplace le fil, et laisse les anciennes publications derrière', () => {
    const db = openDatabase(':memory:');
    const content = new ContentRepository(db);
    const hafid = content.saveMember({
      phone: '0555000001',
      firstName: 'Hafid',
      neighborhoodId: 'bejaia-centre',
    });
    content.createPost(hafid, { category: 'annonce', text: 'Table à donner' });

    const déménagé = content.saveMember({
      phone: '0555000001',
      firstName: 'Hafid',
      neighborhoodId: 'akbou',
    });

    assert.equal(déménagé.id, hafid.id, 'le déménagement ne doit pas créer un second compte');
    assert.equal(déménagé.neighborhoodId, 'akbou');
    // La publication ne suit pas son auteur : elle appartient au fil où elle a
    // été écrite, et les voisins d'avant continuent de la voir.
    assert.equal(content.feed(déménagé).length, 0, 'le nouveau fil ne montre pas l’ancienne publication');
    assert.equal(content.feed(hafid).length, 1, 'l’ancien quartier la garde');
  });

  it('laisse lire et poursuivre une conversation entamée avant le déménagement', () => {
    const db = openDatabase(':memory:');
    const content = new ContentRepository(db);
    const community = new CommunityService(db);
    const hafid = content.saveMember({
      phone: '0555000001',
      firstName: 'Hafid',
      neighborhoodId: 'bejaia-centre',
    });
    const salim = content.saveMember({
      phone: '0555000002',
      firstName: 'Salim',
      neighborhoodId: 'bejaia-centre',
    });
    const karim = content.saveMember({
      phone: '0555000003',
      firstName: 'Karim',
      neighborhoodId: 'bejaia-centre',
    });

    community.sendMessage(hafid, salim.id, 'Salam, on se voit demain ?');

    const loin = content.saveMember({
      phone: '0555000001',
      firstName: 'Hafid',
      neighborhoodId: 'oran',
    });

    const fil = community.messages(loin, salim.id);
    assert.notEqual(typeof fil, 'string', 'la conversation entamée doit rester lisible');
    assert.notEqual(typeof community.sendMessage(loin, salim.id, 'J’ai déménagé à Oran'), 'string');
    assert.notEqual(typeof community.messages(salim, loin.id), 'string');

    // En revanche, aucune nouvelle conversation avec un voisin de l'ancien
    // quartier : le déménagement ne doit pas ouvrir un carnet d'adresses.
    assert.equal(community.sendMessage(loin, karim.id, 'Salam'), 'voisin_inconnu');
  });
});
