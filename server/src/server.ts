import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import express, { type Request, type Response } from 'express';
import { z } from 'zod';

import { config } from './config.js';
import { AlertService } from './content/alerts.js';
import { openDatabase } from './content/db.js';
import { CommunityService } from './content/community.js';
import { createCommunityRouter } from './content/communityRoutes.js';
import { GameService } from './content/games.js';
import { MediaService } from './content/media.js';
import { ContentRepository } from './content/repository.js';
import { ModerationQueue } from './content/moderationQueue.js';
import { createContentRouter } from './content/routes.js';
import { createPushSender, type PushSender } from './push/index.js';
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

const requestCodeSchema = z.object({
  phone: z.string().min(6).max(20),
  /** Canal souhaité ; le SMS reste le défaut si rien n'est précisé. */
  channel: z.enum(CHANNELS as [string, ...string[]]).optional(),
});
const verifyCodeSchema = z.object({
  challengeId: z.string().min(1).max(100),
  code: z.string().min(4).max(10),
});

const verifyLinkSchema = z.object({ challengeId: z.string().min(1).max(100) });

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

  app.use(express.static(dossier));
  app.get(/.*/, (request: Request, response: Response, next) => {
    // Une requête d'API qui n'a trouvé personne doit rester une erreur d'API,
    // pas renvoyer silencieusement la page d'accueil.
    if (request.path.startsWith('/auth') || request.path.startsWith('/webhooks')) {
      next();
      return;
    }
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

export function createServer(options?: {
  store?: ChallengeStore;
  providers?: ChannelProviders;
  /** Base du contenu ; par défaut celle de `DATABASE_PATH`. */
  databasePath?: string;
  push?: PushSender;
  /** Dossier de l'application web à servir en plus de l'API. */
  webDir?: string;
}) {
  const store = options?.store ?? new InMemoryChallengeStore();
  const providers = options?.providers ?? createChannelProviders();
  const database = openDatabase(options?.databasePath ?? config.databasePath);
  const content = new ContentRepository(database);
  const push = options?.push ?? createPushSender();
  const alerts = new AlertService(database, push);
  const moderation = new ModerationQueue(database, config.moderatorPhones);
  const games = new GameService(database);
  const community = new CommunityService(database);
  const media = new MediaService(database);

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

  const perIp = new SlidingWindowLimiter(30, 60);

  const app = express();
  app.disable('x-powered-by');
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
      push: { provider: push.name, delivers: push.delivers },
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
    const result = await verification.requestCode(parsed.data.phone, channel);

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

  app.post('/auth/verify-code', async (request: Request, response: Response) => {
    const parsed = verifyCodeSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'invalid_request' });
      return;
    }

    const result = await verification.verifyCode(parsed.data.challengeId, parsed.data.code);

    if (result.ok) {
      console.info(`[auth] numéro vérifié : ${maskPhone(result.phone)}`);
      response.json({
        phone: result.phone,
        token: issueSessionToken(result.phone, config.sessionSecret, config.session.ttlDays),
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
      console.info(`[auth] numéro vérifié par WhatsApp : ${maskPhone(result.phone)}`);
      response.json({
        phone: result.phone,
        token: issueSessionToken(result.phone, config.sessionSecret, config.session.ttlDays),
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

  app.use(createContentRouter(content, alerts, moderation, games, media));
  app.use(createCommunityRouter(community, content));

  serveWebApp(app, options?.webDir ?? config.webDir);

  /** Contrôle qu'un jeton est encore valable, et à quel numéro il correspond. */
  app.get('/auth/me', (request: Request, response: Response) => {
    const header = request.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const phone = token ? readSessionToken(token, config.sessionSecret) : null;

    if (!phone) {
      response.status(401).json({ error: 'invalid_token' });
      return;
    }
    response.json({ phone });
  });

  return app;
}
