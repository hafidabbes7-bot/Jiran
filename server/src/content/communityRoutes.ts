import express, { type Response, type Router } from 'express';
import { z } from 'zod';

import type { CommunityError, CommunityService } from './community.js';
import type { NotificationService } from './notifications.js';
import type { ContentRepository } from './repository.js';
import { memberAuthenticator, type MemberRequest } from './routes.js';

const messageSchema = z.object({ text: z.string().trim().min(1).max(1000) });
const serviceSchema = z.object({
  name: z.string().trim().min(2).max(60),
  trade: z.string().trim().min(2).max(40),
  phone: z.string().trim().max(20).optional(),
});
const recommendSchema = z.object({ rating: z.number().int().min(1).max(5) });
const itemSchema = z.object({ name: z.string().trim().min(2).max(60) });
const borrowSchema = z.object({ dueDate: z.string().trim().max(10).optional() });
const groupSchema = z.object({
  name: z.string().trim().min(2).max(50),
  emoji: z.string().trim().min(1).max(4),
});
const membershipSchema = z.object({ joined: z.boolean() });
const groupPostSchema = z.object({ text: z.string().trim().min(2).max(1000) });
const placeSchema = z.object({
  name: z.string().trim().min(2).max(60),
  kind: z.enum(['pharmacie', 'ecole', 'mosquee', 'bus', 'sante', 'autre']),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
const jour = /^\d{4}-\d{2}-\d{2}$/;
const vacationSchema = z.object({
  startsOn: z.string().regex(jour),
  endsOn: z.string().regex(jour),
  note: z.string().trim().max(300).optional(),
  watcherIds: z.array(z.string().min(1).max(60)).min(1).max(20),
});
const wasteSchema = z.object({
  kind: z.enum(['ordures', 'recyclable', 'encombrants']),
  weekday: z.number().int().min(0).max(6),
  hour: z.string().regex(/^\d{2}:\d{2}$/),
});
const solidaritySchema = z.object({
  title: z.string().trim().min(3).max(80),
  kind: z.enum(['sang', 'vetements', 'ramadan', 'autre']),
  details: z.string().trim().max(500).optional(),
  happensOn: z.string().regex(jour).optional(),
});

/** Traduit un refus du service en code HTTP. Le client ne décide de rien. */
function statusOf(error: CommunityError): number {
  if (error === 'introuvable' || error === 'voisin_inconnu') return 404;
  if (error === 'texte_refuse') return 422;
  if (error === 'deja_emprunte') return 409;
  return 403;
}

/**
 * Routes de la vie de quartier : messages privés, artisans, objets, groupes,
 * points utiles, absences, collecte et actions solidaires (§4.6, §4.9 à §4.15).
 *
 * Routeur séparé de celui du fil, qui commençait à tout porter. Même règle
 * partout : le voisin vient du jeton, la portée vient de son quartier.
 */
export function createCommunityRouter(
  community: CommunityService,
  repository: ContentRepository,
  notifications: NotificationService
): Router {
  const router = express.Router();
  const authenticate = memberAuthenticator(repository);

  /** Renvoie le résultat, ou l'erreur du service traduite en code HTTP. */
  const send = <T>(response: Response, result: T | CommunityError, key: string, created = false) => {
    if (typeof result === 'string') {
      response.status(statusOf(result as CommunityError)).json({ error: result });
      return;
    }

    response.status(created ? 201 : 200).json({ [key]: result });
  };

  // --- Messagerie privée -----------------------------------------------

  router.get('/messages', authenticate, async (request: MemberRequest, response: Response) => {
    response.json({ conversations: await community.conversations(request.member!) });
  });

  router.get('/messages/:neighborId', authenticate, async (request: MemberRequest, response: Response) => {
    send(response, await community.messages(request.member!, String(request.params.neighborId)), 'messages');
  });

  router.post('/messages/:neighborId', authenticate, async (request: MemberRequest, response: Response) => {
    const parsed = messageSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'invalid_request' });
      return;
    }

    const member = request.member!;
    const destinataire = String(request.params.neighborId);
    const envoyé = await community.sendMessage(member, destinataire, parsed.data.text);
    send(response, envoyé, 'message', true);

    if (typeof envoyé !== 'string') {
      await notifications.notify(
        [destinataire],
        'message',
        `${member.firstName} t'a écrit`,
        parsed.data.text.slice(0, 120),
        member.id
      );
    }
  });

  // --- Services recommandés --------------------------------------------

  router.get('/services', authenticate, async (request: MemberRequest, response: Response) => {
    response.json({ services: await community.services(request.member!) });
  });

  router.post('/services', authenticate, async (request: MemberRequest, response: Response) => {
    const parsed = serviceSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'invalid_request' });
      return;
    }

    send(response, await community.addService(request.member!, parsed.data), 'service', true);
  });

  router.post('/services/:id/recommend', authenticate, async (request: MemberRequest, response: Response) => {
    const parsed = recommendSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'invalid_request' });
      return;
    }

    send(
      response,
      await community.recommend(request.member!, String(request.params.id), parsed.data.rating),
      'service'
    );
  });

  // --- Objets à emprunter ----------------------------------------------

  router.get('/items', authenticate, async (request: MemberRequest, response: Response) => {
    response.json({ items: await community.items(request.member!) });
  });

  router.post('/items', authenticate, async (request: MemberRequest, response: Response) => {
    const parsed = itemSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'invalid_request' });
      return;
    }

    send(response, await community.addItem(request.member!, parsed.data.name), 'item', true);
  });

  router.post('/items/:id/borrow', authenticate, async (request: MemberRequest, response: Response) => {
    const parsed = borrowSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      response.status(400).json({ error: 'invalid_request' });
      return;
    }

    send(
      response,
      await community.borrow(request.member!, String(request.params.id), parsed.data.dueDate),
      'item'
    );
  });

  router.post('/items/:id/return', authenticate, async (request: MemberRequest, response: Response) => {
    send(response, await community.giveBack(request.member!, String(request.params.id)), 'item');
  });

  // --- Groupes d'intérêt -----------------------------------------------

  router.get('/groups', authenticate, async (request: MemberRequest, response: Response) => {
    response.json({ groups: await community.groups(request.member!) });
  });

  router.post('/groups', authenticate, async (request: MemberRequest, response: Response) => {
    const parsed = groupSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'invalid_request' });
      return;
    }

    send(
      response,
      await community.createGroup(request.member!, parsed.data.name, parsed.data.emoji),
      'group',
      true
    );
  });

  router.post('/groups/:id/membership', authenticate, async (request: MemberRequest, response: Response) => {
    const parsed = membershipSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'invalid_request' });
      return;
    }

    send(
      response,
      await community.setGroupMembership(request.member!, String(request.params.id), parsed.data.joined),
      'group'
    );
  });

  router.get('/groups/:id/posts', authenticate, async (request: MemberRequest, response: Response) => {
    send(response, await community.groupPosts(request.member!, String(request.params.id)), 'posts');
  });

  router.post('/groups/:id/posts', authenticate, async (request: MemberRequest, response: Response) => {
    const parsed = groupPostSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'invalid_request' });
      return;
    }

    send(
      response,
      await community.addGroupPost(request.member!, String(request.params.id), parsed.data.text),
      'post',
      true
    );
  });

  // --- Carte du quartier -----------------------------------------------

  router.get('/places', authenticate, async (request: MemberRequest, response: Response) => {
    response.json({ places: await community.places(request.member!) });
  });

  router.post('/places', authenticate, async (request: MemberRequest, response: Response) => {
    const parsed = placeSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'invalid_request' });
      return;
    }

    send(response, await community.addPlace(request.member!, parsed.data), 'place', true);
  });

  // --- Mode vacances ---------------------------------------------------

  router.get('/vacation', authenticate, async (request: MemberRequest, response: Response) => {
    response.json({
      vacation: (await community.vacation(request.member!)) ?? null,
      watched: await community.watchedVacations(request.member!),
    });
  });

  router.post('/vacation', authenticate, async (request: MemberRequest, response: Response) => {
    const parsed = vacationSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'invalid_request' });
      return;
    }

    if (parsed.data.endsOn < parsed.data.startsOn) {
      response.status(400).json({ error: 'dates_inversees' });
      return;
    }

    send(response, await community.declareVacation(request.member!, parsed.data), 'vacation', true);
  });

  router.delete('/vacation', authenticate, async (request: MemberRequest, response: Response) => {
    await community.cancelVacation(request.member!);
    response.json({ cancelled: true });
  });

  // --- Collecte des déchets --------------------------------------------

  router.get('/waste', authenticate, async (request: MemberRequest, response: Response) => {
    response.json({ slots: await community.wasteSlots(request.member!) });
  });

  router.post('/waste', authenticate, async (request: MemberRequest, response: Response) => {
    const parsed = wasteSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'invalid_request' });
      return;
    }

    response.status(201).json({ slot: await community.addWasteSlot(request.member!, parsed.data) });
  });

  router.delete('/waste/:id', authenticate, async (request: MemberRequest, response: Response) => {
    const removed = await community.removeWasteSlot(request.member!, String(request.params.id));
    response.status(removed ? 200 : 404).json({ removed });
  });

  // --- Actions solidaires ----------------------------------------------

  router.get('/solidarity', authenticate, async (request: MemberRequest, response: Response) => {
    response.json({ actions: await community.solidarityActions(request.member!) });
  });

  router.post('/solidarity', authenticate, async (request: MemberRequest, response: Response) => {
    const parsed = solidaritySchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'invalid_request' });
      return;
    }

    send(response, await community.createSolidarityAction(request.member!, parsed.data), 'action', true);
  });

  router.post('/solidarity/:id/participation', authenticate, async (request: MemberRequest, response: Response) => {
    const parsed = membershipSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'invalid_request' });
      return;
    }

    send(
      response,
      await community.setParticipation(request.member!, String(request.params.id), parsed.data.joined),
      'action'
    );
  });

  return router;
}
