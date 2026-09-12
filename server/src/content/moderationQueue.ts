import type { Db } from '../db/client.js';
import { estUuid, toIso } from '../db/rows.js';
import { normalizePhone } from '../phone.js';
import { readDecision, readDecisions, writeDecision, type StoredDecision } from './decisions.js';
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
    private readonly db: Db,
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
  async pending(moderator: Member, now: Date = new Date()): Promise<QueuedPost[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT p.id, p.category, p.body, p.neighborhood_id, p.created_at,
              m.first_name AS author_name
       FROM posts p
       JOIN members m ON m.id = p.author_id
       WHERE p.neighborhood_id = ANY($1)
         AND EXISTS (SELECT 1 FROM reports r WHERE r.post_id = p.id)
       ORDER BY p.created_at DESC
       LIMIT 100`,
      [sharedFeedNeighborhoodIds(moderator.neighborhoodId)]
    );

    // Signalements et décisions en deux requêtes pour toute la file, plutôt
    // qu'une paire par publication.
    const ids = rows.map((row) => String(row.id));
    const [signalements, décisions] = await Promise.all([
      this.reportsOf(ids),
      readDecisions(this.db, ids),
    ]);

    return rows
      .map((row) => {
        const postId = String(row.id);
        const reports = signalements.get(postId) ?? [];
        const decision = décisions.get(postId);

        return {
          postId,
          authorName: String(row.author_name),
          category: String(row.category),
          text: String(row.body),
          neighborhoodId: String(row.neighborhood_id),
          createdAt: toIso(row.created_at),
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
  async decide(
    moderator: Member,
    postId: string,
    decision: 'block' | 'restore',
    note?: string
  ): Promise<boolean> {
    if (!estUuid(postId)) return false;

    const exists = await this.db.one('SELECT 1 FROM posts WHERE id = $1', [postId]);
    if (!exists) return false;

    await writeDecision(this.db, postId, moderator.id, decision, note);
    return true;
  }

  async decisionOf(postId: string): Promise<StoredDecision | undefined> {
    return readDecision(this.db, postId);
  }

  /** Signalements par publication, pour toute une file d'un coup. */
  private async reportsOf(postIds: readonly string[]): Promise<Map<string, QueuedReport[]>> {
    if (postIds.length === 0) return new Map();

    const rows = await this.db.query<{ post_id: string; reason: string; created_at: Date }>(
      `SELECT post_id, reason, created_at FROM reports
       WHERE post_id = ANY($1::uuid[]) ORDER BY created_at`,
      [postIds]
    );

    const parPublication = new Map<string, QueuedReport[]>();
    for (const row of rows) {
      const liste = parPublication.get(row.post_id) ?? [];
      liste.push({ reason: row.reason, createdAt: toIso(row.created_at) });
      parPublication.set(row.post_id, liste);
    }
    return parPublication;
  }
}
