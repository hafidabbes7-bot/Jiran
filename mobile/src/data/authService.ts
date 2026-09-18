import { Platform } from 'react-native';

/**
 * Vérification du numéro par SMS, côté application.
 *
 * L'application ne fabrique ni n'évalue jamais le code elle-même : elle
 * demande au serveur d'en envoyer un, puis lui soumet ce que le voisin a
 * saisi. Un contrôle fait sur le téléphone n'en serait pas un — il suffirait
 * de lire le code dans le trafic ou de contourner l'écran.
 */

/**
 * Manière de prouver le numéro :
 * - `sms` et `whatsapp` : on reçoit un code (le projet paie l'envoi) ;
 * - `whatsapp_link` : c'est le voisin qui envoie un message depuis son
 *   WhatsApp, donc rien n'est facturé.
 */
export type Channel = 'sms' | 'whatsapp' | 'whatsapp_link' | 'email';

/**
 * Liste de référence des canaux, dans l'ordre d'affichage : un canal ajouté
 * ici l'est partout. Le SMS d'abord — c'est le parcours attendu.
 */
export const CHANNELS: readonly Channel[] = ['sms', 'whatsapp', 'whatsapp_link', 'email'];

const isChannel = (value: unknown): value is Channel => CHANNELS.includes(value as Channel);

/**
 * Adresse du serveur.
 *
 * Sur un téléphone, elle est figée à la compilation (`EXPO_PUBLIC_API_URL`) :
 * l'application est un paquet installé, elle n'a aucun moyen de la deviner.
 *
 * Dans un navigateur, elle vaut par défaut l'adresse de la page elle-même,
 * parce que le serveur sert aussi l'application web. C'est ce qui permet de
 * partager un simple lien à des voisins : il n'y a rien à configurer, et
 * l'adresse suit le lien où qu'il pointe.
 */
function resolveApiUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) return configured;

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:4000';
}

export const API_URL = resolveApiUrl();

/** Défi classique : un code a été envoyé, il faut le recopier. */
export interface CodeChallenge {
  mode: 'code';
  challengeId: string;
  /** Fin de validité du code, en millisecondes Unix. */
  expiresAt: number;
  /** Instant à partir duquel un nouvel envoi est accepté. */
  resendAfter: number;
  /** Présent uniquement quand le serveur tourne en mode développement. */
  devCode?: string;
}

/** Défi gratuit : c'est le voisin qui envoie le jeton depuis WhatsApp. */
export interface LinkChallenge {
  mode: 'link';
  challengeId: string;
  expiresAt: number;
  /** Lien `wa.me` à ouvrir, message déjà rempli. */
  link: string;
  token: string;
}

export type Challenge = CodeChallenge | LinkChallenge;

export type RequestCodeResult =
  | ({ ok: true } & Challenge)
  | { ok: false; reason: 'invalid_phone' | 'sms_failed' | 'network' | 'channel_unavailable' }
  | { ok: false; reason: 'cooldown' | 'rate_limited'; retryAfterSeconds: number };

export interface VerifiedSession {
  /** Numéro ou adresse, tel que le serveur l'a vérifié et normalisé. */
  identifier: string;
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

export type ClaimLinkResult =
  | ({ ok: true } & VerifiedSession)
  | { ok: false; reason: 'pending' | 'expired' | 'consumed' | 'not_found' | 'network' };

/**
 * Inscription par adresse et mot de passe.
 *
 * `emailSent` dit si le lien est réellement parti. Sans fournisseur d'e-mail
 * branché, il vaut `false` : l'application doit alors le dire, plutôt
 * qu'afficher « regarde ta boîte » devant une boîte qui ne recevra rien.
 */
export type RegisterResult =
  | { ok: true; emailSent: boolean; devLink?: string }
  | {
      ok: false;
      reason:
        | 'adresse_invalide'
        | 'mot_de_passe_trop_court'
        | 'mot_de_passe_trop_long'
        | 'mot_de_passe_trop_courant'
        | 'rate_limited'
        | 'network';
    };

export type LoginResult =
  | ({ ok: true } & VerifiedSession)
  | {
      ok: false;
      reason:
        | 'identifiants_refuses'
        | 'adresse_non_confirmee'
        | 'compte_bloque'
        | 'rate_limited'
        | 'network';
    };

/** Profil déjà enregistré côté serveur pour un identifiant vérifié. */
export interface ExistingProfile {
  firstName: string;
  neighborhoodId: string;
  building?: string;
  joinedAt: string;
  isModerator: boolean;
}

export interface AuthService {
  /** Canaux réellement ouverts côté serveur. */
  listChannels(): Promise<Channel[]>;
  requestCode(identifier: string, channel: Channel): Promise<RequestCodeResult>;
  verifyCode(challengeId: string, code: string): Promise<VerifyCodeResult>;
  /** Interrogé en boucle pendant que le voisin envoie son message WhatsApp. */
  claimLink(challengeId: string): Promise<ClaimLinkResult>;

