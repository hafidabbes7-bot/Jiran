/**
 * Vérification du numéro par SMS, côté application.
 *
 * L'application ne fabrique ni n'évalue jamais le code elle-même : elle
 * demande au serveur d'en envoyer un, puis lui soumet ce que le voisin a
 * saisi. Un contrôle fait sur le téléphone n'en serait pas un — il suffirait
 * de lire le code dans le trafic ou de contourner l'écran.
 */

/** Canal par lequel le voisin reçoit son code. */
export type Channel = 'sms' | 'whatsapp';

/** Adresse de l'API, injectée à la compilation par Expo (`EXPO_PUBLIC_*`). */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface Challenge {
  challengeId: string;
  /** Fin de validité du code, en millisecondes Unix. */
  expiresAt: number;
  /** Instant à partir duquel un nouvel envoi est accepté. */
  resendAfter: number;
  /** Présent uniquement quand le serveur tourne en mode développement. */
  devCode?: string;
}

export type RequestCodeResult =
  | ({ ok: true } & Challenge)
  | { ok: false; reason: 'invalid_phone' | 'sms_failed' | 'network' | 'channel_unavailable' }
  | { ok: false; reason: 'cooldown' | 'rate_limited'; retryAfterSeconds: number };

export interface VerifiedSession {
  phone: string;
  /** Jeton à présenter ensuite au serveur. */
  token: string;
}

export type VerifyCodeResult =
  | ({ ok: true } & VerifiedSession)
  | { ok: false; reason: 'invalid_code'; attemptsLeft: number }
  | {
      ok: false;
      reason: 'expired' | 'consumed' | 'not_found' | 'too_many_attempts' | 'network';
    };

export interface AuthService {
  /** Canaux réellement ouverts côté serveur. */
  listChannels(): Promise<Channel[]>;
  requestCode(phone: string, channel: Channel): Promise<RequestCodeResult>;
  verifyCode(challengeId: string, code: string): Promise<VerifyCodeResult>;
}

/** Coupe l'attente : sans cela, un serveur injoignable fige l'inscription. */
const REQUEST_TIMEOUT_MS = 10_000;

type JsonObject = Record<string, unknown>;

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;
const asNumber = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/**
 * Appel HTTP borné dans le temps. Le `finally` n'est pas décoratif : sans lui,
 * chaque requête échouée laisserait un minuteur en vie.
 */
async function requestJson(
  path: string,
  init: RequestInit
): Promise<{ status: number; data: JsonObject }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_URL}${path}`, { ...init, signal: controller.signal });
    const data = (await response.json().catch(() => ({}))) as JsonObject;
    return { status: response.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

const postJson = (path: string, body: unknown) =>
  requestJson(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

export class HttpAuthService implements AuthService {
  /**
   * Ne proposer que les canaux ouverts : afficher WhatsApp alors qu'aucun
   * compte Meta n'est configuré reviendrait à promettre un message qui
   * n'arrivera jamais.
   */
  async listChannels(): Promise<Channel[]> {
    try {
      const { data } = await requestJson('/auth/channels', { method: 'GET' });
      const channels = Array.isArray(data.channels) ? data.channels : [];
      return channels.filter(
        (channel): channel is Channel => channel === 'sms' || channel === 'whatsapp'
      );
    } catch {
      // Serveur injoignable : on garde le SMS, le message d'erreur viendra de
      // la tentative d'envoi elle-même.
      return ['sms'];
    }
  }

  async requestCode(phone: string, channel: Channel): Promise<RequestCodeResult> {
    try {
      const { status, data } = await postJson('/auth/request-code', { phone, channel });

      if (status === 200) {
        return {
          ok: true,
          challengeId: asString(data.challengeId),
          expiresAt: asNumber(data.expiresAt),
          resendAfter: asNumber(data.resendAfter),
          ...(typeof data.devCode === 'string' ? { devCode: data.devCode } : {}),
        };
      }

      const error = asString(data.error);
      if (error === 'cooldown' || error === 'rate_limited') {
        return {
          ok: false,
          reason: error,
          retryAfterSeconds: asNumber(data.retryAfterSeconds, 60),
        };
      }
      if (error === 'sms_failed') return { ok: false, reason: 'sms_failed' };
      if (error === 'channel_unavailable') return { ok: false, reason: 'channel_unavailable' };
      return { ok: false, reason: 'invalid_phone' };
    } catch {
      return { ok: false, reason: 'network' };
    }
  }

  async verifyCode(challengeId: string, code: string): Promise<VerifyCodeResult> {
    try {
      const { status, data } = await postJson('/auth/verify-code', { challengeId, code });

      if (status === 200) {
        return { ok: true, phone: asString(data.phone), token: asString(data.token) };
      }

      const error = asString(data.error);
      if (error === 'invalid_code') {
        return { ok: false, reason: 'invalid_code', attemptsLeft: asNumber(data.attemptsLeft) };
      }

      const known = ['expired', 'consumed', 'not_found', 'too_many_attempts'] as const;
      const reason = known.find((value) => value === error);
      return { ok: false, reason: reason ?? 'not_found' };
    } catch {
      return { ok: false, reason: 'network' };
    }
  }
}
