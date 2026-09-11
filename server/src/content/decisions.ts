import type { DatabaseSync } from 'node:sqlite';

import type { ModeratorDecision } from './moderation.js';

export type StoredDecision = ModeratorDecision & { note?: string };

/**
 * Décision courante d'un modérateur sur une publication.
 *
 * Lue à deux endroits — le fil et la file de modération — d'où sa place à part :
 * le verdict affiché aux voisins doit être exactement celui que le modérateur
 * voit dans sa file.
 */
export function readDecision(db: DatabaseSync, postId: string): StoredDecision | undefined {
  const row = db
    .prepare('SELECT decision, note, decided_at FROM moderation_decisions WHERE post_id = ?')
    .get(postId) as { decision: string; note: string | null; decided_at: string } | undefined;

  if (!row) return undefined;

  return {
    decision: row.decision === 'block' ? 'block' : 'restore',
    decidedAt: String(row.decided_at),
    ...(row.note ? { note: row.note } : {}),
  };
}

export function writeDecision(
  db: DatabaseSync,
  postId: string,
  moderatorId: string,
  decision: 'block' | 'restore',
  note?: string
): void {
  db.prepare(
    `INSERT INTO moderation_decisions (post_id, moderator_id, decision, note, decided_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(post_id) DO UPDATE SET
       moderator_id = excluded.moderator_id,
       decision = excluded.decision,
       note = excluded.note,
       decided_at = excluded.decided_at`
  ).run(postId, moderatorId, decision, note ?? null, new Date().toISOString());
}
