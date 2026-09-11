import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, it } from 'node:test';

import type { PushMessage, PushSender } from '../push/sender.js';

process.env.OTP_SECRET = 'secret-otp-de-test-suffisamment-long-123';
process.env.SESSION_SECRET = 'secret-session-de-test-assez-long-12345';

/** Service de notifications de test : garde ce qui serait parti. */
class RecordingPush implements PushSender {
  readonly name = 'recording';
  readonly delivers = true;
  sent: PushMessage[] = [];

  async send(messages: PushMessage[]): Promise<void> {
    this.sent.push(...messages);
  }
}

interface Voisin {
  token: string;
  nom: string;
  id: string;
}

describe('alertes SOS et sécurité', () => {
  const push = new RecordingPush();
  let baseUrl: string;
  let server: { close: (cb: (error?: Error) => void) => void; address: () => unknown };
  let issue: (phone: string) => string;
  let compteur = 0;

  const call = async (
    method: string,
    path: string,
    voisin?: Voisin,
    body?: unknown
  ): Promise<{ status: number; data: any }> => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(voisin ? { Authorization: `Bearer ${voisin.token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    return { status: response.status, data };
  };

  /** Inscrit un voisin, et enregistre son téléphone sauf mention contraire. */
  const inscrire = async (nom: string, quartier = 'bab-ezzouar', avecAppareil = true) => {
    compteur += 1;
    const phone = `05552000${String(compteur).padStart(2, '0')}`;
    const voisin: Voisin = { token: issue(phone), nom, id: '' };

    const profil = await call('POST', '/profile', voisin, {
      firstName: nom,
      neighborhoodId: quartier,
    });
    voisin.id = profil.data.id;

    if (avecAppareil) {
      const enregistre = await call('POST', '/devices', voisin, {
        token: `ExponentPushToken[${nom}-${compteur}]`,
        platform: 'android',
      });
      assert.equal(enregistre.status, 204);
    }
    return voisin;
  };

  before(async () => {
    const { createServer } = await import('../server.js');
    const { InMemoryChallengeStore } = await import('../otp/store.js');
    const { issueSessionToken } = await import('../session.js');
    const { config } = await import('../config.js');

    issue = (phone: string) => issueSessionToken(phone, config.sessionSecret, 1);

    const app = createServer({
      store: new InMemoryChallengeStore(),
      providers: {},
      databasePath: ':memory:',
      push,
    });
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve()) as never;
    });
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  beforeEach(() => {
    push.sent = [];
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('prévient uniquement les voisins choisis', async () => {
    const hafid = await inscrire('Hafid');
    const amina = await inscrire('Amina');
    const karim = await inscrire('Karim');
    const sofiane = await inscrire('Sofiane');

    const { status, data } = await call('POST', '/sos', hafid, {
      neighborIds: [amina.id, karim.id],
      position: { latitude: 36.7213, longitude: 3.1836 },
    });

    assert.equal(status, 201);
    assert.equal(data.alerted, 2);
    assert.equal(data.devices, 2);
    assert.equal(data.delivered, true);

    // Sofiane n'a pas été choisi : son téléphone ne sonne pas.
    assert.equal(push.sent.length, 2);
    assert.equal(
      push.sent.some((message) => message.to.includes('Sofiane')),
      false
    );
    // Une demande d'aide passe en priorité haute.
    assert.ok(push.sent.every((message) => message.priority === 'high'));
    assert.ok(push.sent.every((message) => message.title.includes('Hafid')));
  });

  it('refuse de faire sonner un téléphone d’un autre quartier', async () => {
    const alger = await inscrire('Alger', 'alger-centre');
    const blida = await inscrire('Blida', 'blida-centre');

    const { status, data } = await call('POST', '/sos', alger, {
      neighborIds: [blida.id],
    });

    assert.equal(status, 422);
    assert.equal(data.error, 'no_reachable_neighbor');
    assert.equal(push.sent.length, 0);
  });

  it('compte le voisin prévenu même sans appareil enregistré', async () => {
    const hafid = await inscrire('Demandeur');
    const injoignable = await inscrire('Injoignable', 'bab-ezzouar', false);

    const { data } = await call('POST', '/sos', hafid, { neighborIds: [injoignable.id] });

    assert.equal(data.alerted, 1);
    // Aucun téléphone à joindre : l'application doit pouvoir le dire.
    assert.equal(data.devices, 0);
    assert.equal(push.sent.length, 0);
  });

  it('prévient les mêmes voisins d’une fausse alerte', async () => {
    const hafid = await inscrire('Annuleur');
    const temoin = await inscrire('Témoin');

    const { data } = await call('POST', '/sos', hafid, { neighborIds: [temoin.id] });
    push.sent = [];

    const annule = await call('POST', `/sos/${data.alertId}/cancel`, hafid);
    assert.equal(annule.status, 200);
    assert.equal(push.sent.length, 1);
    assert.ok(push.sent[0]!.body.includes('Annuleur'));

    // Une alerte déjà annulée ne se rejoue pas.
    const encore = await call('POST', `/sos/${data.alertId}/cancel`, hafid);
    assert.equal(encore.status, 404);
  });

  it('n’autorise que l’auteur à annuler son alerte', async () => {
    const hafid = await inscrire('Auteur SOS');
    const autre = await inscrire('Passant');

    const { data } = await call('POST', '/sos', hafid, { neighborIds: [autre.id] });
    push.sent = [];

    const parAutrui = await call('POST', `/sos/${data.alertId}/cancel`, autre);
    assert.equal(parAutrui.status, 404);
    assert.equal(push.sent.length, 0);
  });

  it('prévient le quartier d’une alerte de sécurité, sauf son auteur', async () => {
    const auteur = await inscrire('Vigilant');
    const voisin = await inscrire('Voisine');

    await call('POST', '/posts', auteur, {
      category: 'securite',
      text: 'Vol signalé rue des Frères Bouadou vers 21h.',
    });

    // L'envoi ne bloque pas la réponse : on laisse le temps au relais.
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.ok(push.sent.length >= 1);
    assert.ok(push.sent.every((message) => message.priority === 'high'));
    assert.equal(
      push.sent.some((message) => message.to.includes('Vigilant')),
      false
    );
    assert.ok(push.sent.some((message) => message.to.includes('Voisine')));
    assert.ok(voisin);
  });

  it('ne notifie personne pour une publication ordinaire', async () => {
    const auteur = await inscrire('Bavard');
    await inscrire('Lecteur');

    await call('POST', '/posts', auteur, {
      category: 'entraide',
      text: 'Quelqu’un aurait une perceuse à me prêter ?',
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.equal(push.sent.length, 0);
  });

  it('refuse un SOS sans jeton de session', async () => {
    const { status } = await call('POST', '/sos', undefined, { neighborIds: ['x'] });
    assert.equal(status, 401);
  });
});
