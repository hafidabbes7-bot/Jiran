import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';

import { config } from '../config.js';
import { readSessionToken } from '../session.js';
import type { AlertService } from './alerts.js';
import { GAME_KINDS, type GameError, type GameService } from './games.js';
import {
  NOTIFICATION_KINDS,
  type NotificationKind,
  type NotificationService,
} from './notifications.js';
import {
  MAX_PHOTO_BYTES,
  PHOTO_TYPES,
  type MediaError,
  type MediaService,
} from './media.js';
import type { ModerationQueue } from './moderationQueue.js';
import { findNeighborhood } from './neighborhoods.js';
import { CATEGORIES, type ContentRepository, type Member } from './repository.js';
import { moderateText } from './textModeration.js';

const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(40),
  neighborhoodId: z.string().min(1).max(60),
  building: z.string().trim().max(80).optional(),
});

const postSchema = z.object({
  category: z.enum(CATEGORIES as [string, ...string[]]),
  text: z.string().trim().min(3).max(2000),
  photoId: z.string().min(10).max(60).optional(),
});

const commentSchema = z.object({ text: z.string().trim().min(2).max(1000) });
const likeSchema = z.object({ liked: z.boolean() });
const reportSchema = z.object({
  reason: z.enum(['spam', 'inapproprie', 'fausse_alerte', 'autre']),
});

const photoSchema = z.object({
  mime: z.enum(PHOTO_TYPES as unknown as [string, ...string[]]),
  data: z.string().min(10),
});

const storySchema = z.object({
  photoId: z.string().min(10).max(60).optional(),
  text: z.string().trim().min(1).max(300).optional(),
});

const deviceSchema = z.object({
  token: z.string().trim().min(10).max(300),
  platform: z.enum(['ios', 'android', 'web']),
});

const decisionSchema = z.object({
  decision: z.enum(['block', 'restore']),
  note: z.string().trim().max(500).optional(),
});

const gameSchema = z.object({ kind: z.enum(GAME_KINDS as unknown as [string, ...string[]]) });
const moveSchema = z.object({ cell: z.number().int().min(0).max(8) });

const sosSchema = z.object({
  neighborIds: z.array(z.string().min(1).max(60)).min(1).max(50),
  position: z
    .object({ latitude: z.number(), longitude: z.number() })
    .optional(),
});

/** Requête portant le membre reconnu par son jeton de session. */
export type MemberRequest = Request & { member?: Member };

/**
 * Routes du contenu de quartier.
 *
 * Chaque appel est rattaché à un membre par son jeton de session : le numéro
 * vient du jeton signé, jamais du corps de la requête, et le quartier vient du
 * membre. Un client modifié ne peut donc ni publier au nom d'un autre, ni lire
 * le fil d'un quartier où il n'habite pas.
 */
/**
 * Reconnaît le voisin ; 401 si le jeton manque ou ne vaut rien.
 *
 * Posé route par route, et non sur un routeur entier : monté à la racine, il
 * s'appliquerait aussi aux routes de vérification, qui doivent rester ouvertes
 * à un voisin qui n'a pas encore de profil.
 */
export function memberAuthenticator(repository: ContentRepository) {
  return (request: MemberRequest, response: Response, next: () => void) => {
    const header = request.header('authorization') ?? '';
    // Le jeton passe aussi en paramètre d'adresse : une balise <img> ne sait
    // pas poser d'en-tête, et c'est comme ça que les photos s'affichent.
    const requête = typeof request.query.t === 'string' ? request.query.t : '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : requête;
    const identifier = token ? readSessionToken(token, config.sessionSecret) : null;

    if (!identifier) {
      response.status(401).json({ error: 'invalid_token' });
      return;
    }

    const member = repository.findMemberByIdentifier(identifier);
    if (!member) {
      // Numéro vérifié mais profil pas encore créé : l'application doit
      // d'abord appeler POST /profile.
      response.status(403).json({ error: 'profile_required' });
      return;
    }

    request.member = member;
    next();
  };
}

