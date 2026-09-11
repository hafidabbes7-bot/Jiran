import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';

import { createServer } from './server.js';
import { InMemoryChallengeStore } from './otp/store.js';
import type { SmsProvider } from './sms/provider.js';

class RecordingSms implements SmsProvider {
  readonly name = 'recording';
  readonly sent: { to: string; message: string }[] = [];

  async send(params: { to: string; message: string }): Promise<void> {
    this.sent.push(params);
  }
}

describe('API de vérification', () => {
  const sms = new RecordingSms();
  let baseUrl: string;
  let server: ReturnType<ReturnType<typeof createServer>['listen']>;

  const post = (path: string, body: unknown) =>
    fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  before(async () => {
    const app = createServer({ store: new InMemoryChallengeStore(), sms });
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('annonce son état et son fournisseur SMS', async () => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: 'ok',
      smsProvider: 'recording',
      devCodeExposed: false,
    });
  });

  it('refuse un numéro invalide avec 400', async () => {
    const response = await post('/auth/request-code', { phone: '0212345678' });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'invalid_phone' });
  });

  it('refuse une requête mal formée avec 400', async () => {
    const response = await post('/auth/request-code', { numero: '0555123456' });
    assert.equal(response.status, 400);
  });

  it('envoie un code, le vérifie et délivre un jeton utilisable', async () => {
    const requested = await post('/auth/request-code', { phone: '0555123456' });
    assert.equal(requested.status, 200);

    const challenge = (await requested.json()) as { challengeId: string; devCode?: string };
    assert.equal(typeof challenge.challengeId, 'string');
    // Le code ne doit jamais transiter par la réponse HTTP.
    assert.equal(challenge.devCode, undefined);

    const code = sms.sent.at(-1)!.message.match(/\b(\d{6})\b/)![1]!;
    const verified = await post('/auth/verify-code', {
      challengeId: challenge.challengeId,
      code,
    });
    assert.equal(verified.status, 200);

    const session = (await verified.json()) as { phone: string; token: string };
    assert.equal(session.phone, '0555123456');

    const me = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    assert.equal(me.status, 200);
    assert.deepEqual(await me.json(), { phone: '0555123456' });
  });

  it('répond 401 sur un mauvais code, en indiquant les essais restants', async () => {
    const requested = await post('/auth/request-code', { phone: '0661234567' });
    const { challengeId } = (await requested.json()) as { challengeId: string };

    const response = await post('/auth/verify-code', { challengeId, code: '000000' });
    assert.equal(response.status, 401);

    const body = (await response.json()) as { error: string; attemptsLeft: number };
    assert.equal(body.error, 'invalid_code');
    assert.equal(body.attemptsLeft, 4);
  });

  it('répond 429 et Retry-After quand un code est redemandé trop vite', async () => {
    await post('/auth/request-code', { phone: '0771234567' });
    const tooSoon = await post('/auth/request-code', { phone: '0771234567' });

    assert.equal(tooSoon.status, 429);
    assert.ok(Number(tooSoon.headers.get('retry-after')) > 0);
    assert.equal(((await tooSoon.json()) as { error: string }).error, 'cooldown');
  });

  it('refuse un jeton absent ou falsifié', async () => {
    const withoutToken = await fetch(`${baseUrl}/auth/me`);
    assert.equal(withoutToken.status, 401);

    const forged = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: 'Bearer nimporte.quoi' },
    });
    assert.equal(forged.status, 401);
  });
});
