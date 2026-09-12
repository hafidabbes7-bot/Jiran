import crypto from 'node:crypto';

import type { Db } from '../db/client.js';
import { estUuid, toIso, toNumber } from '../db/rows.js';
import { sharedFeedNeighborhoodIds } from './neighborhoods.js';
import type { Member } from './repository.js';
import { moderateText } from './textModeration.js';

/**
 * Tout ce qui fait vivre un quartier au-delà du fil : messages privés,
 * artisans recommandés, objets prêtés, groupes, points utiles, absences,
 * collecte des déchets et actions solidaires (§4.6, §4.9 à §4.15).
 *
 * Un seul service, une seule règle de portée : on ne voit que son propre fil
 * de quartier, jumelage compris. C'est le serveur qui la fait respecter, les
 * écrans ne font que demander.
 *
 * Les textes libres passent par le même filtre que les publications : ce qui
 * est refusé sur le fil l'est aussi dans un message privé.
 */

export type CommunityError =
  | 'introuvable'
  | 'texte_refuse'
  | 'pas_ton_objet'
  | 'deja_emprunte'
  | 'pas_membre'
  | 'voisin_inconnu';

const newId = () => crypto.randomUUID();

export interface Conversation {
  neighborId: string;
  neighborName: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
}

export interface Message {
  id: string;
  fromMe: boolean;
  text: string;
  createdAt: string;
}

export interface Service {
  id: string;
  name: string;
  trade: string;
  phone?: string;
  recommendations: number;
  rating: number;
  recommendedByMe: boolean;
}

export interface Item {
  id: string;
  name: string;
  ownerName: string;
  ownerIsMe: boolean;
  status: 'disponible' | 'emprunte';
  borrowerName?: string;
  borrowedByMe: boolean;
  dueDate?: string;
}

export interface Group {
  id: string;
  name: string;
  emoji: string;
  members: number;
  joined: boolean;
}

export interface GroupPost {
  id: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface Place {
  id: string;
  name: string;
  kind: string;
  latitude: number;
  longitude: number;
}

export interface Vacation {
  id: string;
  startsOn: string;
  endsOn: string;
  note?: string;
  /** Voisins désignés pour veiller, du point de vue du propriétaire. */
  watchers: { id: string; name: string }[];
}

export interface WatchedVacation {
  id: string;
  neighborName: string;
  startsOn: string;
  endsOn: string;
  note?: string;
}

export interface WasteSlot {
  id: string;
  kind: string;
  /** 0 = dimanche, 6 = samedi — la semaine algérienne commence le dimanche. */
  weekday: number;
  hour: string;
}

export interface SolidarityAction {
  id: string;
  title: string;
  kind: string;
  details?: string;
  happensOn?: string;
  participants: number;
  joined: boolean;
  createdByMe: boolean;
}

export class CommunityService {
  constructor(private readonly db: Db) {}

  /** Quartiers dont le fil est partagé avec celui du voisin. */
  private scope(member: Member): string[] {
    return sharedFeedNeighborhoodIds(member.neighborhoodId);
  }

  /**
   * Une conversation déjà entamée reste ouverte, même si l'un des deux a
   * déménagé : ce qui a été échangé appartient aux deux personnes, pas au
   * quartier. Seule une *nouvelle* conversation exige d'être voisins.
   */
  private async conversationExiste(member: Member, neighborId: string): Promise<boolean> {
    if (!estUuid(neighborId)) return false;

    const row = await this.db.one(
      `SELECT 1 FROM messages
       WHERE (sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1)
       LIMIT 1`,
      [member.id, neighborId]
    );
    return row !== undefined;
  }

  /** Voisin joignable : du même fil, ou déjà en conversation avec lui. */
  private async joignable(member: Member, neighborId: string): Promise<boolean> {
    if (await this.neighborOf(member, neighborId)) return true;
    return this.conversationExiste(member, neighborId);
  }

  /** Vérifie qu'un voisin existe et partage bien le fil de celui qui demande. */
  private async neighborOf(
    member: Member,
    neighborId: string
  ): Promise<{ id: string; first_name: string } | undefined> {
    if (!estUuid(neighborId)) return undefined;

    return this.db.one<{ id: string; first_name: string }>(
      'SELECT id, first_name FROM members WHERE id = $1 AND neighborhood_id = ANY($2)',
      [neighborId, this.scope(member)]
    );
  }

  // --- Messagerie privée (§4.6) ----------------------------------------

