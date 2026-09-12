import crypto from 'node:crypto';

import type { Db } from '../db/client.js';
import { estUuid, toIso, toNumber } from '../db/rows.js';
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
  constructor(private readonly db: Db) {}

  /** Dépose la même notification pour plusieurs voisins d'un coup. */
  async notify(
    memberIds: string[],
    kind: NotificationKind,
    title: string,
    body: string,
    ref?: string,
    now: Date = new Date()
  ): Promise<void> {
    const destinataires = [...new Set(memberIds)].filter(estUuid);
    if (destinataires.length === 0) return;

    // Une seule requête pour tout le quartier : une alerte de sécurité touche
    // tout le monde, et autant d'allers-retours que de voisins retarderait la
    // réponse à celui qui vient de publier.
    await this.db.query(
      `INSERT INTO notifications (id, member_id, kind, title, body, ref, created_at)
       SELECT gen_random_uuid(), destinataire, $2, $3, $4, $5, $6
       FROM unnest($1::uuid[]) AS destinataire`,
      [destinataires, kind, title, body, ref ?? null, now.toISOString()]
    );
  }

  async list(member: Member, now: Date = new Date()): Promise<Notification[]> {
    const depuis = new Date(now.getTime() - GARDE_MS).toISOString();
    const rows = await this.db.query<{
      id: string;
      kind: string;
      title: string;
      body: string;
      ref: string | null;
      created_at: Date;
      read_at: Date | null;
    }>(
      `SELECT id, kind, title, body, ref, created_at, read_at
       FROM notifications
       WHERE member_id = $1 AND created_at >= $2
       ORDER BY created_at DESC, id DESC
       LIMIT 100`,
      [member.id, depuis]
    );

    return rows.map((row) => ({
      id: row.id,
      kind: row.kind as NotificationKind,
      title: row.title,
      body: row.body,
      ref: row.ref ?? undefined,
      createdAt: toIso(row.created_at),
      read: row.read_at !== null,
    }));
  }

  async unread(member: Member): Promise<number> {
    const row = await this.db.one<{ n: string }>(
      'SELECT COUNT(*) AS n FROM notifications WHERE member_id = $1 AND read_at IS NULL',
      [member.id]
    );
    return toNumber(row?.n);
  }

  /** Marque une notification comme lue, ou toutes si aucune n'est précisée. */
  async markRead(member: Member, id?: string, now: Date = new Date()): Promise<void> {
    if (id && !estUuid(id)) return;

    if (id) {
      await this.db.query(
        'UPDATE notifications SET read_at = $1 WHERE id = $2 AND member_id = $3 AND read_at IS NULL',
        [now.toISOString(), id, member.id]
      );
      return;
    }

    await this.db.query(
      'UPDATE notifications SET read_at = $1 WHERE member_id = $2 AND read_at IS NULL',
      [now.toISOString(), member.id]
    );
  }
}
