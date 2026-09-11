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

    const result = await auth.requestCode('0555123456');

    expect(result).toEqual({
      ok: true,
      challengeId: 'abc',
      expiresAt: 1000,
      resendAfter: 500,
    });
  });

  it('retient le code de développement quand le serveur le renvoie', async () => {
    stubFetch(200, { challengeId: 'abc', expiresAt: 1, resendAfter: 1, devCode: '123456' });

    const result = await auth.requestCode('0555123456');

    expect(result.ok && result.devCode).toBe('123456');
  });

  it('traduit une limitation de débit avec son délai', async () => {
    stubFetch(429, { error: 'cooldown', retryAfterSeconds: 42 });

    const result = await auth.requestCode('0555123456');

    expect(result).toEqual({ ok: false, reason: 'cooldown', retryAfterSeconds: 42 });
  });

  it('traduit un échec d’envoi', async () => {
    stubFetch(502, { error: 'sms_failed' });
    expect(await auth.requestCode('0555123456')).toEqual({ ok: false, reason: 'sms_failed' });
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

    expect(await auth.requestCode('0555123456')).toEqual({ ok: false, reason: 'network' });
    expect(await auth.verifyCode('abc', '123456')).toEqual({ ok: false, reason: 'network' });
  });

  it('se rabat sur une erreur connue si le serveur répond n’importe quoi', async () => {
    stubFetch(500, { oups: true });
    expect(await auth.verifyCode('abc', '123456')).toEqual({ ok: false, reason: 'not_found' });
  });
});
