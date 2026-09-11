import crypto from 'node:crypto';

import { isValidAlgerianMobile, maskPhone, normalizePhone, toE164 } from '../phone.js';
import type { Channel, ChannelProviders } from '../messaging/provider.js';
import { generateCode, generateLinkToken, hashCode, safeEqual } from './codes.js';
import type { Challenge, ChallengeStore } from './store.js';

export interface VerificationOptions {
  length: number;
  /** Numéro WhatsApp vers lequel le voisin envoie son jeton (mode `link`). */
  whatsappBusinessNumber?: string;
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
      mode: 'code';
      challengeId: string;
      expiresAt: number;
      /** Instant à partir duquel un nouvel envoi est accepté. */
      resendAfter: number;
      /** Présent uniquement en développement. */
      devCode?: string;
    }
  | {
      ok: true;
      mode: 'link';
      challengeId: string;
      expiresAt: number;
      /** Lien `wa.me` à ouvrir, message pré-rempli. */
      link: string;
      /** Jeton que le voisin nous envoie ; c'est son message qui prouve le numéro. */
      token: string;
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

/** Résultat d'une relève du défi « lien WhatsApp », interrogé en boucle. */
export type ClaimResult =
  | { ok: true; phone: string }
  | { ok: false; reason: 'pending' | 'not_found' | 'expired' | 'consumed' };

/** Message que le voisin envoie depuis WhatsApp. */
export function buildLinkMessage(token: string): string {
  return `JIRAN ${token}`;
}

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

  /**
   * Canaux ouverts, dans l'ordre d'affichage.
   *
   * Le code reçu par SMS vient en premier : c'est le parcours que tout le
   * monde connaît, et celui qu'on veut voir par défaut. Le canal gratuit est
   * une solution de repli proposée ensuite, pas la vitrine.
   */
  get channels(): Channel[] {
    const open: Channel[] = [];
    if (this.providers.sms) open.push('sms');
    if (this.providers.whatsapp) open.push('whatsapp');
    if (this.options.whatsappBusinessNumber) open.push('whatsapp_link');
    return open;
  }

  async requestCode(rawPhone: string, channel: Channel = 'sms'): Promise<RequestResult> {
    if (!isValidAlgerianMobile(rawPhone)) {
      return { ok: false, reason: 'invalid_phone' };
    }

    if (channel === 'whatsapp_link') {
      return this.requestLink(normalizePhone(rawPhone));
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
      mode: 'code',
      codeHash: hashCode(challengeId, code, this.options.secret),
      expiresAt: now + this.options.ttlSeconds * 1000,
      attemptsLeft: this.options.maxAttempts,
      createdAt: now,
      consumed: false,
    };
    await this.store.save(challenge);

    return {
      ok: true,
      mode: 'code',
      challengeId,
      expiresAt: challenge.expiresAt,
      resendAfter: now + this.options.resendCooldownSeconds * 1000,
      ...(this.options.exposeCode ? { devCode: code } : {}),
    };
  }

  /**
   * Vérification gratuite : au lieu de lui envoyer un message, on prépare un
   * jeton que le voisin nous envoie depuis son propre WhatsApp.
   *
   * Rien n'est émis par le serveur, donc rien n'est facturé. Et la preuve est
   * plus solide qu'un code recopié : le numéro d'origine nous est donné par
   * Meta, pas saisi par l'utilisateur.
   *
   * Aucun quota d'envoi n'est consommé ici — il n'y a pas d'envoi. Seule la
   * limite par adresse IP borne la création de défis.
   */
  private async requestLink(phone: string): Promise<RequestResult> {
    const businessNumber = this.options.whatsappBusinessNumber;
    if (!businessNumber) {
      return { ok: false, reason: 'channel_unavailable' };
    }

    const now = this.now();
    const challengeId = crypto.randomUUID();
    const token = generateLinkToken();

    const challenge: Challenge = {
      id: challengeId,
      phone,
      mode: 'link',
      codeHash: hashCode(challengeId, token, this.options.secret),
      expiresAt: now + this.options.ttlSeconds * 1000,
      attemptsLeft: this.options.maxAttempts,
      createdAt: now,
      consumed: false,
      linkConfirmed: false,
    };
    await this.store.save(challenge);

    const message = encodeURIComponent(buildLinkMessage(token));
    return {
      ok: true,
      mode: 'link',
      challengeId,
      expiresAt: challenge.expiresAt,
      link: `https://wa.me/${businessNumber}?text=${message}`,
      token,
    };
  }

  /**
   * Traite un message reçu sur WhatsApp : si son texte porte un jeton en
   * attente **et** qu'il vient bien du numéro déclaré, le défi est confirmé.
   *
   * Les deux conditions comptent. Le jeton seul ne suffit pas : sans le
   * contrôle du numéro d'origine, quelqu'un qui devinerait un jeton ferait
   * valider sa propre ligne à la place de celle du voisin, et l'application du
   * voisin s'ouvrirait sur le compte de l'inconnu.
   */
  async confirmLink(text: string, senderE164: string): Promise<boolean> {
    const token = text.trim().split(/\s+/).at(-1);
    if (!token) return false;

    const sender = normalizePhone(senderE164.startsWith('+') ? senderE164 : `+${senderE164}`);

    // L'empreinte dépend de l'identifiant du défi : on le cherche parmi les
    // défis vivants plutôt que de hacher sans sel.
    const candidates = await this.store.findAllPending();
    const match = candidates.find(
      (challenge) =>
        challenge.mode === 'link' &&
        safeEqual(hashCode(challenge.id, token, this.options.secret), challenge.codeHash)
    );

    if (!match) return false;
    if (match.expiresAt < this.now() || match.consumed) return false;
    if (match.phone !== sender) {
      console.warn(
        `[otp] jeton WhatsApp reçu depuis ${maskPhone(sender)}, attendu ${maskPhone(match.phone)}`
      );
      return false;
    }

    await this.store.update({ ...match, linkConfirmed: true });
    return true;
  }

  /** Relève d'un défi « lien » : l'application interroge jusqu'à confirmation. */
  async claimLink(challengeId: string): Promise<ClaimResult> {
    const challenge = await this.store.find(challengeId);
    if (!challenge || challenge.mode !== 'link') return { ok: false, reason: 'not_found' };
    if (challenge.consumed) return { ok: false, reason: 'consumed' };
    if (challenge.expiresAt < this.now()) return { ok: false, reason: 'expired' };
    if (!challenge.linkConfirmed) return { ok: false, reason: 'pending' };

    await this.store.update({ ...challenge, consumed: true });
    return { ok: true, phone: challenge.phone };
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
