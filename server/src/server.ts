import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import compression from 'compression';
import express, { type Request, type Response } from 'express';
import { z } from 'zod';

import { config } from './config.js';
import { AlertService } from './content/alerts.js';
import { connecter, type Db } from './db/client.js';
import { createPhotoStorage } from './storage/photos.js';
import { CleanupService } from './maintenance/cleanupService.js';
import { planifierNettoyage } from './maintenance/scheduler.js';
import { CommunityService } from './content/community.js';
import { createCommunityRouter } from './content/communityRoutes.js';
import { GameService } from './content/games.js';
import { MediaService } from './content/media.js';
import { NotificationService } from './content/notifications.js';
import { ContentRepository } from './content/repository.js';
import { ModerationQueue } from './content/moderationQueue.js';
import { createContentRouter } from './content/routes.js';
import { AccountService } from './auth/accounts.js';
import {
  messageDeConfirmation,
  messageDeReinitialisation,
  pageDeConfirmation,
  pageDeNouveauMotDePasse,
} from './auth/emails.js';
import { LONGUEUR_MAXIMALE, LONGUEUR_MINIMALE } from './auth/password.js';
import { createPushSender, type PushSender } from './push/index.js';
import { kindOf, maskIdentifier } from './identity.js';
import { maskPhone } from './phone.js';
import { VerificationService } from './otp/service.js';
import { InMemoryChallengeStore, type ChallengeStore } from './otp/store.js';
import { SlidingWindowLimiter } from './rateLimit.js';
import { issueSessionToken, readSessionToken } from './session.js';
import {
  CHANNELS,
  createChannelProviders,
  isChannel,
  type ChannelProviders,
} from './messaging/index.js';

/**
 * Demande de code.
 *
 * `identifier` porte le numéro ou l'adresse ; `phone` reste accepté pour les
 * applications déjà installées, qui ne connaissent que ce nom. La longueur va
 * jusqu'à 254 caractères, la limite d'une adresse e-mail.
 */
const requestCodeSchema = z
  .object({
    identifier: z.string().trim().min(6).max(254).optional(),
    phone: z.string().trim().min(6).max(254).optional(),
    /** Canal souhaité ; le SMS reste le défaut si rien n'est précisé. */
    channel: z.enum(CHANNELS as [string, ...string[]]).optional(),
  })
  .refine((body) => Boolean(body.identifier ?? body.phone), {
    message: 'identifiant manquant',
  });
const verifyCodeSchema = z.object({
  challengeId: z.string().min(1).max(100),
  code: z.string().min(4).max(10),
});

const verifyLinkSchema = z.object({ challengeId: z.string().min(1).max(100) });

/**
 * Inscription par adresse et mot de passe.
 *
 * L'adresse n'est pas validée finement ici : `AccountService` s'en charge, et
 * un motif trop strict rejetterait des adresses valides et rares.
 */
const registerSchema = z.object({
  email: z.string().trim().min(6).max(254),
  password: z.string().min(LONGUEUR_MINIMALE).max(LONGUEUR_MAXIMALE),
});

const loginSchema = z.object({
  email: z.string().trim().min(6).max(254),
  password: z.string().min(1).max(LONGUEUR_MAXIMALE),
});

const emailOnlySchema = z.object({ email: z.string().trim().min(6).max(254) });

const resetSchema = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(LONGUEUR_MINIMALE).max(LONGUEUR_MAXIMALE),
});

/**
 * Sert l'application web, si elle a été construite.
 *
 * Monté après les routes de l'API pour ne rien lui prendre. Le repli sur
 * `index.html` est indispensable : l'application gère elle-même ses écrans, et
 * une adresse comme `/quartier` n'existe pas sur le disque.
 */