  /**
   * Conversation entre deux voisins, créée au premier message.
   *
   * La paire est rangée dans un ordre fixe — le plus petit identifiant
   * d'abord — pour qu'il n'y ait qu'une conversation quel que soit celui qui
   * écrit en premier ; l'unicité est tenue par la base, pas par le code.
   */
  private async conversationId(a: string, b: string): Promise<string> {
    const [bas, haut] = a < b ? [a, b] : [b, a];
    const row = await this.db.one<{ id: string }>(
      `INSERT INTO conversations (id, member_low, member_high)
       VALUES ($1, $2, $3)
       ON CONFLICT (member_low, member_high) DO UPDATE SET member_low = excluded.member_low
       RETURNING id`,
      [newId(), bas, haut]
    );
    return row!.id;
  }

  async conversations(member: Member): Promise<Conversation[]> {
    const rows = await this.db.query<{
      neighbor_id: string;
      neighbor_name: string;
      last_message: string;
      last_at: Date;
      unread: string;
    }>(
      `SELECT voisin.id AS neighbor_id,
              voisin.first_name AS neighbor_name,
              dernier.body AS last_message,
              dernier.created_at AS last_at,
              (SELECT COUNT(*) FROM messages nl
                 WHERE nl.conversation_id = c.id
                   AND nl.recipient_id = $1
                   AND nl.read_at IS NULL) AS unread
       FROM conversations c
       JOIN members voisin
         ON voisin.id = CASE WHEN c.member_low = $1 THEN c.member_high ELSE c.member_low END
       JOIN LATERAL (
         SELECT body, created_at FROM messages m
         WHERE m.conversation_id = c.id
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT 1
       ) dernier ON true
       WHERE c.member_low = $1 OR c.member_high = $1
       ORDER BY dernier.created_at DESC
       LIMIT 50`,
      [member.id]
    );

    return rows.map((row) => ({
      neighborId: row.neighbor_id,
      neighborName: row.neighbor_name,
      lastMessage: row.last_message,
      lastAt: toIso(row.last_at),
      unread: toNumber(row.unread),
    }));
  }

  /** Fil d'une conversation. La lecture marque d'office les messages reçus comme lus. */
  async messages(
    member: Member,
    neighborId: string,
    now: Date = new Date()
  ): Promise<Message[] | CommunityError> {
    if (!(await this.joignable(member, neighborId))) return 'voisin_inconnu';

    const conversation = await this.conversationId(member.id, neighborId);

    await this.db.query(
      `UPDATE messages SET read_at = $1
       WHERE conversation_id = $2 AND recipient_id = $3 AND read_at IS NULL`,
      [now.toISOString(), conversation, member.id]
    );

    const rows = await this.db.query<{
      id: string;
      sender_id: string;
      body: string;
      created_at: Date;
    }>(
      `SELECT id, sender_id, body, created_at FROM messages
       WHERE conversation_id = $1
       -- L'horodatage seul ne suffit pas : deux messages de la même
       -- milliseconde s'afficheraient dans un ordre arbitraire.
       ORDER BY created_at, id
       LIMIT 200`,
      [conversation]
    );

    return rows.map((row) => ({
      id: row.id,
      fromMe: row.sender_id === member.id,
      text: row.body,
      createdAt: toIso(row.created_at),
    }));
  }

