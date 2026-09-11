import crypto from 'node:crypto';

/**
 * Configuration lue dans l'environnement. Les valeurs sensibles n'ont pas de
 * défaut en production : un secret de repli silencieux est pire que le
 * démarrage qui échoue.
 */

const isProduction = process.env.NODE_ENV === 'production';

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
  port: intFromEnv('PORT', 4000),

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
  whatsapp: {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? '',
    templateName: process.env.WHATSAPP_TEMPLATE_NAME ?? 'jiran_verification',
    templateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? 'fr',
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
   * Renvoie le code dans la réponse HTTP. Réservé au développement et refusé
   * en production : ce serait offrir la vérification à n'importe qui.
   */
  exposeDevCode: !isProduction && process.env.EXPOSE_DEV_CODE === 'true',
} as const;