  /** Crée un compte par adresse et mot de passe ; un lien part par e-mail. */
  register(email: string, password: string): Promise<RegisterResult>;
  login(email: string, password: string): Promise<LoginResult>;
  /** Renvoie le lien de confirmation. Silencieux si l'adresse est inconnue. */
  resendConfirmation(email: string): Promise<{ ok: boolean; emailSent: boolean }>;
  /** Demande un lien pour choisir un nouveau mot de passe. */
  forgotPassword(email: string): Promise<{ ok: boolean; emailSent: boolean }>;
  /** Profil déjà créé pour ce jeton, s'il y en a un. */
  existingProfile(token: string): Promise<ExistingProfile | null>;
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
      return channels.filter(isChannel);
    } catch {
      // Serveur injoignable : on garde le SMS, le message d'erreur viendra de
      // la tentative d'envoi elle-même.
      return ['sms'];
    }
  }

  async requestCode(identifier: string, channel: Channel): Promise<RequestCodeResult> {
    try {
      const { status, data } = await postJson('/auth/request-code', { identifier, channel });

      if (status === 200) {
        if (data.mode === 'link') {
          return {
            ok: true,
            mode: 'link',
            challengeId: asString(data.challengeId),
            expiresAt: asNumber(data.expiresAt),
            link: asString(data.link),
            token: asString(data.token),
          };
        }

        return {
          ok: true,
          mode: 'code',
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
        return {
          ok: true,
          identifier: asString(data.identifier ?? data.phone),
          token: asString(data.token),
        };
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

  async claimLink(challengeId: string): Promise<ClaimLinkResult> {
    try {
      const { status, data } = await postJson('/auth/verify-link', { challengeId });

      if (status === 200) {
        return {
          ok: true,
          identifier: asString(data.identifier ?? data.phone),
          token: asString(data.token),
        };
      }
      // 202 : le message n'est pas encore arrivé, il faut redemander.
      if (status === 202) return { ok: false, reason: 'pending' };

      const known = ['expired', 'consumed', 'not_found'] as const;
      const reason = known.find((value) => value === asString(data.error));
      return { ok: false, reason: reason ?? 'not_found' };
    } catch {
      return { ok: false, reason: 'network' };
    }
  }

  // --- Comptes par adresse et mot de passe -----------------------------

  async register(email: string, password: string): Promise<RegisterResult> {
    try {
      const { status, data } = await postJson('/auth/register', { email, password });

      if (status === 201) {
        return {
          ok: true,
          emailSent: data.emailSent === true,
          ...(typeof data.devLink === 'string' ? { devLink: data.devLink } : {}),
        };
      }

      const known = [
        'adresse_invalide',
        'mot_de_passe_trop_court',
        'mot_de_passe_trop_long',
        'mot_de_passe_trop_courant',
        'rate_limited',
      ] as const;
      const reason = known.find((value) => value === asString(data.error));
      return { ok: false, reason: reason ?? 'adresse_invalide' };
    } catch {
      return { ok: false, reason: 'network' };
    }
  }

  async login(email: string, password: string): Promise<LoginResult> {
    try {
      const { status, data } = await postJson('/auth/login', { email, password });

      if (status === 200) {
        return {
          ok: true,
          identifier: asString(data.identifier ?? data.phone),
          token: asString(data.token),
        };
      }

      const known = [
        'identifiants_refuses',
        'adresse_non_confirmee',
        'compte_bloque',
        'rate_limited',
      ] as const;
      const reason = known.find((value) => value === asString(data.error));
      return { ok: false, reason: reason ?? 'identifiants_refuses' };
    } catch {
      return { ok: false, reason: 'network' };
    }
  }

  async resendConfirmation(email: string): Promise<{ ok: boolean; emailSent: boolean }> {
    return this.demanderLien('/auth/resend-confirmation', email);
  }

  async forgotPassword(email: string): Promise<{ ok: boolean; emailSent: boolean }> {
    return this.demanderLien('/auth/forgot-password', email);
  }

  /**
   * Les deux demandes de lien répondent pareil, exprès : le serveur ne dit
   * jamais si l'adresse existe, donc l'application n'a rien de plus à montrer.
   */
  async existingProfile(token: string): Promise<ExistingProfile | null> {
    try {
      const { status, data } = await requestJson('/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (status !== 200) return null;

      const profil = data.profile as Record<string, unknown> | null;
      if (!profil) return null;

      return {
        firstName: asString(profil.firstName),
        neighborhoodId: asString(profil.neighborhoodId),
        ...(typeof profil.building === 'string' ? { building: profil.building } : {}),
        joinedAt: asString(profil.joinedAt, new Date().toISOString()),
        isModerator: profil.isModerator === true,
      };
    } catch {
      return null;
    }
  }

  private async demanderLien(
    chemin: string,
    email: string
  ): Promise<{ ok: boolean; emailSent: boolean }> {
    try {
      const { status, data } = await postJson(chemin, { email });
      return { ok: status === 200, emailSent: data.emailSent === true };
    } catch {
      return { ok: false, emailSent: false };
    }
  }
}
