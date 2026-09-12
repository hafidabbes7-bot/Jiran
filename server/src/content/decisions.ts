import type { Db } from '../db/client.js';
import { estUuid, toIso } from '../db/rows.js';
import type { ModeratorDecision } from './moderation.js';

export type StoredDecision = ModeratorDecision & { note?: string };

/**
 * Décisions courantes des modérateurs, par publication.
 *
 * Lues à deux endroits — le fil et la file de modération — d'où leur place à
 * part : le verdict affiché aux voisins doit être exactement celui que le
 * modérateur voit dans sa file.
 *
 * La lecture se fait par lot : le fil affiche deux cents publications, et une
 * requête par publication ferait deux cents allers-retours vers la base.
 */
export async function readDecisions(
  db: Db,
  postIds: readonly string[]
): Promise<Map<string, StoredDecision>> {
  const valides = postIds.filter(estUuid);
  if (valides.length === 0) return new Map();

  const rows = await db.query<{
    post_id: string;
    decision: string;
    note: string | null;
    decided_at: Date;
  }>(
    `SELECT post_id, decision, note, decided_at
     FROM moderation_decisions WHERE post_id = ANY($1::uuid[])`,
    [valides]
  );

  return new Map(
    rows.map((row) => [
      row.post_id,
      {
        decision: row.decision === 'block' ? ('block' as const) : ('restore' as const),
        decidedAt: toIso(row.decided_at),
        ...(row.note ? { note: row.note } : {}),
      },
    ])
  );
}

export async function readDecision(db: Db, postId: string): Promise<StoredDecision | undefined> {
  return (await readDecisions(db, [postId])).get(postId);
}

export async function writeDecision(
  db: Db,
  postId: string,
  moderatorId: string,
  decision: 'block' | 'restore',
  note?: string
): Promise<void> {
  await db.query(
    `INSERT INTO moderation_decisions (post_id, moderator_id, decision, note, decided_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (post_id) DO UPDATE SET
       moderator_id = excluded.moderator_id,
       decision = excluded.decision,
       note = excluded.note,
       decided_at = excluded.decided_at`,
    [postId, moderatorId, decision, note ?? null]
  );
}
