import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import type { MessageProvider } from '../messaging/provider.js';
import { VerificationService, type VerificationOptions } from './service.js';
import { InMemoryChallengeStore } from './store.js';

class FakeProvider implements MessageProvider {
  constructor(readonly name: string) {}
  readonly sent: { to: string; message: string }[] = [];
  shouldFail = false;

  async send(params: { to: string; message: string }): Promise<void> {
    if (this.shouldFail) throw new Error('passerelle indisponible');
    this.sent.push(params);
  }
}

/** Extrait le code du message envoyé, comme le ferait le voisin qui le lit. */
const codeFromMessage = (message: string) => message.match(/\b(\d{6})\b/)![1]!;

const OPTIONS: VerificationOptions = {
  length: 6,
  whatsappBusinessNumber: '213555000111',
  ttlSeconds: 300,
  maxAttempts: 3,
  resendCooldownSeconds: 60,
  maxSendsPerWindow: 3,
  windowSeconds: 3600,
  secret: 'secret-de-test-suffisamment-long-1234',
  exposeCode: false,
};

describe('VerificationService', () => {
  let store: InMemoryChallengeStore;
  let sms: FakeProvider;
  let whatsapp: FakeProvider;
  let clock: number;
  let service: VerificationService;

  const advance = (seconds: number) => {
    clock += seconds * 1000;
  };

  beforeEach(() => {
    sms = new FakeProvider('fake-sms');
    whatsapp = new FakeProvider('fake-whatsapp');
    clock = Date.UTC(2026, 0, 1, 12, 0, 0);
    store = new InMemoryChallengeStore(() => clock);
    service = new VerificationService(store, { sms, whatsapp }, OPTIONS, () => clock);
  });

  it('envoie un code et le vérifie', async () => {
    const request = await service.requestCode('0555 12 34 56');
    assert.equal(request.ok, true);
    assert.equal(sms.sent.length, 1);
    assert.equal(sms.sent[0]!.to, '+213555123456');

    const code = codeFromMessage(sms.sent[0]!.message);
    const result = await service.verifyCode(request.challengeId, code);

    assert.deepEqual(result, { ok: true, phone: '0555123456' });
  });

  it('envoie par WhatsApp quand ce canal est demandé', async () => {
    const request = await service.requestCode('0555123456', 'whatsapp');
    assert.equal(request.ok, true);
    assert.equal(sms.sent.length, 0);
    assert.equal(whatsapp.sent.length, 1);

    const code = codeFromMessage(whatsapp.sent[0]!.message);
    assert.deepEqual(await service.verifyCode(request.challengeId, code), {
      ok: true,
      phone: '0555123456',
    });
  });

  it('prend le SMS par défaut quand aucun canal n’est précisé', async () => {
    await service.requestCode('0555123456');
    assert.equal(sms.sent.length, 1);
    assert.equal(whatsapp.sent.length, 0);
  });

  it('refuse un canal qui n’est pas configuré', async () => {
    const smsOnly = new VerificationService(
      new InMemoryChallengeStore(() => clock),
      { sms },
      OPTIONS,
      () => clock
    );

    assert.deepEqual(smsOnly.channels, ['sms', 'whatsapp_link']);
    assert.deepEqual(await smsOnly.requestCode('0555123456', 'whatsapp'), {
      ok: false,
      reason: 'channel_unavailable',
    });
    assert.equal(sms.sent.length, 0);
  });

  it('partage les quotas entre les canaux', async () => {
    await service.requestCode('0555123456', 'sms');

    // Basculer sur WhatsApp ne doit pas contourner le délai de renvoi.
    const viaWhatsApp = await service.requestCode('0555123456', 'whatsapp');
    assert.equal(viaWhatsApp.ok, false);
    assert.equal(viaWhatsApp.ok === false && viaWhatsApp.reason, 'cooldown');
    assert.equal(whatsapp.sent.length, 0);
  });

  it('vérifie un code quel que soit le canal qui l’a porté', async () => {
    const first = await service.requestCode('0555123456', 'whatsapp');
    assert.equal(first.ok, true);
    advance(OPTIONS.resendCooldownSeconds);

    // Le voisin ne reçoit rien sur WhatsApp et redemande par SMS.
    const second = await service.requestCode('0555123456', 'sms');
    assert.equal(second.ok, true);

    const smsCode = codeFromMessage(sms.sent[0]!.message);
    assert.deepEqual(await service.verifyCode(second.challengeId, smsCode), {
      ok: true,
      phone: '0555123456',
    });
  });

  it('prépare un lien WhatsApp sans rien envoyer', async () => {
    const request = await service.requestCode('0555123456', 'whatsapp_link');

    assert.equal(request.ok, true);
    assert.equal(request.ok && request.mode, 'link');
    // Le canal gratuit ne passe par aucun fournisseur : rien n'est facturé.
    assert.equal(sms.sent.length, 0);
    assert.equal(whatsapp.sent.length, 0);

    if (request.ok && request.mode === 'link') {
      assert.match(request.link, /^https:\/\/wa\.me\/213555000111\?text=/);
      assert.ok(request.token.length >= 10);
    }
  });

  it('confirme le défi quand le message vient du bon numéro', async () => {
    const request = await service.requestCode('0555123456', 'whatsapp_link');
    assert.equal(request.ok && request.mode, 'link');
    if (!request.ok || request.mode !== 'link') return;

    assert.deepEqual(await service.claimLink(request.challengeId), {
      ok: false,
      reason: 'pending',
    });

    assert.equal(await service.confirmLink(`JIRAN ${request.token}`, '213555123456'), true);
    assert.deepEqual(await service.claimLink(request.challengeId), {
      ok: true,
      phone: '0555123456',
    });
  });

  it('refuse un jeton envoyé depuis un autre numéro', async () => {
    const request = await service.requestCode('0555123456', 'whatsapp_link');
    if (!request.ok || request.mode !== 'link') return assert.fail('défi non créé');

    // Sans ce contrôle, un inconnu ferait valider sa propre ligne à la place
    // du voisin, dont l'application s'ouvrirait sur le compte de l'inconnu.
    assert.equal(await service.confirmLink(`JIRAN ${request.token}`, '213661234567'), false);
    assert.deepEqual(await service.claimLink(request.challengeId), {
      ok: false,
      reason: 'pending',
    });
  });

  it('ignore un jeton inconnu ou un message quelconque', async () => {
    await service.requestCode('0555123456', 'whatsapp_link');

    assert.equal(await service.confirmLink('JIRAN ZZZZZZZZZZZZ', '213555123456'), false);
    assert.equal(await service.confirmLink('bonjour', '213555123456'), false);
  });

  it('ne relève qu’une fois un défi confirmé', async () => {
    const request = await service.requestCode('0555123456', 'whatsapp_link');
    if (!request.ok || request.mode !== 'link') return assert.fail('défi non créé');

    await service.confirmLink(`JIRAN ${request.token}`, '+213555123456');
    assert.equal((await service.claimLink(request.challengeId)).ok, true);
    assert.deepEqual(await service.claimLink(request.challengeId), {
      ok: false,
      reason: 'consumed',
    });
  });

  it('refuse un jeton arrivé après expiration', async () => {
    const request = await service.requestCode('0555123456', 'whatsapp_link');
    if (!request.ok || request.mode !== 'link') return assert.fail('défi non créé');

    advance(OPTIONS.ttlSeconds + 1);

    assert.equal(await service.confirmLink(`JIRAN ${request.token}`, '213555123456'), false);
    assert.deepEqual(await service.claimLink(request.challengeId), {
      ok: false,
      reason: 'expired',
    });
  });

  it('ferme le canal gratuit sans numéro WhatsApp configuré', async () => {
    const withoutNumber = new VerificationService(
      new InMemoryChallengeStore(() => clock),
      { sms },
      { ...OPTIONS, whatsappBusinessNumber: undefined },
      () => clock
    );

    assert.deepEqual(withoutNumber.channels, ['sms']);
    assert.deepEqual(await withoutNumber.requestCode('0555123456', 'whatsapp_link'), {
      ok: false,
      reason: 'channel_unavailable',
    });
  });

  it('refuse un numéro qui n’est pas un mobile algérien', async () => {
    const result = await service.requestCode('0212345678');
    assert.deepEqual(result, { ok: false, reason: 'invalid_phone' });
    assert.equal(sms.sent.length, 0);
  });

  it('ne renvoie jamais le code quand l’exposition est coupée', async () => {
    const request = await service.requestCode('0555123456');
    assert.equal(request.ok, true);
    assert.equal('devCode' in request, false);
  });

  it('décompte les essais puis brûle le code', async () => {
    const request = await service.requestCode('0555123456');
    assert.equal(request.ok, true);

    const first = await service.verifyCode(request.challengeId, '000000');
    assert.deepEqual(first, { ok: false, reason: 'invalid_code', attemptsLeft: 2 });

    await service.verifyCode(request.challengeId, '111111');
    const third = await service.verifyCode(request.challengeId, '222222');
    assert.deepEqual(third, { ok: false, reason: 'too_many_attempts' });

    // Même le bon code ne passe plus une fois les essais épuisés.
    const code = codeFromMessage(sms.sent[0]!.message);
    assert.deepEqual(await service.verifyCode(request.challengeId, code), {
      ok: false,
      reason: 'too_many_attempts',
    });
  });

  it('ne laisse pas rejouer un code déjà utilisé', async () => {
    const request = await service.requestCode('0555123456');
    assert.equal(request.ok, true);
    const code = codeFromMessage(sms.sent[0]!.message);

    assert.equal((await service.verifyCode(request.challengeId, code)).ok, true);
    assert.deepEqual(await service.verifyCode(request.challengeId, code), {
      ok: false,
      reason: 'consumed',
    });
  });

  it('refuse un code périmé', async () => {
    const request = await service.requestCode('0555123456');
    assert.equal(request.ok, true);
    const code = codeFromMessage(sms.sent[0]!.message);

    advance(OPTIONS.ttlSeconds + 1);

    assert.deepEqual(await service.verifyCode(request.challengeId, code), {
      ok: false,
      reason: 'expired',
    });
  });

  it('refuse un identifiant de défi inconnu', async () => {
    assert.deepEqual(await service.verifyCode('defi-inexistant', '123456'), {
      ok: false,
      reason: 'not_found',
    });
  });

  it('impose un délai avant un nouvel envoi', async () => {
    await service.requestCode('0555123456');
    const tooSoon = await service.requestCode('0555123456');

    assert.equal(tooSoon.ok, false);
    assert.equal(tooSoon.ok === false && tooSoon.reason, 'cooldown');
    assert.equal(sms.sent.length, 1);

    advance(OPTIONS.resendCooldownSeconds);
    assert.equal((await service.requestCode('0555123456')).ok, true);
    assert.equal(sms.sent.length, 2);
  });

  it('plafonne le nombre d’envois par numéro sur la fenêtre', async () => {
    for (let i = 0; i < OPTIONS.maxSendsPerWindow; i += 1) {
      assert.equal((await service.requestCode('0555123456')).ok, true);
      advance(OPTIONS.resendCooldownSeconds);
    }

    const blocked = await service.requestCode('0555123456');
    assert.equal(blocked.ok, false);
    assert.equal(blocked.ok === false && blocked.reason, 'rate_limited');

    // Le quota d'un numéro n'affecte pas celui d'un autre voisin.
    assert.equal((await service.requestCode('0661234567')).ok, true);
  });

  it('ne consomme pas le quota quand la passerelle échoue', async () => {
    sms.shouldFail = true;
    const failed = await service.requestCode('0555123456');
    assert.deepEqual(failed, { ok: false, reason: 'sms_failed' });

    sms.shouldFail = false;
    // Aucun délai à respecter : le premier envoi n'a jamais eu lieu.
    assert.equal((await service.requestCode('0555123456')).ok, true);
  });

  it('isole deux défis portant le même code', async () => {
    const first = await service.requestCode('0555123456');
    advance(OPTIONS.resendCooldownSeconds);
    const second = await service.requestCode('0661234567');
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);

    const firstCode = codeFromMessage(sms.sent[0]!.message);
    // Le code du premier défi ne doit rien valider sur le second.
    const result = await service.verifyCode(second.challengeId, firstCode);
    if (result.ok) {
      assert.fail('un code émis pour un autre défi a été accepté');
    }
  });
});