function serveWebApp(app: express.Express, webDir: string): void {
  if (!webDir) return;

  const dossier = path.resolve(webDir);
  const accueil = path.join(dossier, 'index.html');

  if (!fs.existsSync(accueil)) {
    console.warn(`[web] ${dossier} ne contient pas d'index.html — rien n'est servi.`);
    return;
  }

  /**
   * Les fichiers construits portent une empreinte dans leur nom
   * (`index-9e7522c3….js`) : leur contenu ne peut pas changer sans que le nom
   * change. Le navigateur peut donc les garder un an, et une deuxième
   * ouverture de Jiran ne redemande plus rien.
   *
   * `index.html`, lui, porte le nom du prochain fichier : il doit être
   * revalidé à chaque fois, sinon une mise à jour n'arriverait jamais.
   */
  app.use(
    express.static(dossier, {
      setHeaders: (response, chemin) => {
        const immuable = /\/_expo\/static\/.+-[0-9a-f]{16,}\.\w+$/.test(chemin.replace(/\\/g, '/'));
        response.setHeader(
          'Cache-Control',
          immuable ? 'public, max-age=31536000, immutable' : 'no-cache'
        );
      },
    })
  );
  app.get(/.*/, (request: Request, response: Response, next) => {
    // Une requête d'API qui n'a trouvé personne doit rester une erreur d'API,
    // pas renvoyer silencieusement la page d'accueil.
    if (request.path.startsWith('/auth') || request.path.startsWith('/webhooks')) {
      next();
      return;
    }
    response.setHeader('Cache-Control', 'no-cache');
    response.sendFile(accueil);
  });

  console.info(`[web] application servie depuis ${dossier}`);
}

/** Signature `sha256=…` posée par Meta sur le corps brut du webhook. */
function verifyMetaSignature(rawBody: Buffer | undefined, header: string | undefined): boolean {
  const secret = config.whatsapp.appSecret;
  if (!secret || !rawBody || !header?.startsWith('sha256=')) return false;

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const given = Buffer.from(header.slice(7), 'utf8');
  const wanted = Buffer.from(expected, 'utf8');
  return given.length === wanted.length && crypto.timingSafeEqual(given, wanted);
}

/** Extrait les messages texte d'une notification WhatsApp, sans rien supposer de sa forme. */
function extractTextMessages(payload: unknown): { from: string; text: string }[] {
  const messages: { from: string; text: string }[] = [];
  const entries = (payload as { entry?: unknown[] })?.entry;
  if (!Array.isArray(entries)) return messages;

  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      const value = (change as { value?: { messages?: unknown[] } })?.value;
      if (!Array.isArray(value?.messages)) continue;

      for (const message of value.messages) {
        const typed = message as { from?: unknown; text?: { body?: unknown } };
        if (typeof typed.from === 'string' && typeof typed.text?.body === 'string') {
          messages.push({ from: typed.from, text: typed.text.body });
        }
      }
    }
  }

  return messages;
}

