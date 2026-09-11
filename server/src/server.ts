import express, { type Request, type Response } from 'express';
import { z } from 'zod';

import { config } from './config.js';
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

export function createServer(options?: { store?: ChallengeStore; providers?: ChannelProviders }) {
  const store = options?.store ?? new InMemoryChallengeStore();
  const providers = options?.providers ?? createChannelProviders();

  const verification = new VerificationService(store, providers, {
    length: config.otp.length,
    ttlSeconds: config.otp.ttlSeconds,
    maxAttempts: config.otp.maxAttempts,
    resendCooldownSeconds: config.otp.resendCooldownSeconds,
    maxSendsPerWindow: config.otp.maxSendsPerWindow,
    windowSeconds: config.otp.windowSeconds,
    secret: config.otpSecret,
    exposeCode: config.exposeDevCode,
  });

  const perIp = new SlidingWindowLimiter(30, 60);

  const app = express();
  app.disable('x-powered-by');
  // Derrière un reverse proxy, sans quoi toutes les requêtes partagent une IP.
  app.set('trust proxy', true);
  app.use(express.json({ limit: '8kb' }));

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
        provider: providers[channel]!.name,
      })),
      // Rend visible une configuration de développement laissée par mégarde.
      devCodeExposed: config.exposeDevCode,
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
