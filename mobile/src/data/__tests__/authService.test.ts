import { HttpAuthService } from '../authService';

/** Remplace `fetch` par une réponse figée, pour tester la lecture des erreurs. */
function stubFetch(status: number, body: unknown) {
  const spy = jest.fn().mockResolvedValue({
    status,
    json: async () => body,
  });
  (globalThis as { fetch: unknown }).fetch = spy;
  return spy;
}

describe('HttpAuthService', () => {
  const originalFetch = globalThis.fetch;
  const auth = new HttpAuthService();

  afterEach(() => {
    (globalThis as { fetch: unknown }).fetch = originalFetch;
  });

  it('lit un envoi réussi', async () => {
    stubFetch(200, { challengeId: 'abc', expiresAt: 1000, resendAfter: 500 });

    const result = await auth.requestCode('0555123456', 'sms');

    expect(result).toEqual({
      ok: true,
      challengeId: 'abc',
      expiresAt: 1000,
      resendAfter: 500,
    });
  });

  it('retient le code de développement quand le serveur le renvoie', async () => {
    stubFetch(200, { challengeId: 'abc', expiresAt: 1, resendAfter: 1, devCode: '123456' });

    const result = await auth.requestCode('0555123456', 'sms');

    expect(result.ok && result.devCode).toBe('123456');
  });

  it('transmet le canal choisi au serveur', async () => {
    const spy = stubFetch(200, { challengeId: 'abc', expiresAt: 1, resendAfter: 1 });

    await auth.requestCode('0555123456', 'whatsapp');

    const body = JSON.parse(spy.mock.calls[0][1].body);
    expect(body).toEqual({ phone: '0555123456', channel: 'whatsapp' });
  });

  it('ne retient que les canaux connus annoncés par le serveur', async () => {
    stubFetch(200, { channels: ['sms', 'whatsapp', 'pigeon'] });
    expect(await auth.listChannels()).toEqual(['sms', 'whatsapp']);
  });

  it('se rabat sur le SMS quand les canaux sont introuvables', async () => {
    (globalThis as { fetch: unknown }).fetch = jest.fn().mockRejectedValue(new Error('offline'));
    expect(await auth.listChannels()).toEqual(['sms']);
  });

  it('traduit un canal fermé côté serveur', async () => {
    stubFetch(400, { error: 'channel_unavailable' });
    expect(await auth.requestCode('0555123456', 'whatsapp')).toEqual({
      ok: false,
      reason: 'channel_unavailable',
    });
  });

  it('traduit une limitation de débit avec son délai', async () => {
    stubFetch(429, { error: 'cooldown', retryAfterSeconds: 42 });

    const result = await auth.requestCode('0555123456', 'sms');

    expect(result).toEqual({ ok: false, reason: 'cooldown', retryAfterSeconds: 42 });
  });

  it('traduit un échec d’envoi', async () => {
    stubFetch(502, { error: 'sms_failed' });
    expect(await auth.requestCode('0555123456', 'sms')).toEqual({ ok: false, reason: 'sms_failed' });
  });

  it('rend les essais restants sur un code refusé', async () => {
    stubFetch(401, { error: 'invalid_code', attemptsLeft: 2 });

    expect(await auth.verifyCode('abc', '000000')).toEqual({
      ok: false,
      reason: 'invalid_code',
      attemptsLeft: 2,
    });
  });

  it('rend la session sur un code accepté', async () => {
    stubFetch(200, { phone: '0555123456', token: 'jeton' });

    expect(await auth.verifyCode('abc', '123456')).toEqual({
      ok: true,
      phone: '0555123456',
      token: 'jeton',
    });
  });

  it('signale une panne réseau plutôt que de faire échouer la saisie', async () => {
    (globalThis as { fetch: unknown }).fetch = jest.fn().mockRejectedValue(new Error('offline'));

    expect(await auth.requestCode('0555123456', 'sms')).toEqual({ ok: false, reason: 'network' });
    expect(await auth.verifyCode('abc', '123456')).toEqual({ ok: false, reason: 'network' });
  });

  it('se rabat sur une erreur connue si le serveur répond n’importe quoi', async () => {
    stubFetch(500, { oups: true });
    expect(await auth.verifyCode('abc', '123456')).toEqual({ ok: false, reason: 'not_found' });
  });
});
