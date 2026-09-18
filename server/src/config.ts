import crypto from 'node:crypto';

import { aucunEnvoiReel, modeEssaiDemande } from './modeEssai.js';

/**
 * Configuration lue dans l'environnement. Les valeurs sensibles n'ont pas de
 * défaut en production : un secret de repli silencieux est pire que le
 * démarrage qui échoue.
 */

const isProduction = process.env.NODE_ENV === 'production';

/** Voir `modeEssai.ts` : porte explicite, annoncée bruyamment au démarrage. */
const trialMode = modeEssaiDemande(process.env.TRIAL_MODE);

/**
 * Vrai tant qu'aucun canal n'envoie réellement de message.
 *
 * Sert à fermer la porte du mode d'essai toute seule : le jour où des
 * identifiants Twilio ou Meta sont posés, le code cesse d'être renvoyé dans la
 * réponse, sans qu'il faille penser à retirer TRIAL_MODE — l'oubli le plus
 * probable, et le plus coûteux, puisqu'il rend la vérification décorative.
 */
const envoiMuet = aucunEnvoiReel({
  smsProvider: process.env.SMS_PROVIDER,
  emailProvider: process.env.EMAIL_PROVIDER,
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN,
});

function requiredSecret(name: string): string {
  const value = process.env[name];
  if (value && value.length >= 32) return value;

  if (isProduction) {
    throw new Error(
      `${name} doit être défini et faire au moins 32 caractères en production.`
    );
  }
  // En développement, un secret éphémère suffit : il change à chaque
  // redémarrage, ce qui invalide les jetons émis avant — sans conséquence ici.
  return crypto.randomBytes(32).toString('hex');
}

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const config = {
  isProduction,
  trialMode,
  port: intFromEnv('PORT', 4000),

  /**
   * Adresse de la base PostgreSQL. Jamais de mot de passe dans le code : la
   * chaîne entière vient de l'environnement, et ne sort jamais du serveur.
   */
  databaseUrl: process.env.DATABASE_URL ?? '',

  /** Clé de hachage des codes à usage unique. */
  otpSecret: requiredSecret('OTP_SECRET'),
  /** Clé de signature des jetons de session. */
  sessionSecret: requiredSecret('SESSION_SECRET'),

  otp: {
    /** Longueur du code envoyé par SMS. */
    length: intFromEnv('OTP_LENGTH', 6),
    /** Durée de validité d'un code, en secondes. */
    ttlSeconds: intFromEnv('OTP_TTL_SECONDS', 300),
    /** Essais autorisés avant qu'un code soit brûlé. */
    maxAttempts: intFromEnv('OTP_MAX_ATTEMPTS', 5),
    /** Délai minimal avant de pouvoir redemander un code. */
    resendCooldownSeconds: intFromEnv('OTP_RESEND_COOLDOWN_SECONDS', 60),
    /** Envois autorisés pour un même numéro par fenêtre. */
    maxSendsPerWindow: intFromEnv('OTP_MAX_SENDS_PER_WINDOW', 5),
    windowSeconds: intFromEnv('OTP_WINDOW_SECONDS', 3600),
  },

  session: {
    /** Durée de validité du jeton de session, en jours. */
    ttlDays: intFromEnv('SESSION_TTL_DAYS', 90),
  },

  sms: {
    /**
     * Canal SMS : `console` (développement), `twilio`, `http` (passerelle d'un
     * agrégateur) ou `none` pour fermer le canal SMS et n'offrir que WhatsApp.
     */
    provider: process.env.SMS_PROVIDER ?? 'console',
    senderId: process.env.SMS_SENDER_ID ?? 'Jiran',
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
      authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
      from: process.env.TWILIO_FROM ?? '',
    },
    http: {
      url: process.env.SMS_HTTP_URL ?? '',
      apiKey: process.env.SMS_HTTP_API_KEY ?? '',
      /** Noms des champs attendus par la passerelle de l'agrégateur. */
      phoneField: process.env.SMS_HTTP_PHONE_FIELD ?? 'to',
      messageField: process.env.SMS_HTTP_MESSAGE_FIELD ?? 'message',
      senderField: process.env.SMS_HTTP_SENDER_FIELD ?? 'sender',
    },
  },

  /**
   * Canal WhatsApp. Il ne s'ouvre que si ces identifiants sont renseignés — un
   * compte WhatsApp Business vérifié et un modèle « authentification »
   * approuvé par Meta sont nécessaires.
   */
  /**
   * Supabase Storage, pour les photos. La clé de service donne tous les droits
   * sur le stockage : elle reste côté serveur, et n'est jamais envoyée au
   * navigateur.
   */
  supabase: {
    url: process.env.SUPABASE_URL ?? '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY ?? '',
    bucket: process.env.SUPABASE_BUCKET ?? 'jiran-photos',
  },

  /**
   * Canal e-mail. Gratuit dans les deux formes :
   *  — `smtp` : une boîte existante (Gmail, Outlook) avec un mot de passe
   *    d'application. Rien à payer, rien à contractualiser ;
   *  — `resend` : offre gratuite de 3 000 messages par mois, sans carte.
   * `console` n'envoie rien et n'est toléré qu'en essai assumé.
   */
  email: {
    provider: (process.env.EMAIL_PROVIDER ?? 'none') as
      | 'none'
      | 'smtp'
      | 'resend'
      | 'console',
    from: process.env.EMAIL_FROM ?? '',
    subject: process.env.EMAIL_SUBJECT ?? 'Votre code Jiran',
    smtp: {
      host: process.env.EMAIL_SMTP_HOST ?? '',
      port: intFromEnv('EMAIL_SMTP_PORT', 587),
      user: process.env.EMAIL_SMTP_USER ?? '',
      pass: process.env.EMAIL_SMTP_PASS ?? '',
      // 465 est le port chiffré de bout en bout ; 587 chiffre après connexion.
      secure: (process.env.EMAIL_SMTP_SECURE ?? '') === 'true' || intFromEnv('EMAIL_SMTP_PORT', 587) === 465,
    },
    resendApiKey: process.env.RESEND_API_KEY ?? '',
  },

  whatsapp: {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? '',
    templateName: process.env.WHATSAPP_TEMPLATE_NAME ?? 'jiran_verification',
    templateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? 'fr',

    /**
     * Numéro WhatsApp de Jiran, au format international sans « + ». C'est vers
     * lui que le voisin envoie son jeton dans la vérification gratuite.
     */
    businessNumber: process.env.WHATSAPP_BUSINESS_NUMBER ?? '',
    /** Secret de l'application Meta, qui signe les webhooks entrants. */
    appSecret: process.env.WHATSAPP_APP_SECRET ?? '',
    /** Jeton choisi par vous, que Meta renvoie pour valider l'URL du webhook. */
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? '',
    /** Développement : ouvre le canal WhatsApp par modèle sans compte Meta. */
    devConsole: process.env.WHATSAPP_DEV_CONSOLE === 'true',
  },

  /**
   * Numéros des modérateurs, séparés par des virgules.
   *
   * Le cahier des charges laisse la question ouverte (§3 : « qui a le rôle
   * modérateur ? validation manuelle au départ probablement »). Une liste
   * tenue par l'équipe est la réponse la plus simple pour démarrer, et elle
   * se remplace par un vrai rôle en base sans toucher aux écrans.
   */
  moderatorPhones: (process.env.MODERATOR_PHONES ?? '')
    .split(',')
    .map((phone) => phone.trim())
    .filter(Boolean),

  /**
   * Notifications. `expo` remet réellement ; `console` se contente d'afficher,
   * et l'application prévient alors qu'aucune alerte ne part.
   */
  push: {
    provider: process.env.PUSH_PROVIDER ?? 'console',
    /** Jeton d'accès Expo, requis si le projet impose l'authentification. */
    expoAccessToken: process.env.EXPO_ACCESS_TOKEN ?? '',
  },

  /**
   * Dossier de l'application web à servir, s'il y en a un.
   *
   * Servir l'application et l'API à la même adresse permet de partager un
   * simple lien : le navigateur trouve le serveur tout seul, il n'y a rien à
   * configurer sur le téléphone du voisin.
   */
  webDir: process.env.WEB_DIR ?? '',

  /**
   * Requêtes d'authentification autorisées par minute et par adresse IP.
   *
   * En Algérie, les opérateurs mobiles partagent une même adresse publique
   * entre des milliers d'abonnés : un plafond trop bas ne punit pas un
   * attaquant, il ferme la porte à tout un quartier en même temps. Ce plafond
   * n'est donc qu'un garde-fou contre le déluge ; c'est le blocage par compte
   * — six essais, puis un quart d'heure — qui arrête celui qui cherche un mot
   * de passe.
   */
  authRequestsPerMinute: intFromEnv('AUTH_RATE_LIMIT_PER_MINUTE', 60),

  /**
   * Adresse publique du service, pour fabriquer les liens envoyés par e-mail.
   *
   * Si elle est vide, le serveur la déduit de la requête reçue. C'est juste
   * dans presque tous les cas, et ça évite une variable de plus à poser ; la
   * renseigner reste préférable dès qu'un proxy s'en mêle.
   */
  publicUrl: (process.env.PUBLIC_URL ?? '').replace(/\/+$/, ''),

  /**
   * Ménage quotidien des publications.
   *
   * Activé par défaut : c'est lui qui tient l'hébergement gratuit dans ses
   * 500 Mo. `CLEANUP_ENABLED=false` le coupe — utile pour observer une base
   * sans qu'elle bouge sous les pieds.
   */
  cleanup: {
    enabled: (process.env.CLEANUP_ENABLED ?? 'true') !== 'false',
  },

  /**
   * Origines autorisées à appeler l'API depuis un navigateur. Nécessaire pour
   * `expo start --web` ; sans objet pour l'application native, qui n'est pas
   * soumise à la politique d'origine.
   */
  corsOrigins: (process.env.CORS_ORIGINS ?? (isProduction ? '' : '*'))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  /**
   * Renvoie le code dans la réponse HTTP, ce qui revient à offrir la
   * vérification à quiconque a le lien. Réservé au développement, ou à un
   * essai explicitement assumé.
   */
  exposeDevCode:
    (!isProduction && process.env.EXPOSE_DEV_CODE === 'true') || (trialMode && envoiMuet),

  /** Vrai si le numéro n'est vérifié par aucun envoi réel — affiché dans /health. */
  verificationDecorative: trialMode && envoiMuet,
} as const;
