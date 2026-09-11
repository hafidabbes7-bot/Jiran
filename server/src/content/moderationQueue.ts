import type { DatabaseSync } from 'node:sqlite';

import { normalizePhone } from '../phone.js';
import { readDecision, writeDecision, type StoredDecision } from './decisions.js';
import { moderationState, type ModerationState } from './moderation.js';
import { sharedFeedNeighborhoodIds } from './neighborhoods.js';
import type { Member } from './repository.js';

export interface QueuedReport {
  reason: string;
  createdAt: string;
}

export interface QueuedPost {
  postId: string;
  authorName: string;
  category: string;
  text: string;
  neighborhoodId: string;
  createdAt: string;
  reports: QueuedReport[];
  moderation: ModerationState;
  /** Note laissée par le modérateur qui a déjà tranché, s'il y en a un. */
  note?: string;
}

/**
 * File d'attente des modérateurs (§7.4).
 *
 * Le blocage automatique fait le gros du travail, mais il ne sait pas
 * distinguer un contenu vraiment problématique d'un voisin pris à partie par
 * trois autres. Un humain doit pouvoir trancher — et surtout rétablir.
 */
export class ModerationQueue {
  constructor(
    private readonly db: DatabaseSync,
    private readonly moderatorPhones: string[]
  ) {}

  isModerator(phone: string): boolean {
    const normalized = normalizePhone(phone);
    return this.moderatorPhones.some((allowed) => normalizePhone(allowed) === normalized);
  }

  /**
   * Publications signalées du quartier du modérateur, les plus signalées
   * d'abord. Les contenus déjà tranchés restent listés : une décision doit
   * pouvoir être revue.
   */
  pending(moderator: Member, now: Date = new Date()): QueuedPost[] {
    const ids = sharedFeedNeighborhoodIds(moderator.neighborhoodId);
    const placeholders = ids.map(() => '?').join(', ');

    const rows = this.db
      .prepare(
        `SELECT p.id, p.category, p.body, p.neighborhood_id, p.created_at,
                m.first_name AS author_name
         FROM posts p
         JOIN members m ON m.id = p.author_id
         WHERE p.neighborhood_id IN (${placeholders})
           AND EXISTS (SELECT 1 FROM reports r WHERE r.post_id = p.id)
         ORDER BY p.created_at DESC
         LIMIT 100`
      )
      .all(...ids) as Record<string, string>[];

    return rows
      .map((row) => {
        const postId = String(row.id);
        const reports = this.reportsOf(postId);
        const decision = this.decisionOf(postId);

        return {
          postId,
          authorName: String(row.author_name),
          category: String(row.category),
          text: String(row.body),
          neighborhoodId: String(row.neighborhood_id),
          createdAt: String(row.created_at),
          reports,
          moderation: moderationState(
            reports.map((report) => report.createdAt),
            now,
            decision
          ),
          ...(decision?.note ? { note: decision.note } : {}),
        };
      })
      .sort((a, b) => b.reports.length - a.reports.length);
  }

  /** Enregistre la décision d'un modérateur, en remplaçant la précédente. */
  decide(
    moderator: Member,
    postId: string,
    decision: 'block' | 'restore',
    note?: string
  ): boolean {
    const exists = this.db.prepare('SELECT 1 FROM posts WHERE id = ?').get(postId);
    if (!exists) return false;

    writeDecision(this.db, postId, moderator.id, decision, note);
    return true;
  }

  decisionOf(postId: string): StoredDecision | undefined {
    return readDecision(this.db, postId);
  }

  private reportsOf(postId: string): QueuedReport[] {
    const rows = this.db
      .prepare('SELECT reason, created_at FROM reports WHERE post_id = ? ORDER BY created_at')
      .all(postId) as { reason: string; created_at: string }[];

    return rows.map((row) => ({ reason: String(row.reason), createdAt: String(row.created_at) }));
  }
}