  async sendMessage(
    member: Member,
    neighborId: string,
    text: string,
    now: Date = new Date()
  ): Promise<Message | CommunityError> {
    if (!(await this.joignable(member, neighborId))) return 'voisin_inconnu';
    if (!moderateText(text).clean) return 'texte_refuse';

    const id = newId();
    const stamp = now.toISOString();
    const conversation = await this.conversationId(member.id, neighborId);

    await this.db.tx(async (tx) => {
      await tx.query(
        `INSERT INTO messages (id, conversation_id, sender_id, recipient_id, body, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, conversation, member.id, neighborId, text, stamp]
      );
      // La date du dernier message sert au classement des conversations : elle
      // doit bouger avec le message, pas séparément.
      await tx.query('UPDATE conversations SET last_message_at = $1 WHERE id = $2', [
        stamp,
        conversation,
      ]);
    });

    return { id, fromMe: true, text, createdAt: stamp };
  }

  // --- Services recommandés (§4.9) -------------------------------------

  async services(member: Member): Promise<Service[]> {
    const rows = await this.db.query<{
      id: string;
      name: string;
      trade: string;
      phone: string | null;
      recommendations: string;
      rating: string;
      mine: boolean;
    }>(
      `SELECT s.id, s.name, s.trade, s.phone,
              COUNT(r.member_id) AS recommendations,
              COALESCE(AVG(r.rating), 0) AS rating,
              bool_or(r.member_id = $1) AS mine
       FROM services s
       LEFT JOIN service_recommendations r ON r.service_id = s.id
       WHERE s.neighborhood_id = ANY($2)
       GROUP BY s.id
       ORDER BY recommendations DESC, s.name`,
      [member.id, this.scope(member)]
    );

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      trade: row.trade,
      phone: row.phone ?? undefined,
      recommendations: toNumber(row.recommendations),
      rating: Math.round(toNumber(row.rating) * 10) / 10,
      recommendedByMe: row.mine === true,
    }));
  }

  async addService(
    member: Member,
    input: { name: string; trade: string; phone?: string },
    now: Date = new Date()
  ): Promise<Service | CommunityError> {
    if (!moderateText(`${input.name} ${input.trade}`).clean) return 'texte_refuse';

    const id = newId();
    await this.db.query(
      `INSERT INTO services (id, neighborhood_id, name, trade, phone, added_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, member.neighborhoodId, input.name, input.trade, input.phone ?? null, member.id, now.toISOString()]
    );

    // Celui qui inscrit un artisan le recommande : c'est le sens du geste.
    await this.recommend(member, id, 5, now);
    return (await this.services(member)).find((service) => service.id === id)!;
  }

  /** Une recommandation par voisin : un second appel remplace la note, il ne l'ajoute pas. */
  async recommend(
    member: Member,
    serviceId: string,
    rating: number,
    now: Date = new Date()
  ): Promise<Service | CommunityError> {
    const exists = await this.db.one('SELECT 1 FROM services WHERE id = $1', [serviceId]);
    if (!exists) return 'introuvable';

    await this.db.query(
      `INSERT INTO service_recommendations (service_id, member_id, rating, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (service_id, member_id) DO UPDATE SET rating = excluded.rating`,
      [serviceId, member.id, Math.max(1, Math.min(5, Math.round(rating))), now.toISOString()]
    );

    return (await this.services(member)).find((service) => service.id === serviceId)!;
  }

  // --- Objets à emprunter (§4.10) --------------------------------------

  async items(member: Member): Promise<Item[]> {
    const rows = await this.db.query<{
      id: string;
      name: string;
      status: string;
      due_date: string | null;
      owner_id: string;
      borrower_id: string | null;
      owner_name: string;
      borrower_name: string | null;
    }>(
      `SELECT i.id, i.name, i.status, i.due_date, i.owner_id, i.borrower_id,
              o.first_name AS owner_name, b.first_name AS borrower_name
       FROM items i
       JOIN members o ON o.id = i.owner_id
       LEFT JOIN members b ON b.id = i.borrower_id
       WHERE i.neighborhood_id = ANY($1)
       ORDER BY i.created_at DESC, i.id DESC
       LIMIT 100`,
      [this.scope(member)]
    );

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      ownerName: row.owner_name,
      ownerIsMe: row.owner_id === member.id,
      status: row.status as Item['status'],
      borrowerName: row.borrower_name ?? undefined,
      borrowedByMe: row.borrower_id === member.id,
      dueDate: row.due_date ?? undefined,
    }));
  }

  async addItem(
    member: Member,
    name: string,
    now: Date = new Date()
  ): Promise<Item | CommunityError> {
    if (!moderateText(name).clean) return 'texte_refuse';

    const id = newId();
    await this.db.query(
      `INSERT INTO items (id, neighborhood_id, owner_id, name, status, created_at)
       VALUES ($1, $2, $3, $4, 'disponible', $5)`,
      [id, member.neighborhoodId, member.id, name, now.toISOString()]
    );
    return (await this.items(member)).find((item) => item.id === id)!;
  }

  /** Emprunt : le voisin se déclare emprunteur, avec la date de retour promise. */
  async borrow(member: Member, itemId: string, dueDate?: string): Promise<Item | CommunityError> {
    const row = await this.db.one<{ owner_id: string; status: string }>(
      'SELECT owner_id, status FROM items WHERE id = $1',
      [itemId]
    );
    if (!row) return 'introuvable';
    if (row.status === 'emprunte') return 'deja_emprunte';
    if (row.owner_id === member.id) return 'pas_ton_objet';

    await this.db.query(
      `UPDATE items SET status = 'emprunte', borrower_id = $1, due_date = $2 WHERE id = $3`,
      [member.id, dueDate ?? null, itemId]
    );
    return (await this.items(member)).find((item) => item.id === itemId)!;
  }