export function createContentRouter(
  repository: ContentRepository,
  alerts: AlertService,
  moderation: ModerationQueue,
  games: GameService,
  media: MediaService,
  notifications: NotificationService
): Router {
  const router = express.Router();

  const authenticate = memberAuthenticator(repository);

  /** Crée ou met à jour le profil du voisin vérifié. */
  router.post('/profile', (request: MemberRequest, response: Response) => {
    const header = request.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const identifier = token ? readSessionToken(token, config.sessionSecret) : null;

    if (!identifier) {
      response.status(401).json({ error: 'invalid_token' });
      return;
    }

    const parsed = profileSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'invalid_request' });
      return;
    }

    if (!findNeighborhood(parsed.data.neighborhoodId)) {
      response.status(400).json({ error: 'unknown_neighborhood' });
      return;
    }

    const member = repository.saveMember({ identifier, ...parsed.data });
    response.json({
      id: member.id,
      firstName: member.firstName,
      neighborhoodId: member.neighborhoodId,
      building: member.building,
      joinedAt: member.joinedAt,
      // L'application n'affiche l'entrée « Modération » qu'à ceux qui en ont
      // l'usage ; c'est le serveur qui tranche, le drapeau n'ouvre aucun droit.
      isModerator: moderation.isModerator(member.identifier),
    });
  });

  router.get('/feed', authenticate, (request: MemberRequest, response: Response) => {
    response.json({ posts: repository.feed(request.member!) });
  });

  router.get('/neighbors', authenticate, (request: MemberRequest, response: Response) => {
    response.json({ neighbors: repository.neighbors(request.member!) });
  });

  router.post('/posts', authenticate, (request: MemberRequest, response: Response) => {
    const parsed = postSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'invalid_request' });
      return;
    }

    // Le filtre tourne aussi dans l'application, pour prévenir pendant la
    // frappe ; c'est ce contrôle-ci qui fait foi.
    const check = moderateText(parsed.data.text);
    if (!check.clean) {
      response.status(422).json({ error: 'inappropriate_text' });
      return;
    }

    const member = request.member!;
    // Une photo jointe doit être celle de l'auteur : sans ce contrôle, un
    // client modifié pourrait accrocher la photo d'un voisin à sa publication.
    if (parsed.data.photoId && !media.ownsPhoto(member, parsed.data.photoId)) {
      response.status(404).json({ error: 'photo_introuvable' });
      return;
    }

    const id = repository.createPost(member, {
      category: parsed.data.category as never,
      text: parsed.data.text,
      photoId: parsed.data.photoId,
    });
    response.status(201).json({ id });

    // Le quartier est prévenu, chacun selon la catégorie qui l'intéresse
    // (§4.17). L'auteur ne se prévient pas lui-même.
    const catégorie = parsed.data.category as string;
    if (catégorie === 'securite' || catégorie === 'annonce' || catégorie === 'evenement') {
      const voisins = repository
        .memberIdsOfFeed(member)
        .filter((autre) => autre !== member.id);
      const titres: Record<string, string> = {
        securite: `🚨 Alerte sécurité de ${member.firstName}`,
        annonce: `📢 Nouvelle annonce de ${member.firstName}`,
        evenement: `📅 ${member.firstName} annonce un événement`,
      };
      notifications.notify(
        voisins,
        catégorie as NotificationKind,
        titres[catégorie]!,
        parsed.data.text.slice(0, 120),
        id
      );
    }

    // Une alerte de sécurité doit arriver tout de suite, même application
    // fermée (§7.7). L'envoi ne retarde pas la réponse : la publication est
    // déjà enregistrée.
    if (parsed.data.category === 'securite') {
      alerts
        .announceSecurityPost(member, id, parsed.data.text)
        .catch((error) => console.error('[push] annonce sécurité impossible', error));
    }
  });

  router.post('/posts/:id/like', authenticate, (request: MemberRequest, response: Response) => {
    const parsed = likeSchema.safeParse(request.body);
    const postId = String(request.params.id);

    if (!parsed.success || !repository.postExists(postId)) {
      response.status(parsed.success ? 404 : 400).json({ error: 'invalid_request' });
      return;
    }

    repository.setLiked(postId, request.member!, parsed.data.liked);
    response.sendStatus(204);
  });

  router.get(
    '/posts/:id/comments',
    authenticate,
    (request: MemberRequest, response: Response) => {
    const postId = String(request.params.id);
    if (!repository.postExists(postId)) {
      response.status(404).json({ error: 'not_found' });
      return;
    }
      response.json({ comments: repository.comments(postId) });
    }
  );

  router.post(
    '/posts/:id/comments',
    authenticate,
    (request: MemberRequest, response: Response) => {
    const parsed = commentSchema.safeParse(request.body);
    const postId = String(request.params.id);

    if (!parsed.success) {
      response.status(400).json({ error: 'invalid_request' });
      return;
    }
    if (!repository.postExists(postId)) {
      response.status(404).json({ error: 'not_found' });
      return;
    }

    if (!moderateText(parsed.data.text).clean) {
      response.status(422).json({ error: 'inappropriate_text' });
      return;
    }

    // Répondre sous un contenu masqué n'a pas de sens : il n'est plus lisible.
    if (repository.moderationOf(postId).hidden) {
      response.status(409).json({ error: 'post_blocked' });
      return;
    }

      const member = request.member!;
      const id = repository.addComment(postId, member, parsed.data.text);
      response.status(201).json({ id });

      // L'auteur de la publication est prévenu — sauf s'il se répond à
      // lui-même, ce qui n'apprendrait rien à personne.
      const auteur = repository.authorOf(postId);
      if (auteur && auteur !== member.id) {
        notifications.notify(
          [auteur],
          'reponse',
          `${member.firstName} a répondu à ta publication`,
          parsed.data.text.slice(0, 120),
          postId
        );
      }
    }
  );

  router.post('/posts/:id/report', authenticate, (request: MemberRequest, response: Response) => {
    const parsed = reportSchema.safeParse(request.body);
    const postId = String(request.params.id);

    if (!parsed.success) {
      response.status(400).json({ error: 'invalid_request' });
      return;
    }
    if (!repository.postExists(postId)) {
      response.status(404).json({ error: 'not_found' });
      return;
    }

    const accepted = repository.addReport(postId, request.member!, parsed.data.reason);
    response.status(accepted ? 201 : 409).json({
      accepted,
      moderation: repository.moderationOf(postId),
    });
  });

  /** Réserve une route aux modérateurs déclarés. */
  const requireModerator = (request: MemberRequest, response: Response, next: () => void) => {
    if (!moderation.isModerator(request.member!.identifier)) {
      response.status(403).json({ error: 'not_moderator' });
      return;
    }
    next();
  };

  /** File des contenus signalés du quartier (§7.4). */
  router.get(
    '/moderation/queue',
    authenticate,
    requireModerator,
    (request: MemberRequest, response: Response) => {
      response.json({ posts: moderation.pending(request.member!) });
    }
  );

  /** Décision d'un modérateur : bloquer, ou rétablir un contenu masqué à tort. */
  router.post(
    '/moderation/posts/:id/decision',
    authenticate,
    requireModerator,
    (request: MemberRequest, response: Response) => {
      const parsed = decisionSchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({ error: 'invalid_request' });
        return;
      }

      const postId = String(request.params.id);
      const applied = moderation.decide(
        request.member!,
        postId,
        parsed.data.decision,
        parsed.data.note
      );

      if (!applied) {
        response.status(404).json({ error: 'not_found' });
        return;
      }

      response.json({ moderation: repository.moderationOf(postId) });
    }
  );

  /** Enregistre l'appareil, pour pouvoir joindre ce voisin. */
  router.post('/devices', authenticate, (request: MemberRequest, response: Response) => {
    const parsed = deviceSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'invalid_request' });
      return;
    }

    alerts.registerDevice(request.member!, parsed.data.token, parsed.data.platform);
    response.sendStatus(204);
  });

  router.delete('/devices', authenticate, (request: MemberRequest, response: Response) => {
    const parsed = deviceSchema.pick({ token: true }).safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'invalid_request' });
      return;
    }

    alerts.forgetDevice(parsed.data.token);
    response.sendStatus(204);
  });

  /** Déclenche une alerte SOS vers les voisins de confiance choisis (§4.16). */
  router.post('/sos', authenticate, async (request: MemberRequest, response: Response) => {
    const parsed = sosSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'invalid_request' });
      return;
    }

    const result = await alerts.triggerSos(
      request.member!,
      parsed.data.neighborIds,
      parsed.data.position
    );

    if (result.alerted === 0) {
      // Aucun destinataire retenu : le dire franchement plutôt que d'afficher
      // une confirmation trompeuse sur un bouton d'urgence.
      response.status(422).json({ error: 'no_reachable_neighbor' });
      return;
    }

    // Le bandeau rouge s'affiche déjà chez les voisins choisis ; la
    // notification permet de le retrouver plus tard, avec l'heure.
    notifications.notify(
      parsed.data.neighborIds,
      'sos',
      `🚨 ${request.member!.firstName} a demandé de l'aide`,
      request.member!.building ?? '',
      result.alertId
    );

    response.status(201).json(result);
  });

  router.get('/sos/active', authenticate, (request: MemberRequest, response: Response) => {
    response.json({ alerts: alerts.activeSos(request.member!) });
  });

  router.post(
    '/sos/:id/cancel',
    authenticate,
    async (request: MemberRequest, response: Response) => {
      const cancelled = await alerts.cancelSos(request.member!, String(request.params.id));
      response.status(cancelled ? 200 : 404).json({ cancelled });
    }
  );

  // --- Jeux entre voisins (§4.8) ---------------------------------------

  /** Traduit un refus du service en code HTTP : le client n'invente rien. */
  const gameStatus = (error: GameError): number => {
    if (error === 'partie_inconnue') return 404;
    if (error === 'pas_ta_partie') return 403;
    return 409;
  };

  router.get('/games', authenticate, (request: MemberRequest, response: Response) => {
    response.json({ games: games.list(request.member!) });
  });

  router.post('/games', authenticate, (request: MemberRequest, response: Response) => {
    const parsed = gameSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'invalid_request' });
      return;
    }

    response.status(201).json({ game: games.create(request.member!, parsed.data.kind as 'morpion') });
  });

  router.post('/games/:id/join', authenticate, (request: MemberRequest, response: Response) => {
    const result = games.join(request.member!, String(request.params.id));
    if (typeof result === 'string') {
      response.status(gameStatus(result)).json({ error: result });
      return;
    }

    response.json({ game: result });
  });

  router.post('/games/:id/move', authenticate, (request: MemberRequest, response: Response) => {
    const parsed = moveSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'invalid_request' });
      return;
    }

    const result = games.play(request.member!, String(request.params.id), parsed.data.cell);
    if (typeof result === 'string') {
      response.status(gameStatus(result)).json({ error: result });
      return;
    }

    response.json({ game: result });
  });

  // --- Notifications (§4.17) -------------------------------------------

  router.get('/notifications', authenticate, (request: MemberRequest, response: Response) => {
    response.json({
      notifications: notifications.list(request.member!),
      unread: notifications.unread(request.member!),
    });
  });

  router.post('/notifications/read', authenticate, (request: MemberRequest, response: Response) => {
    const id = typeof request.body?.id === 'string' ? request.body.id : undefined;
    notifications.markRead(request.member!, id);
    response.json({ unread: notifications.unread(request.member!) });
  });

  // --- Photos et stories -----------------------------------------------

  const mediaStatus = (error: MediaError): number => {
    if (error === 'introuvable') return 404;
    if (error === 'trop_lourde') return 413;
    if (error === 'format_refuse') return 415;
    return 422;
  };

  router.post('/photos', authenticate, (request: MemberRequest, response: Response) => {
    const parsed = photoSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'invalid_request' });
      return;
    }

    // Le base64 pèse un tiers de plus que les octets : on refuse avant de
    // décoder, pour ne pas se faire remplir la mémoire par une seule requête.
    if (parsed.data.data.length > MAX_PHOTO_BYTES * 1.4) {
      response.status(413).json({ error: 'trop_lourde' });
      return;
    }

    const bytes = Buffer.from(parsed.data.data, 'base64');
    const result = media.savePhoto(request.member!, parsed.data.mime, bytes);
    if (typeof result === 'string') {
      response.status(mediaStatus(result)).json({ error: result });
      return;
    }

    response.status(201).json({ id: result.id });
  });

  router.get('/photos/:id', authenticate, (request: MemberRequest, response: Response) => {
    const result = media.photo(request.member!, String(request.params.id));
    if (typeof result === 'string') {
      response.status(mediaStatus(result)).json({ error: result });
      return;
    }

    // Une photo ne change jamais : le navigateur peut la garder longtemps.
    response.setHeader('Content-Type', result.mime);
    response.setHeader('Cache-Control', 'private, max-age=604800, immutable');
    response.end(Buffer.from(result.bytes));
  });

  router.get('/stories', authenticate, (request: MemberRequest, response: Response) => {
    response.json({ stories: media.stories(request.member!) });
  });

  router.post('/stories', authenticate, (request: MemberRequest, response: Response) => {
    const parsed = storySchema.safeParse(request.body);
    if (!parsed.success || (!parsed.data.photoId && !parsed.data.text)) {
      response.status(400).json({ error: 'invalid_request' });
      return;
    }

    const result = media.addStory(request.member!, parsed.data);
    if (typeof result === 'string') {
      response.status(mediaStatus(result)).json({ error: result });
      return;
    }

    response.status(201).json({ story: result });
  });

  router.delete('/stories/:id', authenticate, (request: MemberRequest, response: Response) => {
    const removed = media.removeStory(request.member!, String(request.params.id));
    response.status(removed ? 200 : 404).json({ removed });
  });

  return router;
}
