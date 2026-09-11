import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

import type { Member } from './repository.js';

/**
 * Catégories reprises du cahier des charges (§4.17), plus les messages privés
 * et le SOS, qui sont arrivés depuis.
 */
export const NOTIFICATION_KINDS = [
  'securite',
  'reponse',
  'message',
  'sos',
  'annonce',
  'evenement',
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Identifiant de ce qui l'a provoquée : publication, voisin, alerte. */
  ref?: string;
  createdAt: string;
  read: boolean;
}

/** Au-delà, on ne remonte plus : personne ne relit une semaine en arrière. */
const GARDE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Journal de ce qui est arrivé à un voisin.
 *
 * Écrit ici plutôt que déduit à la lecture : un « X a répondu à ta
 * publication » doit rester exact même si la publication est modifiée ou
 * masquée plus tard, et un voisin doit pouvoir retrouver ce qu'il a manqué
 * sans que son téléphone ait reçu quoi que ce soit.
 */
export class NotificationService {
  constructor(private readonly db: DatabaseSync) {}

  /** Dépose la même notification pour plusieurs voisins d'un coup. */
  notify(
    memberIds: string[],
    kind: NotificationKind,
    title: string,
    body: string,
    ref?: string,
    now: Date = new Date()
  ): void {
    const insert = this.db.prepare(
      `INSERT INTO notifications (id, member_id, kind, title, body, ref, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const stamp = now.toISOString();
    for (const id of new Set(memberIds)) {
      insert.run(crypto.randomUUID(), id, kind, title, body, ref ?? null, stamp);
    }
  }

  list(member: Member, now: Date = new Date()): Notification[] {
    const depuis = new Date(now.getTime() - GARDE_MS).toISOString();
    const rows = this.db
      .prepare(
        `SELECT id, kind, title, body, ref, created_at, read_at
         FROM notifications
         WHERE member_id = ? AND created_at >= ?
         ORDER BY created_at DESC, rowid DESC
         LIMIT 100`
      )
      .all(member.id, depuis) as {
      id: string;
      kind: string;
      title: string;
      body: string;
      ref: string | null;
      created_at: string;
      read_at: string | null;
    }[];

    return rows.map((row) => ({
      id: row.id,
      kind: row.kind as NotificationKind,
      title: row.title,
      body: row.body,
      ref: row.ref ?? undefined,
      createdAt: row.created_at,
      read: row.read_at !== null,
    }));
  }

  unread(member: Member): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS n FROM notifications WHERE member_id = ? AND read_at IS NULL')
      .get(member.id) as { n: number };
    return Number(row.n);
  }

  /** Marque une notification comme lue, ou toutes si aucune n'est précisée. */
  markRead(member: Member, id?: string, now: Date = new Date()): void {
    if (id) {
      this.db
        .prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND member_id = ? AND read_at IS NULL')
        .run(now.toISOString(), id, member.id);
      return;
    }

    this.db
      .prepare('UPDATE notifications SET read_at = ? WHERE member_id = ? AND read_at IS NULL')
      .run(now.toISOString(), member.id);
  }
}