  /** Retour : seul le propriétaire ou l'emprunteur peut le déclarer. */
  async giveBack(member: Member, itemId: string): Promise<Item | CommunityError> {
    const row = await this.db.one<{ owner_id: string; borrower_id: string | null }>(
      'SELECT owner_id, borrower_id FROM items WHERE id = $1',
      [itemId]
    );
    if (!row) return 'introuvable';
    if (row.owner_id !== member.id && row.borrower_id !== member.id) return 'pas_ton_objet';

    await this.db.query(
      `UPDATE items SET status = 'disponible', borrower_id = NULL, due_date = NULL WHERE id = $1`,
      [itemId]
    );
    return (await this.items(member)).find((item) => item.id === itemId)!;
  }

  // --- Groupes d'intérêt (§4.11) ---------------------------------------

  async groups(member: Member): Promise<Group[]> {
    const rows = await this.db.query<{
      id: string;
      name: string;
      emoji: string;
      members: string;
      joined: boolean;
    }>(
      `SELECT g.id, g.name, g.emoji,
              COUNT(gm.member_id) AS members,
              bool_or(gm.member_id = $1) AS joined
       FROM groups g
       LEFT JOIN group_members gm ON gm.group_id = g.id
       WHERE g.neighborhood_id = ANY($2)
       GROUP BY g.id
       ORDER BY members DESC, g.name`,
      [member.id, this.scope(member)]
    );

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      emoji: row.emoji,
      members: toNumber(row.members),
      joined: row.joined === true,
    }));
  }

  async createGroup(
    member: Member,
    name: string,
    emoji: string,
    now: Date = new Date()
  ): Promise<Group | CommunityError> {
    if (!moderateText(name).clean) return 'texte_refuse';

    const id = newId();
    await this.db.query(
      `INSERT INTO groups (id, neighborhood_id, name, emoji, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, member.neighborhoodId, name, emoji, member.id, now.toISOString()]
    );
    await this.setGroupMembership(member, id, true, now);
    return (await this.groups(member)).find((group) => group.id === id)!;
  }

  async setGroupMembership(
    member: Member,
    groupId: string,
    joined: boolean,
    now: Date = new Date()
  ): Promise<Group | CommunityError> {
    const exists = await this.db.one('SELECT 1 FROM groups WHERE id = $1', [groupId]);
    if (!exists) return 'introuvable';

    if (joined) {
      await this.db.query(
        `INSERT INTO group_members (group_id, member_id, joined_at) VALUES ($1, $2, $3)
         ON CONFLICT (group_id, member_id) DO NOTHING`,
        [groupId, member.id, now.toISOString()]
      );
    } else {
      await this.db.query('DELETE FROM group_members WHERE group_id = $1 AND member_id = $2', [
        groupId,
        member.id,
      ]);
    }

    return (await this.groups(member)).find((group) => group.id === groupId)!;
  }

  private async isGroupMember(member: Member, groupId: string): Promise<boolean> {
    const row = await this.db.one(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND member_id = $2',
      [groupId, member.id]
    );
    return row !== undefined;
  }

  /** Le fil d'un groupe n'est lisible que par ses membres : c'est ce qui en fait un groupe. */
  async groupPosts(member: Member, groupId: string): Promise<GroupPost[] | CommunityError> {
    if (!(await this.isGroupMember(member, groupId))) return 'pas_membre';

    const rows = await this.db.query<{
      id: string;
      body: string;
      created_at: Date;
      first_name: string;
    }>(
      `SELECT p.id, p.body, p.created_at, m.first_name
       FROM group_posts p JOIN members m ON m.id = p.author_id
       WHERE p.group_id = $1
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT 100`,
      [groupId]
    );

    return rows.map((row) => ({
      id: row.id,
      authorName: row.first_name,
      text: row.body,
      createdAt: toIso(row.created_at),
    }));
  }

  async addGroupPost(
    member: Member,
    groupId: string,
    text: string,
    now: Date = new Date()
  ): Promise<GroupPost | CommunityError> {
    if (!(await this.isGroupMember(member, groupId))) return 'pas_membre';
    if (!moderateText(text).clean) return 'texte_refuse';

    const id = newId();
    const stamp = now.toISOString();
    await this.db.query(
      'INSERT INTO group_posts (id, group_id, author_id, body, created_at) VALUES ($1, $2, $3, $4, $5)',
      [id, groupId, member.id, text, stamp]
    );

    return { id, authorName: member.firstName, text, createdAt: stamp };
  }

  // --- Carte du quartier (§4.12) ---------------------------------------

  async places(member: Member): Promise<Place[]> {
    const rows = await this.db.query<{
      id: string;
      name: string;
      kind: string;
      latitude: number;
      longitude: number;
    }>(
      `SELECT id, name, kind, latitude, longitude FROM places
       WHERE neighborhood_id = ANY($1)
       ORDER BY kind, name
       LIMIT 200`,
      [this.scope(member)]
    );

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
    }));
  }

  async addPlace(
    member: Member,
    input: { name: string; kind: string; latitude: number; longitude: number },
    now: Date = new Date()
  ): Promise<Place | CommunityError> {
    if (!moderateText(input.name).clean) return 'texte_refuse';

    const id = newId();
    await this.db.query(
      `INSERT INTO places (id, neighborhood_id, name, kind, latitude, longitude, added_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        member.neighborhoodId,
        input.name,
        input.kind,
        input.latitude,
        input.longitude,
        member.id,
        now.toISOString(),
      ]
    );
    return { id, name: input.name, kind: input.kind, latitude: input.latitude, longitude: input.longitude };
  }

  // --- Mode vacances (§4.13) -------------------------------------------

  /** Absence en cours ou à venir du voisin, s'il en a déclaré une. */
  async vacation(member: Member, now: Date = new Date()): Promise<Vacation | undefined> {
    const row = await this.db.one<{
      id: string;
      starts_on: string;
      ends_on: string;
      note: string | null;
    }>(
      `SELECT id, starts_on, ends_on, note FROM vacations
       WHERE member_id = $1 AND ends_on >= $2
       ORDER BY starts_on LIMIT 1`,
      [member.id, now.toISOString().slice(0, 10)]
    );
    if (!row) return undefined;

    const watchers = await this.db.query<{ id: string; first_name: string }>(
      `SELECT m.id, m.first_name FROM vacation_watchers w
       JOIN members m ON m.id = w.member_id
       WHERE w.vacation_id = $1`,
      [row.id]
    );

    return {
      id: row.id,
      startsOn: row.starts_on,
      endsOn: row.ends_on,
      note: row.note ?? undefined,
      watchers: watchers.map((w) => ({ id: w.id, name: w.first_name })),
    };
  }

  async declareVacation(
    member: Member,
    input: { startsOn: string; endsOn: string; note?: string; watcherIds: string[] },
    now: Date = new Date()
  ): Promise<Vacation | CommunityError> {
    if (input.note && !moderateText(input.note).clean) return 'texte_refuse';
    for (const watcherId of input.watcherIds) {
      if (!(await this.neighborOf(member, watcherId))) return 'voisin_inconnu';
    }

    // Une seule absence courante : déclarer remplace, sinon on empile des
    // absences oubliées que personne ne relit.
    await this.cancelVacation(member, now);

    const id = newId();
    await this.db.tx(async (tx) => {
      await tx.query(
        'INSERT INTO vacations (id, member_id, starts_on, ends_on, note, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [id, member.id, input.startsOn, input.endsOn, input.note ?? null, now.toISOString()]
      );
      await tx.query(
        `INSERT INTO vacation_watchers (vacation_id, member_id)
         SELECT $1, unnest($2::uuid[])`,
        [id, input.watcherIds]
      );
    });

    return (await this.vacation(member, now))!;
  }

  async cancelVacation(member: Member, now: Date = new Date()): Promise<void> {
    const current = await this.vacation(member, now);
    if (current) await this.db.query('DELETE FROM vacations WHERE id = $1', [current.id]);
  }

  /** Absences que ce voisin a accepté de surveiller — lui seul les voit. */
  async watchedVacations(member: Member, now: Date = new Date()): Promise<WatchedVacation[]> {
    const rows = await this.db.query<{
      id: string;
      starts_on: string;
      ends_on: string;
      note: string | null;
      first_name: string;
    }>(
      `SELECT v.id, v.starts_on, v.ends_on, v.note, m.first_name
       FROM vacation_watchers w
       JOIN vacations v ON v.id = w.vacation_id
       JOIN members m ON m.id = v.member_id
       WHERE w.member_id = $1 AND v.ends_on >= $2
       ORDER BY v.starts_on`,
      [member.id, now.toISOString().slice(0, 10)]
    );

    return rows.map((row) => ({
      id: row.id,
      neighborName: row.first_name,
      startsOn: row.starts_on,
      endsOn: row.ends_on,
      note: row.note ?? undefined,
    }));
  }

  // --- Collecte des déchets (§4.14) ------------------------------------

  async wasteSlots(member: Member): Promise<WasteSlot[]> {
    const rows = await this.db.query<{ id: string; kind: string; weekday: number; hour: string }>(
      `SELECT id, kind, weekday, hour FROM waste_slots
       WHERE neighborhood_id = ANY($1)
       ORDER BY weekday, hour`,
      [this.scope(member)]
    );

    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      weekday: Number(row.weekday),
      hour: row.hour,
    }));
  }

  async addWasteSlot(
    member: Member,
    input: { kind: string; weekday: number; hour: string },
    now: Date = new Date()
  ): Promise<WasteSlot> {
    const id = newId();
    await this.db.query(
      `INSERT INTO waste_slots (id, neighborhood_id, kind, weekday, hour, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, member.neighborhoodId, input.kind, input.weekday, input.hour, member.id, now.toISOString()]
    );
    return { id, kind: input.kind, weekday: input.weekday, hour: input.hour };
  }

  async removeWasteSlot(member: Member, slotId: string): Promise<boolean> {
    const supprimés = await this.db.query(
      'DELETE FROM waste_slots WHERE id = $1 AND neighborhood_id = ANY($2) RETURNING id',
      [slotId, this.scope(member)]
    );
    return supprimés.length > 0;
  }

  // --- Actions solidaires (§4.15) --------------------------------------

  async solidarityActions(member: Member): Promise<SolidarityAction[]> {
    const rows = await this.db.query<{
      id: string;
      title: string;
      kind: string;
      details: string | null;
      happens_on: string | null;
      created_by: string;
      participants: string;
      joined: boolean;
    }>(
      `SELECT a.id, a.title, a.kind, a.details, a.happens_on, a.created_by,
              COUNT(p.member_id) AS participants,
              bool_or(p.member_id = $1) AS joined
       FROM solidarity_actions a
       LEFT JOIN solidarity_participants p ON p.action_id = a.id
       WHERE a.neighborhood_id = ANY($2)
       GROUP BY a.id
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT 50`,
      [member.id, this.scope(member)]
    );

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      kind: row.kind,
      details: row.details ?? undefined,
      happensOn: row.happens_on ?? undefined,
      participants: toNumber(row.participants),
      joined: row.joined === true,
      createdByMe: row.created_by === member.id,
    }));
  }

  async createSolidarityAction(
    member: Member,
    input: { title: string; kind: string; details?: string; happensOn?: string },
    now: Date = new Date()
  ): Promise<SolidarityAction | CommunityError> {
    if (!moderateText(`${input.title} ${input.details ?? ''}`).clean) return 'texte_refuse';

    const id = newId();
    await this.db.query(
      `INSERT INTO solidarity_actions (id, neighborhood_id, title, kind, details, happens_on, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        member.neighborhoodId,
        input.title,
        input.kind,
        input.details ?? null,
        input.happensOn ?? null,
        member.id,
        now.toISOString(),
      ]
    );
    await this.setParticipation(member, id, true, now);
    return (await this.solidarityActions(member)).find((action) => action.id === id)!;
  }

  async setParticipation(
    member: Member,
    actionId: string,
    joined: boolean,
    now: Date = new Date()
  ): Promise<SolidarityAction | CommunityError> {
    const exists = await this.db.one('SELECT 1 FROM solidarity_actions WHERE id = $1', [actionId]);
    if (!exists) return 'introuvable';

    if (joined) {
      await this.db.query(
        `INSERT INTO solidarity_participants (action_id, member_id, joined_at) VALUES ($1, $2, $3)
         ON CONFLICT (action_id, member_id) DO NOTHING`,
        [actionId, member.id, now.toISOString()]
      );
    } else {
      await this.db.query(
        'DELETE FROM solidarity_participants WHERE action_id = $1 AND member_id = $2',
        [actionId, member.id]
      );
    }

    return (await this.solidarityActions(member)).find((action) => action.id === actionId)!;
  }
}