export async function createServer(options?: {
  store?: ChallengeStore;
  providers?: ChannelProviders;
  /** Base du contenu ; par défaut celle de `DATABASE_URL`. */
  db?: Db;
  push?: PushSender;
  /** Dossier de l'application web à servir en plus de l'API. */
  webDir?: string;
  /** Plafond des requêtes d'authentification par minute et par IP. */
  authRequestsPerMinute?: number;
}) {
  const store = options?.store ?? new InMemoryChallengeStore();
  const providers = options?.providers ?? createChannelProviders();
  // Jamais de création ni de migration ici : le schéma se pose avec
  // `npm run migrate`, volontairement séparé du démarrage. Un serveur qui
  // modifie la base à chaque redémarrage est un serveur qui, un jour, l'efface.
  const database = options?.db ?? (await connecter(config.databaseUrl));
  const photoStorage = createPhotoStorage();
  const content = new ContentRepository(database);
  const push = options?.push ?? createPushSender();
  const alerts = new AlertService(database, push);
  const moderation = new ModerationQueue(database, config.moderatorPhones);
  const games = new GameService(database);
  const community = new CommunityService(database);
  const media = new MediaService(database, photoStorage);
  const notifications = new NotificationService(database);

  // Le ménage tourne dans le serveur, faute de tâche planifiée gratuite chez
  // Render. Il ne touche qu'aux publications arrivées à terme (voir
  // `maintenance/cleanupService.ts`), jamais aux comptes ni aux messages.
  if (config.cleanup.enabled && !options?.db) {
    planifierNettoyage(new CleanupService(database, photoStorage));
  }

  const comptes = new AccountService(database);

  const verification = new VerificationService(store, providers, {
    length: config.otp.length,
    ttlSeconds: config.otp.ttlSeconds,
    maxAttempts: config.otp.maxAttempts,
    resendCooldownSeconds: config.otp.resendCooldownSeconds,
    maxSendsPerWindow: config.otp.maxSendsPerWindow,
    windowSeconds: config.otp.windowSeconds,
    secret: config.otpSecret,
    exposeCode: config.exposeDevCode,
    whatsappBusinessNumber: config.whatsapp.businessNumber || undefined,
  });

  const perIp = new SlidingWindowLimiter(options?.authRequestsPerMinute ?? config.authRequestsPerMinute, 60);

  const app = express();
  app.disable('x-powered-by');

  /**
   * Compression des réponses.
   *
   * L'application pèse 1,5 Mo de JavaScript, et partait telle quelle : huit
   * secondes d'attente sur une 3G avant le premier écran. Compressée, elle
   * tombe à 350 Ko. C'est, de loin, ce qui coûtait le plus cher à un voisin
   * qui ouvre Jiran sur son forfait.
   *
   * Vaut aussi pour le fil et les messages, qui sont du JSON très répétitif.
   */
  app.use(compression());
  // Derrière un reverse proxy, sans quoi toutes les requêtes partagent une IP.
  app.set('trust proxy', true);
  // Le corps brut est conservé : la signature des webhooks Meta porte sur les
  // octets reçus, pas sur le JSON reconstruit.
  app.use(
    express.json({
      // Une photo réduite arrive en base64 : 400 Ko d'octets en pèsent ~550.
      // Le reste des requêtes tient largement dans ce qui précédait.
      limit: '800kb',
      verify: (request, _response, buffer) => {
        (request as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
      },
    })
  );

  // Partage d'origine, uniquement pour les origines déclarées.
  app.use((request: Request, response: Response, next) => {
    const origin = request.header('origin');
    const allowed = config.corsOrigins.includes('*')
      ? origin
      : origin && config.corsOrigins.includes(origin)
        ? origin
        : undefined;

    if (allowed) {
      response.set('Access-Control-Allow-Origin', allowed);
      response.set('Vary', 'Origin');
      response.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      response.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }

    if (request.method === 'OPTIONS') {
      response.sendStatus(allowed ? 204 : 403);
      return;
    }
    next();
  });

  app.get('/health', (_request: Request, response: Response) => {
    response.json({
      status: 'ok',
      channels: verification.channels.map((channel) => ({
        channel,
        // Le canal gratuit n'a pas de fournisseur : rien n'est envoyé.
        provider: providers[channel]?.name ?? 'inbound',
      })),
      // Rend visible une configuration de développement laissée par mégarde.
      devCodeExposed: config.exposeDevCode,
      trialMode: config.trialMode,
      verificationDecorative: config.verificationDecorative,
      push: { provider: push.name, delivers: push.delivers },
      // De quoi vérifier d'un coup d'œil qu'un déploiement est bien branché,
      // sans jamais rien révéler de l'adresse ni des clés.
      database: { configured: Boolean(config.databaseUrl) },
      // Les comptes par mot de passe existent toujours ; ce qui varie, c'est
      // la capacité d'envoyer le lien qui les active.
      emailAccounts: { enabled: true, canSendLinks: Boolean(providers.email) },
      photos: { storage: photoStorage ? 'supabase' : 'base' },
    });
  });

  app.use('/auth', (request: Request, response: Response, next) => {
    if (perIp.take(request.ip ?? 'inconnu')) return next();
    response.status(429).json({ error: 'rate_limited' });
  });

  /** Canaux proposés à l'inscription — l'application n'affiche que ceux-ci. */
  app.get('/auth/channels', (_request: Request, response: Response) => {
    response.json({ channels: verification.channels });
  });

  app.post('/auth/request-code', async (request: Request, response: Response) => {
    const parsed = requestCodeSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'invalid_phone' });
      return;
    }

    const channel = isChannel(parsed.data.channel) ? parsed.data.channel : 'sms';
    const identifiant = parsed.data.identifier ?? parsed.data.phone!;
    const result = await verification.requestCode(identifiant, channel);

    if (result.ok) {
      response.json(result);
      return;
    }

    switch (result.reason) {
      case 'invalid_phone':
      case 'channel_unavailable':
        response.status(400).json({ error: result.reason });
        return;
      case 'cooldown':
      case 'rate_limited':
        response
          .set('Retry-After', String(result.retryAfterSeconds))
          .status(429)
          .json({ error: result.reason, retryAfterSeconds: result.retryAfterSeconds });
        return;
      case 'sms_failed':
        response.status(502).json({ error: result.reason });
        return;
    }
  });

  // --- Comptes par adresse e-mail et mot de passe ----------------------
  //
  // Le parcours par téléphone garde le sien, sans mot de passe : un code reçu,
  // et c'est tout. Les deux aboutissent au même endroit — un identifiant
  // vérifié, qui possède le compte et son historique en base.

  /** Adresse publique du service, pour fabriquer un lien ouvrable. */
  const adressePublique = (request: Request): string => {
    if (config.publicUrl) return config.publicUrl;
    // Derrière le proxy de Render, `protocol` suit X-Forwarded-Proto grâce à
    // `trust proxy` ; l'en-tête Host porte le vrai domaine.
    return `${request.protocol}://${request.get('host') ?? 'localhost'}`;
  };

  const lienDeConfirmation = (request: Request, jeton: string, but: 'confirmation' | 'reset') =>
    `${adressePublique(request)}/auth/${but === 'confirmation' ? 'confirm' : 'reset'}?token=${encodeURIComponent(jeton)}`;

  /**
   * Envoie le lien, et dit si le canal e-mail est seulement décoratif.
   *
   * Sans fournisseur d'e-mail configuré, rien ne part — comme pour les codes.
   * On le dit à l'application plutôt que de la laisser afficher « regarde ta
   * boîte » devant une boîte qui ne recevra jamais rien.
   */
  const envoyerLien = async (
    request: Request,
    lien: { identifier: string; but: 'confirmation' | 'reset'; jeton: string }
  ): Promise<{ envoye: boolean; lienDev?: string }> => {
    const url = lienDeConfirmation(request, lien.jeton, lien.but);
    const message =
      lien.but === 'confirmation' ? messageDeConfirmation(url) : messageDeReinitialisation(url);

    const fournisseur = providers.email;
    if (!fournisseur) {
      console.warn(
        `[auth] aucun fournisseur e-mail : lien ${lien.but} non envoyé à ${maskIdentifier(lien.identifier)}`
      );
      // Même porte que pour les codes à usage unique : en essai assumé, le lien
      // est rendu pour pouvoir avancer sans boîte aux lettres. Elle se referme
      // d'elle-même dès qu'un vrai fournisseur est posé.
      return { envoye: false, ...(config.exposeDevCode ? { lienDev: url } : {}) };
    }

    try {
      await fournisseur.send({ to: lien.identifier, message });
      return { envoye: true };
    } catch (error) {
      console.error(`[auth] envoi du lien ${lien.but} impossible`, error);
      return { envoye: false };
    }
  };

  /**
   * Crée un compte, ou reprend une inscription non confirmée.
   *
   * La réponse est la même dans tous les cas où rien n'a échoué, adresse déjà
   * prise comprise : sinon, essayer des adresses jusqu'à voir la réponse
   * changer dirait qui habite le quartier.
   */
  app.post('/auth/register', async (request: Request, response: Response) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      const faible = parsed.error.issues.some((issue) => issue.path[0] === 'password');
      response.status(400).json({ error: faible ? 'mot_de_passe_trop_court' : 'invalid_request' });
      return;
    }

    const résultat = await comptes.inscrire(parsed.data.email, parsed.data.password);
    if (!résultat.ok) {
      response.status(400).json({ error: résultat.raison });
      return;
    }

    // Pas de lien : l'adresse a déjà un compte confirmé. On ne le dit pas.
    if (!résultat.lien) {
      response.status(201).json({ ok: true, emailSent: Boolean(providers.email) });
      return;
    }

    const envoi = await envoyerLien(request, résultat.lien);
    console.info(`[auth] inscription : ${maskIdentifier(résultat.lien.identifier)}`);
    response.status(201).json({ ok: true, emailSent: envoi.envoye, ...(envoi.lienDev ? { devLink: envoi.lienDev } : {}) });
  });

  /** Ouvre le lien reçu par e-mail. Répond une page, pas du JSON. */
  app.get('/auth/confirm', async (request: Request, response: Response) => {
    const jeton = typeof request.query.token === 'string' ? request.query.token : '';
    const résultat = jeton
      ? await comptes.confirmer(jeton)
      : ({ ok: false, raison: 'jeton_inconnu' } as const);

    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Un lien de confirmation ne doit jamais être gardé par un cache
    // intermédiaire : il ne sert qu'une fois, et il est personnel.
    response.setHeader('Cache-Control', 'no-store');

    if (résultat.ok) {
      console.info(`[auth] adresse confirmée : ${maskIdentifier(résultat.identifier)}`);
      response.status(200).send(
        pageDeConfirmation({
          titre: 'Adresse confirmée',
          message: 'Ton compte est prêt. Tu peux revenir sur Jiran et te connecter.',
          réussi: true,
          lienApplication: adressePublique(request),
        })
      );
      return;
    }

    const messages: Record<string, { titre: string; message: string }> = {
      jeton_expire: {
        titre: 'Lien périmé',
        message:
          "Ce lien avait 24 heures pour servir. Retourne sur Jiran et demande-en un nouveau.",
      },
      jeton_deja_utilise: {
        titre: 'Lien déjà utilisé',
        message: 'Ton adresse est sans doute déjà confirmée : essaie simplement de te connecter.',
      },
      jeton_inconnu: {
        titre: 'Lien invalide',
        message: "Ce lien ne correspond à rien. Vérifie qu'il a été copié en entier.",
      },
    };
    const texte = messages[résultat.raison] ?? messages.jeton_inconnu!;
    response.status(400).send(
      pageDeConfirmation({ ...texte, réussi: false, lienApplication: adressePublique(request) })
    );
  });

  /** Page du lien de réinitialisation : deux champs, aucune application requise. */
  app.get('/auth/reset', (request: Request, response: Response) => {
    const jeton = typeof request.query.token === 'string' ? request.query.token : '';
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');

    if (!jeton) {
      response.status(400).send(
        pageDeConfirmation({
          titre: 'Lien invalide',
          message: "Ce lien ne correspond à rien. Vérifie qu'il a été copié en entier.",
          réussi: false,
        })
      );
      return;
    }

    response.send(pageDeNouveauMotDePasse(jeton, LONGUEUR_MINIMALE));
  });

  app.post('/auth/login', async (request: Request, response: Response) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'invalid_request' });
      return;
    }

    const résultat = await comptes.connecter(parsed.data.email, parsed.data.password);
    if (!résultat.ok) {
      const codes = {
        identifiants_refuses: 401,
        adresse_non_confirmee: 403,
        compte_bloque: 429,
      } as const;
      response.status(codes[résultat.raison]).json({ error: résultat.raison });
      return;
    }

    console.info(`[auth] connexion : ${maskIdentifier(résultat.identifier)}`);
    response.json({
      phone: résultat.identifier,
      identifier: résultat.identifier,
      identifierKind: kindOf(résultat.identifier),
      token: issueSessionToken(résultat.identifier, config.sessionSecret, config.session.ttlDays),
    });
  });

  /** Renvoie un lien de confirmation. Réponse identique, adresse connue ou non. */
  app.post('/auth/resend-confirmation', async (request: Request, response: Response) => {
    const parsed = emailOnlySchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'invalid_request' });
      return;
    }

    const lien = await comptes.renvoyerConfirmation(parsed.data.email);
    const envoi = lien ? await envoyerLien(request, lien) : { envoye: false as boolean };
    response.json({ ok: true, emailSent: envoi.envoye, ...('lienDev' in envoi && envoi.lienDev ? { devLink: envoi.lienDev } : {}) });
  });

  app.post('/auth/forgot-password', async (request: Request, response: Response) => {
    const parsed = emailOnlySchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'invalid_request' });
      return;
    }

    const lien = await comptes.demanderReinitialisation(parsed.data.email);
    const envoi = lien ? await envoyerLien(request, lien) : { envoye: false as boolean };
    response.json({ ok: true, emailSent: envoi.envoye, ...('lienDev' in envoi && envoi.lienDev ? { devLink: envoi.lienDev } : {}) });
  });

  app.post('/auth/reset-password', async (request: Request, response: Response) => {
    const parsed = resetSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'invalid_request' });
      return;
    }

    const résultat = await comptes.reinitialiser(parsed.data.token, parsed.data.password);
    if (!résultat.ok) {
      response.status(400).json({ error: résultat.raison });
      return;
    }

    console.info(`[auth] mot de passe changé : ${maskIdentifier(résultat.identifier)}`);
    response.json({
      identifier: résultat.identifier,
      identifierKind: kindOf(résultat.identifier),
      token: issueSessionToken(résultat.identifier, config.sessionSecret, config.session.ttlDays),
    });
  });

  app.post('/auth/verify-code', async (request: Request, response: Response) => {
    const parsed = verifyCodeSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'invalid_request' });
      return;
    }

    const result = await verification.verifyCode(parsed.data.challengeId, parsed.data.code);

    if (result.ok) {
      console.info(`[auth] identifiant vérifié : ${maskIdentifier(result.identifier)}`);
      response.json({
        // `phone` reste le nom du champ pour ne pas casser les applications
        // déjà installées ; `identifier` est le nom juste, e-mail compris.
        phone: result.identifier,
        identifier: result.identifier,
        identifierKind: kindOf(result.identifier),
        token: issueSessionToken(result.identifier, config.sessionSecret, config.session.ttlDays),
      });
      return;
    }

    switch (result.reason) {
      case 'invalid_code':
        response.status(401).json({ error: result.reason, attemptsLeft: result.attemptsLeft });
        return;
      case 'too_many_attempts':
        response.status(429).json({ error: result.reason });
        return;
      default:
        response.status(410).json({ error: result.reason });
    }
  });

  /**
   * Relève du défi « lien WhatsApp ». L'application interroge cette route en
   * boucle pendant que le voisin envoie son message ; `202` tant que rien n'est
   * arrivé.
   */
  app.post('/auth/verify-link', async (request: Request, response: Response) => {
    const parsed = verifyLinkSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'invalid_request' });
      return;
    }

    const result = await verification.claimLink(parsed.data.challengeId);

    if (result.ok) {
      console.info(`[auth] numéro vérifié par WhatsApp : ${maskPhone(result.identifier)}`);
      response.json({
        phone: result.identifier,
        identifier: result.identifier,
        identifierKind: 'phone',
        token: issueSessionToken(result.identifier, config.sessionSecret, config.session.ttlDays),
      });
      return;
    }

    if (result.reason === 'pending') {
      response.status(202).json({ status: 'pending' });
      return;
    }
    response.status(410).json({ error: result.reason });
  });

  /**
   * Validation de l'URL du webhook par Meta, à la configuration de
   * l'application.
   */
  app.get('/webhooks/whatsapp', (request: Request, response: Response) => {
    const mode = request.query['hub.mode'];
    const token = request.query['hub.verify_token'];
    const challenge = request.query['hub.challenge'];

    const expected = config.whatsapp.verifyToken;
    if (mode === 'subscribe' && expected && token === expected) {
      response.status(200).send(String(challenge ?? ''));
      return;
    }
    response.sendStatus(403);
  });

  /**
   * Messages entrants WhatsApp.
   *
   * La signature est contrôlée avant toute lecture : sans elle, n'importe qui
   * connaissant l'URL pourrait déclarer n'importe quel numéro vérifié.
   */
  app.post('/webhooks/whatsapp', async (request: Request, response: Response) => {
    const rawBody = (request as Request & { rawBody?: Buffer }).rawBody;
    if (!verifyMetaSignature(rawBody, request.header('x-hub-signature-256'))) {
      response.sendStatus(403);
      return;
    }

    // Meta réessaie tant qu'il n'a pas reçu 200 : on accuse réception tout de
    // suite, le traitement n'a pas à le faire attendre.
    response.sendStatus(200);

    for (const message of extractTextMessages(request.body)) {
      await verification.confirmLink(message.text, message.from);
    }
  });

  app.use(createContentRouter(content, alerts, moderation, games, media, notifications));
  app.use(createCommunityRouter(community, content, notifications));

  serveWebApp(app, options?.webDir ?? config.webDir);

  /**
   * Contrôle qu'un jeton est encore valable, à qui il correspond, et si un
   * profil existe déjà pour lui.
   *
   * Ce dernier point est ce qui permet à un voisin qui se reconnecte depuis un
   * autre téléphone de retomber directement dans son quartier, au lieu de
   * redéclarer son prénom, son quartier et de relire les règles — qu'il a déjà
   * acceptées.
   */
  app.get('/auth/me', async (request: Request, response: Response) => {
    const header = request.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const identifier = token ? readSessionToken(token, config.sessionSecret) : null;

    if (!identifier) {
      response.status(401).json({ error: 'invalid_token' });
      return;
    }
    const membre = await content.findMemberByIdentifier(identifier);

    // `phone` reste là pour les applications déjà installées.
    response.json({
      phone: identifier,
      identifier,
      identifierKind: kindOf(identifier),
      profile: membre
        ? {
            firstName: membre.firstName,
            neighborhoodId: membre.neighborhoodId,
            building: membre.building,
            joinedAt: membre.joinedAt,
            isModerator: await moderation.isModerator(membre.identifier),
          }
        : null,
    });
  });

  /**
   * Dernier filet. Express 5 dirige ici les échecs des gestionnaires
   * asynchrones : sans lui, une base momentanément injoignable renverrait une
   * page HTML d'erreur à une application qui attend du JSON.
   */
  app.use((error: Error, _request: Request, response: Response, _next: () => void) => {
    console.error('[http] requête en échec', error);
    if (response.headersSent) return;
    response.status(500).json({ error: 'server_error' });
  });

  return app;
}
