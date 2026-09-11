import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

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
  constructor(private readonly db: DatabaseSync) {}

  /** Quartiers du même fil, prêts à être injectés dans un `IN (...)`. */
  private scope(member: Member): { ids: string[]; places: string } {
    const ids = sharedFeedNeighborhoodIds(member.neighborhoodId);
    return { ids, places: ids.map(() => '?').join(', ') };
  }

  /** Vérifie qu'un voisin existe et partage bien le fil de celui qui demande. */
  private neighborOf(member: Member, neighborId: string): { id: string; first_name: string } | undefined {
    const { ids, places } = this.scope(member);
    return this.db
      .prepare(
        `SELECT id, first_name FROM members WHERE id = ? AND neighborhood_id IN (${places})`
      )
      .get(neighborId, ...ids) as unknown as { id: string; first_name: string } | undefined;
  }

  // --- Messagerie privée (§4.6) ----------------------------------------

  conversations(member: Member): Conversation[] {
    const rows = this.db
      .prepare(
        `SELECT
           CASE WHEN m.sender_id = ? THEN m.recipient_id ELSE m.sender_id END AS neighbor_id,
           MAX(m.created_at) AS last_at
         FROM messages m
         WHERE m.sender_id = ? OR m.recipient_id = ?
         GROUP BY neighbor_id
         ORDER BY last_at DESC
         LIMIT 50`
      )
      .all(member.id, member.id, member.id) as unknown as {
      neighbor_id: string;
      last_at: string;
    }[];

    return rows.map((row) => {
      const last = this.db
        .prepare(
          `SELECT body FROM messages
           WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
           ORDER BY created_at DESC, rowid DESC LIMIT 1`
        )
        .get(member.id, row.neighbor_id, row.neighbor_id, member.id) as { body: string };
      const unread = this.db
        .prepare(
          'SELECT COUNT(*) AS n FROM messages WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL'
        )
        .get(row.neighbor_id, member.id) as { n: number };
      const name = this.db
        .prepare('SELECT first_name FROM members WHERE id = ?')
        .get(row.neighbor_id) as { first_name: string } | undefined;

      return {
        neighborId: row.neighbor_id,
        neighborName: name?.first_name ?? '—',
        lastMessage: last.body,
        lastAt: row.last_at,
        unread: Number(unread.n),
      };
    });
  }

  /** Fil d'une conversation. La lecture marque d'office les messages reçus comme lus. */
  messages(member: Member, neighborId: string, now: Date = new Date()): Message[] | CommunityError {
    if (!this.neighborOf(member, neighborId)) return 'voisin_inconnu';

    this.db
      .prepare('UPDATE messages SET read_at = ? WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL')
      .run(now.toISOString(), neighborId, member.id);

    const rows = this.db
      .prepare(
        `SELECT id, sender_id, body, created_at FROM messages
         WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
         -- L'horodatage ne suffit pas : deux messages de la même milliseconde
         -- s'afficheraient dans un ordre arbitraire.
         ORDER BY created_at, rowid
         LIMIT 200`
      )
      .all(member.id, neighborId, neighborId, member.id) as unknown as {
      id: string;
      sender_id: string;
      body: string;
      created_at: string;
    }[];

    return rows.map((row) => ({
      id: row.id,
      fromMe: row.sender_id === member.id,
      text: row.body,
      createdAt: row.created_at,
    }));
  }

  sendMessage(
    member: Member,
    neighborId: string,
    text: string,
    now: Date = new Date()
  ): Message | CommunityError {
    if (!this.neighborOf(member, neighborId)) return 'voisin_inconnu';
    if (!moderateText(text).clean) return 'texte_refuse';

    const id = newId();
    const stamp = now.toISOString();
    this.db
      .prepare(
        'INSERT INTO messages (id, sender_id, recipient_id, body, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(id, member.id, neighborId, text, stamp);

    return { id, fromMe: true, text, createdAt: stamp };
  }

  // --- Services recommandés (§4.9) -------------------------------------

  services(member: Member): Service[] {
    const { ids, places } = this.scope(member);
    const rows = this.db
      .prepare(
        `SELECT s.id, s.name, s.trade, s.phone,
                COUNT(r.member_id) AS recommendations,
                COALESCE(AVG(r.rating), 0) AS rating,
                MAX(CASE WHEN r.member_id = ? THEN 1 ELSE 0 END) AS mine
         FROM services s
         LEFT JOIN service_recommendations r ON r.service_id = s.id
         WHERE s.neighborhood_id IN (${places})
         GROUP BY s.id
         ORDER BY recommendations DESC, s.name`
      )
      .all(member.id, ...ids) as unknown as {
      id: string;
      name: string;
      trade: string;
      phone: string | null;
      recommendations: number;
      rating: number;
      mine: number;
    }[];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      trade: row.trade,
      phone: row.phone ?? undefined,
      recommendations: Number(row.recommendations),
      rating: Math.round(Number(row.rating) * 10) / 10,
      recommendedByMe: row.mine === 1,
    }));
  }

  addService(
    member: Member,
    input: { name: string; trade: string; phone?: string },
    now: Date = new Date()
  ): Service | CommunityError {
    if (!moderateText(`${input.name} ${input.trade}`).clean) return 'texte_refuse';

    const id = newId();
    this.db
      .prepare(
        `INSERT INTO services (id, neighborhood_id, name, trade, phone, added_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, member.neighborhoodId, input.name, input.trade, input.phone ?? null, member.id, now.toISOString());

    // Celui qui inscrit un artisan le recommande : c'est le sens du geste.
    this.recommend(member, id, 5, now);
    return this.services(member).find((service) => service.id === id)!;
  }

  /** Une recommandation par voisin : un second appel remplace la note, il ne l'ajoute pas. */
  recommend(
    member: Member,
    serviceId: string,
    rating: number,
    now: Date = new Date()
  ): Service | CommunityError {
    const exists = this.db.prepare('SELECT id FROM services WHERE id = ?').get(serviceId);
    if (!exists) return 'introuvable';

    this.db
      .prepare(
        `INSERT INTO service_recommendations (service_id, member_id, rating, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (service_id, member_id) DO UPDATE SET rating = excluded.rating`
      )
      .run(serviceId, member.id, Math.max(1, Math.min(5, Math.round(rating))), now.toISOString());

    return this.services(member).find((service) => service.id === serviceId)!;
  }

  // --- Objets à emprunter (§4.10) --------------------------------------

  items(member: Member): Item[] {
    const { ids, places } = this.scope(member);
    const rows = this.db
      .prepare(
        `SELECT i.id, i.name, i.status, i.due_date, i.owner_id, i.borrower_id,
                o.first_name AS owner_name, b.first_name AS borrower_name
         FROM items i
         JOIN members o ON o.id = i.owner_id
         LEFT JOIN members b ON b.id = i.borrower_id
         WHERE i.neighborhood_id IN (${places})
         ORDER BY i.created_at DESC, i.rowid DESC
         LIMIT 100`
      )
      .all(...ids) as unknown as {
      id: string;
      name: string;
      status: string;
      due_date: string | null;
      owner_id: string;
      borrower_id: string | null;
      owner_name: string;
      borrower_name: string | null;
    }[];

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

  addItem(member: Member, name: string, now: Date = new Date()): Item | CommunityError {
    if (!moderateText(name).clean) return 'texte_refuse';

    const id = newId();
    this.db
      .prepare(
        `INSERT INTO items (id, neighborhood_id, owner_id, name, status, created_at)
         VALUES (?, ?, ?, ?, 'disponible', ?)`
      )
      .run(id, member.neighborhoodId, member.id, name, now.toISOString());
    return this.items(member).find((item) => item.id === id)!;
  }

  /** Emprunt : le voisin se déclare emprunteur, avec la date de retour promise. */
  borrow(member: Member, itemId: string, dueDate?: string): Item | CommunityError {
    const row = this.db
      .prepare('SELECT owner_id, status FROM items WHERE id = ?')
      .get(itemId) as { owner_id: string; status: string } | undefined;
    if (!row) return 'introuvable';
    if (row.status === 'emprunte') return 'deja_emprunte';
    if (row.owner_id === member.id) return 'pas_ton_objet';

    this.db
      .prepare("UPDATE items SET status = 'emprunte', borrower_id = ?, due_date = ? WHERE id = ?")
      .run(member.id, dueDate ?? null, itemId);
    return this.items(member).find((item) => item.id === itemId)!;
  }

  /** Retour : seul le propriétaire ou l'emprunteur peut le déclarer. */
  giveBack(member: Member, itemId: string): Item | CommunityError {
    const row = this.db
      .prepare('SELECT owner_id, borrower_id FROM items WHERE id = ?')
      .get(itemId) as { owner_id: string; borrower_id: string | null } | undefined;
    if (!row) return 'introuvable';
    if (row.owner_id !== member.id && row.borrower_id !== member.id) return 'pas_ton_objet';

    this.db
      .prepare("UPDATE items SET status = 'disponible', borrower_id = NULL, due_date = NULL WHERE id = ?")
      .run(itemId);
    return this.items(member).find((item) => item.id === itemId)!;
  }

  // --- Groupes d'intérêt (§4.11) ---------------------------------------

  groups(member: Member): Group[] {
    const { ids, places } = this.scope(member);
    const rows = this.db
      .prepare(
        `SELECT g.id, g.name, g.emoji,
                COUNT(gm.member_id) AS members,
                MAX(CASE WHEN gm.member_id = ? THEN 1 ELSE 0 END) AS joined
         FROM groups g
         LEFT JOIN group_members gm ON gm.group_id = g.id
         WHERE g.neighborhood_id IN (${places})
         GROUP BY g.id
         ORDER BY members DESC, g.name`
      )
      .all(member.id, ...ids) as unknown as {
      id: string;
      name: string;
      emoji: string;
      members: number;
      joined: number;
    }[];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      emoji: row.emoji,
      members: Number(row.members),
      joined: row.joined === 1,
    }));
  }

  createGroup(
    member: Member,
    name: string,
    emoji: string,
    now: Date = new Date()
  ): Group | CommunityError {
    if (!moderateText(name).clean) return 'texte_refuse';

    const id = newId();
    this.db
      .prepare(
        `INSERT INTO groups (id, neighborhood_id, name, emoji, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, member.neighborhoodId, name, emoji, member.id, now.toISOString());
    this.setGroupMembership(member, id, true, now);
    return this.groups(member).find((group) => group.id === id)!;
  }

  setGroupMembership(
    member: Member,
    groupId: string,
    joined: boolean,
    now: Date = new Date()
  ): Group | CommunityError {
    const exists = this.db.prepare('SELECT id FROM groups WHERE id = ?').get(groupId);
    if (!exists) return 'introuvable';

    if (joined) {
      this.db
        .prepare(
          `INSERT INTO group_members (group_id, member_id, joined_at) VALUES (?, ?, ?)
           ON CONFLICT (group_id, member_id) DO NOTHING`
        )
        .run(groupId, member.id, now.toISOString());
    } else {
      this.db
        .prepare('DELETE FROM group_members WHERE group_id = ? AND member_id = ?')
        .run(groupId, member.id);
    }

    return this.groups(member).find((group) => group.id === groupId)!;
  }

  private isGroupMember(member: Member, groupId: string): boolean {
    return Boolean(
      this.db
        .prepare('SELECT 1 FROM group_members WHERE group_id = ? AND member_id = ?')
        .get(groupId, member.id)
    );
  }

  /** Le fil d'un groupe n'est lisible que par ses membres : c'est ce qui en fait un groupe. */
  groupPosts(member: Member, groupId: string): GroupPost[] | CommunityError {
    if (!this.isGroupMember(member, groupId)) return 'pas_membre';

    const rows = this.db
      .prepare(
        `SELECT p.id, p.body, p.created_at, m.first_name
         FROM group_posts p JOIN members m ON m.id = p.author_id
         WHERE p.group_id = ?
         ORDER BY p.created_at DESC, p.rowid DESC
         LIMIT 100`
      )
      .all(groupId) as unknown as {
      id: string;
      body: string;
      created_at: string;
      first_name: string;
    }[];

    return rows.map((row) => ({
      id: row.id,
      authorName: row.first_name,
      text: row.body,
      createdAt: row.created_at,
    }));
  }

  addGroupPost(
    member: Member,
    groupId: string,
    text: string,
    now: Date = new Date()
  ): GroupPost | CommunityError {
    if (!this.isGroupMember(member, groupId)) return 'pas_membre';
    if (!moderateText(text).clean) return 'texte_refuse';

    const id = newId();
    const stamp = now.toISOString();
    this.db
      .prepare('INSERT INTO group_posts (id, group_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, groupId, member.id, text, stamp);

    return { id, authorName: member.firstName, text, createdAt: stamp };
  }

  // --- Carte du quartier (§4.12) ---------------------------------------

  places(member: Member): Place[] {
    const { ids, places } = this.scope(member);
    const rows = this.db
      .prepare(
        `SELECT id, name, kind, latitude, longitude FROM places
         WHERE neighborhood_id IN (${places})
         ORDER BY kind, name
         LIMIT 200`
      )
      .all(...ids) as unknown as Place[];
    return rows.map((row) => ({ ...row }));
  }

  addPlace(
    member: Member,
    input: { name: string; kind: string; latitude: number; longitude: number },
    now: Date = new Date()
  ): Place | CommunityError {
    if (!moderateText(input.name).clean) return 'texte_refuse';

    const id = newId();
    this.db
      .prepare(
        `INSERT INTO places (id, neighborhood_id, name, kind, latitude, longitude, added_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        member.neighborhoodId,
        input.name,
        input.kind,
        input.latitude,
        input.longitude,
        member.id,
        now.toISOString()
      );
    return { id, name: input.name, kind: input.kind, latitude: input.latitude, longitude: input.longitude };
  }

  // --- Mode vacances (§4.13) -------------------------------------------

  /** Absence en cours ou à venir du voisin, s'il en a déclaré une. */
  vacation(member: Member, now: Date = new Date()): Vacation | undefined {
    const row = this.db
      .prepare(
        `SELECT id, starts_on, ends_on, note FROM vacations
         WHERE member_id = ? AND ends_on >= ?
         ORDER BY starts_on LIMIT 1`
      )
      .get(member.id, now.toISOString().slice(0, 10)) as unknown as
      | { id: string; starts_on: string; ends_on: string; note: string | null }
      | undefined;
    if (!row) return undefined;

    const watchers = this.db
      .prepare(
        `SELECT m.id, m.first_name FROM vacation_watchers w
         JOIN members m ON m.id = w.member_id
         WHERE w.vacation_id = ?`
      )
      .all(row.id) as unknown as { id: string; first_name: string }[];

    return {
      id: row.id,
      startsOn: row.starts_on,
      endsOn: row.ends_on,
      note: row.note ?? undefined,
      watchers: watchers.map((w) => ({ id: w.id, name: w.first_name })),
    };
  }

  declareVacation(
    member: Member,
    input: { startsOn: string; endsOn: string; note?: string; watcherIds: string[] },
    now: Date = new Date()
  ): Vacation | CommunityError {
    if (input.note && !moderateText(input.note).clean) return 'texte_refuse';
    for (const watcherId of input.watcherIds) {
      if (!this.neighborOf(member, watcherId)) return 'voisin_inconnu';
    }

    // Une seule absence courante : déclarer remplace, sinon on empile des
    // absences oubliées que personne ne relit.
    this.cancelVacation(member, now);

    const id = newId();
    this.db
      .prepare(
        'INSERT INTO vacations (id, member_id, starts_on, ends_on, note, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(id, member.id, input.startsOn, input.endsOn, input.note ?? null, now.toISOString());

    for (const watcherId of input.watcherIds) {
      this.db
        .prepare('INSERT INTO vacation_watchers (vacation_id, member_id) VALUES (?, ?)')
        .run(id, watcherId);
    }

    return this.vacation(member, now)!;
  }

  cancelVacation(member: Member, now: Date = new Date()): void {
    const current = this.vacation(member, now);
    if (current) this.db.prepare('DELETE FROM vacations WHERE id = ?').run(current.id);
  }

  /** Absences que ce voisin a accepté de surveiller — lui seul les voit. */
  watchedVacations(member: Member, now: Date = new Date()): WatchedVacation[] {
    const rows = this.db
      .prepare(
        `SELECT v.id, v.starts_on, v.ends_on, v.note, m.first_name
         FROM vacation_watchers w
         JOIN vacations v ON v.id = w.vacation_id
         JOIN members m ON m.id = v.member_id
         WHERE w.member_id = ? AND v.ends_on >= ?
         ORDER BY v.starts_on`
      )
      .all(member.id, now.toISOString().slice(0, 10)) as unknown as {
      id: string;
      starts_on: string;
      ends_on: string;
      note: string | null;
      first_name: string;
    }[];

    return rows.map((row) => ({
      id: row.id,
      neighborName: row.first_name,
      startsOn: row.starts_on,
      endsOn: row.ends_on,
      note: row.note ?? undefined,
    }));
  }

  // --- Collecte des déchets (§4.14) ------------------------------------

  wasteSlots(member: Member): WasteSlot[] {
    const { ids, places } = this.scope(member);
    const rows = this.db
      .prepare(
        `SELECT id, kind, weekday, hour FROM waste_slots
         WHERE neighborhood_id IN (${places})
         ORDER BY weekday, hour`
      )
      .all(...ids) as unknown as WasteSlot[];
    return rows.map((row) => ({ ...row, weekday: Number(row.weekday) }));
  }

  addWasteSlot(
    member: Member,
    input: { kind: string; weekday: number; hour: string },
    now: Date = new Date()
  ): WasteSlot {
    const id = newId();
    this.db
      .prepare(
        `INSERT INTO waste_slots (id, neighborhood_id, kind, weekday, hour, updated_by, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, member.neighborhoodId, input.kind, input.weekday, input.hour, member.id, now.toISOString());
    return { id, kind: input.kind, weekday: input.weekday, hour: input.hour };
  }

  removeWasteSlot(member: Member, slotId: string): boolean {
    const { ids, places } = this.scope(member);
    const row = this.db
      .prepare(`SELECT id FROM waste_slots WHERE id = ? AND neighborhood_id IN (${places})`)
      .get(slotId, ...ids);
    if (!row) return false;

    this.db.prepare('DELETE FROM waste_slots WHERE id = ?').run(slotId);
    return true;
  }

  // --- Actions solidaires (§4.15) --------------------------------------

  solidarityActions(member: Member): SolidarityAction[] {
    const { ids, places } = this.scope(member);
    const rows = this.db
      .prepare(
        `SELECT a.id, a.title, a.kind, a.details, a.happens_on, a.created_by,
                COUNT(p.member_id) AS participants,
                MAX(CASE WHEN p.member_id = ? THEN 1 ELSE 0 END) AS joined
         FROM solidarity_actions a
         LEFT JOIN solidarity_participants p ON p.action_id = a.id
         WHERE a.neighborhood_id IN (${places})
         GROUP BY a.id
         ORDER BY a.created_at DESC, a.rowid DESC
         LIMIT 50`
      )
      .all(member.id, ...ids) as unknown as {
      id: string;
      title: string;
      kind: string;
      details: string | null;
      happens_on: string | null;
      created_by: string;
      participants: number;
      joined: number;
    }[];

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      kind: row.kind,
      details: row.details ?? undefined,
      happensOn: row.happens_on ?? undefined,
      participants: Number(row.participants),
      joined: row.joined === 1,
      createdByMe: row.created_by === member.id,
    }));
  }

  createSolidarityAction(
    member: Member,
    input: { title: string; kind: string; details?: string; happensOn?: string },
    now: Date = new Date()
  ): SolidarityAction | CommunityError {
    if (!moderateText(`${input.title} ${input.details ?? ''}`).clean) return 'texte_refuse';

    const id = newId();
    this.db
      .prepare(
        `INSERT INTO solidarity_actions (id, neighborhood_id, title, kind, details, happens_on, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        member.neighborhoodId,
        input.title,
        input.kind,
        input.details ?? null,
        input.happensOn ?? null,
        member.id,
        now.toISOString()
      );
    this.setParticipation(member, id, true, now);
    return this.solidarityActions(member).find((action) => action.id === id)!;
  }

  setParticipation(
    member: Member,
    actionId: string,
    joined: boolean,
    now: Date = new Date()
  ): SolidarityAction | CommunityError {
    const exists = this.db.prepare('SELECT id FROM solidarity_actions WHERE id = ?').get(actionId);
    if (!exists) return 'introuvable';

    if (joined) {
      this.db
        .prepare(
          `INSERT INTO solidarity_participants (action_id, member_id, joined_at) VALUES (?, ?, ?)
           ON CONFLICT (action_id, member_id) DO NOTHING`
        )
        .run(actionId, member.id, now.toISOString());
    } else {
      this.db
        .prepare('DELETE FROM solidarity_participants WHERE action_id = ? AND member_id = ?')
        .run(actionId, member.id);
    }

    return this.solidarityActions(member).find((action) => action.id === actionId)!;
  }
}
