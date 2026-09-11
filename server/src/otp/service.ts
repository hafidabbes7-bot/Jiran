import crypto from 'node:crypto';

import { isValidAlgerianMobile, maskPhone, normalizePhone, toE164 } from '../phone.js';
import type { Channel, ChannelProviders } from '../messaging/provider.js';
import { generateCode, hashCode, safeEqual } from './codes.js';
import type { Challenge, ChallengeStore } from './store.js';

export interface VerificationOptions {
  length: number;
  ttlSeconds: number;
  maxAttempts: number;
  resendCooldownSeconds: number;
  maxSendsPerWindow: number;
  windowSeconds: number;
  secret: string;
  /** N'expose le code que pour le développement local. */
  exposeCode: boolean;
}

export type RequestResult =
  | {
      ok: true;
      challengeId: string;
      expiresAt: number;
      /** Instant à partir duquel un nouvel envoi est accepté. */
      resendAfter: number;
      /** Présent uniquement en développement. */
      devCode?: string;
    }
  | { ok: false; reason: 'invalid_phone' }
  | { ok: false; reason: 'channel_unavailable' }
  | { ok: false; reason: 'cooldown' | 'rate_limited'; retryAfterSeconds: number }
  | { ok: false; reason: 'sms_failed' };

export type VerifyResult =
  | { ok: true; phone: string }
  | { ok: false; reason: 'not_found' | 'expired' | 'consumed' }
  | { ok: false; reason: 'invalid_code'; attemptsLeft: number }
  | { ok: false; reason: 'too_many_attempts' };

/** Texte du SMS. Volontairement court, en caractères latins : un message en
 * arabe passe en UCS-2 et tombe à 70 caractères par segment, donc coûte plus
 * cher et se fractionne. */
export function buildMessage(code: string, ttlSeconds: number): string {
  const minutes = Math.max(1, Math.round(ttlSeconds / 60));
  return `Jiran : votre code de verification est ${code}. Il expire dans ${minutes} min. Ne le communiquez a personne.`;
}

/**
 * Vérification d'un numéro par code à usage unique.
 *
 * Les protections ne sont pas décoratives : sans elles, l'API sert de machine à
 * envoyer des SMS aux frais du projet, et un code à 6 chiffres se devine en
 * quelques milliers d'essais.
 */
export class VerificationService {
  constructor(
    private readonly store: ChallengeStore,
    private readonly providers: ChannelProviders,
    private readonly options: VerificationOptions,
    private readonly now: () => number = () => Date.now()
  ) {}

  /** Canaux ouverts, dans l'ordre d'affichage souhaité. */
  get channels(): Channel[] {
    return (['sms', 'whatsapp'] as const).filter((channel) => this.providers[channel]);
  }

  async requestCode(rawPhone: string, channel: Channel = 'sms'): Promise<RequestResult> {
    if (!isValidAlgerianMobile(rawPhone)) {
      return { ok: false, reason: 'invalid_phone' };
    }

    const provider = this.providers[channel];
    if (!provider) {
      return { ok: false, reason: 'channel_unavailable' };
    }

    const phone = normalizePhone(rawPhone);
    const now = this.now();
    const { timestamps } = await this.store.sendLog(phone);

    const lastSend = timestamps.at(-1);
    if (lastSend !== undefined) {
      const elapsed = (now - lastSend) / 1000;
      if (elapsed < this.options.resendCooldownSeconds) {
        return {
          ok: false,
          reason: 'cooldown',
          retryAfterSeconds: Math.ceil(this.options.resendCooldownSeconds - elapsed),
        };
      }
    }

    // Les quotas sont tenus par numéro, tous canaux confondus : basculer sur
    // WhatsApp ne doit pas remettre les compteurs à zéro.
    const windowStart = now - this.options.windowSeconds * 1000;
    const sendsInWindow = timestamps.filter((timestamp) => timestamp > windowStart);
    if (sendsInWindow.length >= this.options.maxSendsPerWindow) {
      const oldest = sendsInWindow[0]!;
      return {
        ok: false,
        reason: 'rate_limited',
        retryAfterSeconds: Math.ceil((oldest + this.options.windowSeconds * 1000 - now) / 1000),
      };
    }

    const challengeId = crypto.randomUUID();
    const code = generateCode(this.options.length);

    try {
      await provider.send({
        to: toE164(phone),
        message: buildMessage(code, this.options.ttlSeconds),
      });
    } catch (error) {
      console.error(
        `[otp] envoi impossible vers ${maskPhone(phone)} par ${channel} (${provider.name})`,
        error
      );
      return { ok: false, reason: 'sms_failed' };
    }

    // L'envoi n'est compté qu'une fois réussi : un échec de la passerelle ne
    // doit pas consommer le quota du voisin.
    await this.store.recordSend(phone, now);

    const challenge: Challenge = {
      id: challengeId,
      phone,
      codeHash: hashCode(challengeId, code, this.options.secret),
      expiresAt: now + this.options.ttlSeconds * 1000,
      attemptsLeft: this.options.maxAttempts,
      createdAt: now,
      consumed: false,
    };
    await this.store.save(challenge);

    return {
      ok: true,
      challengeId,
      expiresAt: challenge.expiresAt,
      resendAfter: now + this.options.resendCooldownSeconds * 1000,
      ...(this.options.exposeCode ? { devCode: code } : {}),
    };
  }

  async verifyCode(challengeId: string, code: string): Promise<VerifyResult> {
    const challenge = await this.store.find(challengeId);
    if (!challenge) return { ok: false, reason: 'not_found' };
    if (challenge.consumed) return { ok: false, reason: 'consumed' };
    if (challenge.expiresAt < this.now()) return { ok: false, reason: 'expired' };
    if (challenge.attemptsLeft <= 0) return { ok: false, reason: 'too_many_attempts' };

    const candidate = hashCode(challenge.id, code.trim(), this.options.secret);
    if (!safeEqual(candidate, challenge.codeHash)) {
      const attemptsLeft = challenge.attemptsLeft - 1;
      await this.store.update({ ...challenge, attemptsLeft });
      return attemptsLeft <= 0
        ? { ok: false, reason: 'too_many_attempts' }
        : { ok: false, reason: 'invalid_code', attemptsLeft };
    }

    // Un code validé est brûlé immédiatement : il ne sert qu'une fois.
    await this.store.update({ ...challenge, consumed: true });
    return { ok: true, phone: challenge.phone };
  }
}
