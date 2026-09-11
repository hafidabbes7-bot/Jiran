import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';

import { config } from '../config.js';
import { readSessionToken } from '../session.js';
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
});

const commentSchema = z.object({ text: z.string().trim().min(2).max(1000) });
const likeSchema = z.object({ liked: z.boolean() });
const reportSchema = z.object({
  reason: z.enum(['spam', 'inapproprie', 'fausse_alerte', 'autre']),
});

/** Requête portant le membre reconnu par son jeton de session. */
type MemberRequest = Request & { member?: Member };

/**
 * Routes du contenu de quartier.
 *
 * Chaque appel est rattaché à un membre par son jeton de session : le numéro
 * vient du jeton signé, jamais du corps de la requête, et le quartier vient du
 * membre. Un client modifié ne peut donc ni publier au nom d'un autre, ni lire
 * le fil d'un quartier où il n'habite pas.
 */
export function createContentRouter(repository: ContentRepository): Router {
  const router = express.Router();

  /**
   * Reconnaît le voisin ; 401 si le jeton manque ou ne vaut rien.
   *
   * Posé route par route, et non sur le routeur entier : monté à la racine, il
   * s'appliquerait aussi aux routes de vérification, qui doivent rester
   * ouvertes à un voisin qui n'a pas encore de profil.
   */
  const authenticate = (request: MemberRequest, response: Response, next: () => void) => {
    const header = request.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const phone = token ? readSessionToken(token, config.sessionSecret) : null;

    if (!phone) {
      response.status(401).json({ error: 'invalid_token' });
      return;
    }

    const member = repository.findMemberByPhone(phone);
    if (!member) {
      // Numéro vérifié mais profil pas encore créé : l'application doit
      // d'abord appeler POST /profile.
      response.status(403).json({ error: 'profile_required' });
      return;
    }

    request.member = member;
    next();
  };

  /** Crée ou met à jour le profil du voisin vérifié. */
  router.post('/profile', (request: MemberRequest, response: Response) => {
    const header = request.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const phone = token ? readSessionToken(token, config.sessionSecret) : null;

    if (!phone) {
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

    const member = repository.saveMember({ phone, ...parsed.data });
    response.json({
      id: member.id,
      firstName: member.firstName,
      neighborhoodId: member.neighborhoodId,
      building: member.building,
      joinedAt: member.joinedAt,
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

    const id = repository.createPost(request.member!, {
      category: parsed.data.category as never,
      text: parsed.data.text,
    });
    response.status(201).json({ id });
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

      const id = repository.addComment(postId, request.member!, parsed.data.text);
      response.status(201).json({ id });
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

  return router;
}
