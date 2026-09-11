import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';

const APP_SECRET = 'secret-application-meta-pour-les-tests';
const VERIFY_TOKEN = 'jeton-de-validation-webhook';

// La configuration est lue à l'import : ces variables doivent être posées
// avant de charger le serveur, d'où l'import dynamique plus bas.
process.env.OTP_SECRET = 'secret-otp-de-test-suffisamment-long-123';
process.env.SESSION_SECRET = 'secret-session-de-test-assez-long-12345';
process.env.WHATSAPP_BUSINESS_NUMBER = '213555000111';
process.env.WHATSAPP_APP_SECRET = APP_SECRET;
process.env.WHATSAPP_VERIFY_TOKEN = VERIFY_TOKEN;

/** Notification WhatsApp, dans la forme qu'envoie Meta. */
const notification = (from: string, text: string) => ({
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '0',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            messages: [{ from, id: 'wamid.test', type: 'text', text: { body: text } }],
          },
        },
      ],
    },
  ],
});

describe('vérification gratuite par WhatsApp', () => {
  let baseUrl: string;
  let server: { close: (cb: (error?: Error) => void) => void; address: () => unknown };

  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });

  /** Signe comme Meta : HMAC-SHA256 du corps brut avec le secret de l'application. */
  const signed = (body: unknown, secret = APP_SECRET) => {
    const raw = JSON.stringify(body);
    const signature = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    return fetch(`${baseUrl}/webhooks/whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': `sha256=${signature}`,
      },
      body: raw,
    });
  };

  before(async () => {
    const { createServer } = await import('./server.js');
    const { InMemoryChallengeStore } = await import('./otp/store.js');

    const app = createServer({
      store: new InMemoryChallengeStore(),
      providers: {},
      databasePath: ':memory:',
      push: { name: 'test', delivers: false, send: async () => {} },
    });
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve()) as never;
    });
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('propose le canal gratuit', async () => {
    const response = await fetch(`${baseUrl}/auth/channels`);
    assert.deepEqual(await response.json(), { channels: ['whatsapp_link'] });
  });

  it('valide l’URL du webhook auprès de Meta', async () => {
    const ok = await fetch(
      `${baseUrl}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=12345`
    );
    assert.equal(ok.status, 200);
    assert.equal(await ok.text(), '12345');

    const refused = await fetch(
      `${baseUrl}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=mauvais&hub.challenge=12345`
    );
    assert.equal(refused.status, 403);
  });

  it('rejette une notification mal signée', async () => {
    const forged = await signed(notification('213555123456', 'JIRAN ABCDEFGHJKLM'), 'mauvais-secret');
    assert.equal(forged.status, 403);

    const unsigned = await post('/webhooks/whatsapp', notification('213555123456', 'JIRAN X'));
    assert.equal(unsigned.status, 403);
  });

  it('vérifie le numéro quand le message arrive', async () => {
    const requested = await post('/auth/request-code', {
      phone: '0555123456',
      channel: 'whatsapp_link',
    });
    assert.equal(requested.status, 200);

    const challenge = (await requested.json()) as {
      mode: string;
      challengeId: string;
      link: string;
      token: string;
    };
    assert.equal(challenge.mode, 'link');
    assert.ok(challenge.link.startsWith('https://wa.me/213555000111?text='));

    // Rien n'est encore arrivé.
    const pending = await post('/auth/verify-link', { challengeId: challenge.challengeId });
    assert.equal(pending.status, 202);

    const delivered = await signed(notification('213555123456', `JIRAN ${challenge.token}`));
    assert.equal(delivered.status, 200);

    const claimed = await post('/auth/verify-link', { challengeId: challenge.challengeId });
    assert.equal(claimed.status, 200);

    const session = (await claimed.json()) as { phone: string; token: string };
    assert.equal(session.phone, '0555123456');

    const me = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    assert.deepEqual(await me.json(), { phone: '0555123456' });
  });

  it('ne valide rien quand le message vient d’un autre numéro', async () => {
    const requested = await post('/auth/request-code', {
      phone: '0661234567',
      channel: 'whatsapp_link',
    });
    const challenge = (await requested.json()) as { challengeId: string; token: string };

    await signed(notification('213770000000', `JIRAN ${challenge.token}`));

    const stillPending = await post('/auth/verify-link', {
      challengeId: challenge.challengeId,
    });
    assert.equal(stillPending.status, 202);
  });
});
