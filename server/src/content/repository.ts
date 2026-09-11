import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

import { readDecision } from './decisions.js';
import { moderationState, type ModerationState } from './moderation.js';
import { sharedFeedNeighborhoodIds } from './neighborhoods.js';

export type Category = 'securite' | 'entraide' | 'annonce' | 'evenement';
export const CATEGORIES: readonly Category[] = [
  'securite',
  'entraide',
  'annonce',
  'evenement',
];

export interface Member {
  id: string;
  phone: string;
  firstName: string;
  neighborhoodId: string;
  building?: string;
  joinedAt: string;
}

export interface FeedPost {
  id: string;
  /** Photo jointe, à charger sur `/photos/:id`. */
  photoId?: string;
  authorName: string;
  authorIsMe: boolean;
  category: Category;
  text: string;
  neighborhoodId: string;
  building?: string;
  createdAt: string;
  likes: number;
  likedByMe: boolean;
  commentCount: number;
  reportedByMe: boolean;
  moderation: ModerationState;
}

export interface FeedComment {
  id: string;
  postId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

const newId = () => crypto.randomUUID();

/** Accès au contenu du quartier. Toutes les lectures sont faites pour un membre donné. */
export class ContentRepository {
  constructor(private readonly db: DatabaseSync) {}

  // --- Membres ---------------------------------------------------------

  findMemberByPhone(phone: string): Member | undefined {
    const row = this.db
      .prepare(
        `SELECT id, phone, first_name, neighborhood_id, building, joined_at
         FROM members WHERE phone = ?`
      )
      .get(phone) as Record<string, string | null> | undefined;

    return row ? this.toMember(row) : undefined;
  }

  /**
   * Crée le membre au premier passage, met à jour son profil ensuite. Le
   * numéro vient du jeton de session, jamais du corps de la requête.
   */
  saveMember(input: {
    phone: string;
    firstName: string;
    neighborhoodId: string;
    building?: string;
  }): Member {
    const existing = this.findMemberByPhone(input.phone);

    if (existing) {
      this.db
        .prepare(
          `UPDATE members SET first_name = ?, neighborhood_id = ?, building = ? WHERE id = ?`
        )
        .run(input.firstName, input.neighborhoodId, input.building ?? null, existing.id);
      return { ...existing, ...input };
    }

    const member: Member = {
      id: newId(),
      phone: input.phone,
      firstName: input.firstName,
      neighborhoodId: input.neighborhoodId,
      building: input.building,
      joinedAt: new Date().toISOString(),
    };

    this.db
      .prepare(
        `INSERT INTO members (id, phone, first_name, neighborhood_id, building, joined_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        member.id,
        member.phone,
        member.firstName,
        member.neighborhoodId,
        member.building ?? null,
        member.joinedAt
      );

    return member;
  }

  /**
   * Voisins du même fil : liste de confiance du SOS, et repérage des nouveaux
   * arrivants à qui souhaiter la bienvenue.
   */
  neighbors(member: Member): {
    id: string;
    name: string;
    building?: string;
    joinedAt: string;
  }[] {
    const ids = sharedFeedNeighborhoodIds(member.neighborhoodId);
    const placeholders = ids.map(() => '?').join(', ');

    const rows = this.db
      .prepare(
        `SELECT id, first_name, building, joined_at FROM members
         WHERE neighborhood_id IN (${placeholders}) AND id != ?
         ORDER BY first_name`
      )
      .all(...ids, member.id) as Record<string, string | null>[];

    return rows.map((row) => ({
      id: String(row.id),
      name: String(row.first_name),
      building: row.building ?? undefined,
      joinedAt: String(row.joined_at),
    }));
  }

  // --- Fil -------------------------------------------------------------

  /**
   * Fil du quartier, jumelage compris. Les contenus bloqués ne sont pas
   * retirés de la liste : l'application affiche le bandeau à leur place, comme
   * le prévoit le prototype.
   */
  feed(member: Member, now: Date = new Date()): FeedPost[] {
    const ids = sharedFeedNeighborhoodIds(member.neighborhoodId);
    const placeholders = ids.map(() => '?').join(', ');

    const rows = this.db
      .prepare(
        `SELECT p.id, p.category, p.body, p.neighborhood_id, p.building, p.photo_id, p.created_at,
                m.first_name AS author_name,
                p.author_id = ?1 AS author_is_me,
                (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS likes,
                (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id AND l.member_id = ?1) AS liked_by_me,
                (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
                (SELECT COUNT(*) FROM reports r WHERE r.post_id = p.id AND r.reporter_id = ?1) AS reported_by_me
         FROM posts p
         JOIN members m ON m.id = p.author_id
         WHERE p.neighborhood_id IN (${placeholders})
         ORDER BY p.created_at DESC
         LIMIT 200`
      )
      .all(member.id, ...ids) as Record<string, string | number | null>[];

    return rows.map((row) => {
      const id = String(row.id);
      return {
        id,
        authorName: String(row.author_name),
        authorIsMe: Number(row.author_is_me) === 1,
        category: String(row.category) as Category,
        text: String(row.body),
        neighborhoodId: String(row.neighborhood_id),
        building: (row.building as string | null) ?? undefined,
        photoId: (row.photo_id as string | null) ?? undefined,
        createdAt: String(row.created_at),
        likes: Number(row.likes),
        likedByMe: Number(row.liked_by_me) === 1,
        commentCount: Number(row.comment_count),
        reportedByMe: Number(row.reported_by_me) === 1,
        moderation: this.moderationOf(id, now),
      };
    });
  }

  postExists(postId: string): boolean {
    return this.db.prepare('SELECT 1 FROM posts WHERE id = ?').get(postId) !== undefined;
  }

  createPost(
    member: Member,
    input: { category: Category; text: string; photoId?: string },
    now: Date = new Date()
  ): string {
    const id = newId();
    this.db
      .prepare(
        `INSERT INTO posts (id, author_id, category, body, neighborhood_id, building, photo_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        member.id,
        input.category,
        input.text,
        member.neighborhoodId,
        member.building ?? null,
        input.photoId ?? null,
        now.toISOString()
      );
    return id;
  }

  setLiked(postId: string, member: Member, liked: boolean): void {
    if (liked) {
      this.db
        .prepare('INSERT OR IGNORE INTO likes (post_id, member_id) VALUES (?, ?)')
        .run(postId, member.id);
    } else {
      this.db
        .prepare('DELETE FROM likes WHERE post_id = ? AND member_id = ?')
        .run(postId, member.id);
    }
  }

  // --- Réponses --------------------------------------------------------

  comments(postId: string): FeedComment[] {
    const rows = this.db
      .prepare(
        `SELECT c.id, c.post_id, c.body, c.created_at, m.first_name AS author_name
         FROM comments c JOIN members m ON m.id = c.author_id
         WHERE c.post_id = ? ORDER BY c.created_at`
      )
      .all(postId) as Record<string, string>[];

    return rows.map((row) => ({
      id: String(row.id),
      postId: String(row.post_id),
      authorName: String(row.author_name),
      text: String(row.body),
      createdAt: String(row.created_at),
    }));
  }

  addComment(postId: string, member: Member, text: string, now: Date = new Date()): string {
    const id = newId();
    this.db
      .prepare(
        `INSERT INTO comments (id, post_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)`
      )
      .run(id, postId, member.id, text, now.toISOString());
    return id;
  }

  // --- Signalements ----------------------------------------------------

  /** `false` si ce voisin avait déjà signalé cette publication. */
  addReport(postId: string, member: Member, reason: string, now: Date = new Date()): boolean {
    const result = this.db
      .prepare(
        `INSERT OR IGNORE INTO reports (post_id, reporter_id, reason, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(postId, member.id, reason, now.toISOString());

    return Number(result.changes) > 0;
  }

  moderationOf(postId: string, now: Date = new Date()): ModerationState {
    const rows = this.db
      .prepare('SELECT created_at FROM reports WHERE post_id = ? ORDER BY created_at')
      .all(postId) as { created_at: string }[];

    return moderationState(
      rows.map((row) => row.created_at),
      now,
      // La décision d'un modérateur prime sur le compteur, dans le fil comme
      // dans sa file.
      readDecision(this.db, postId)
    );
  }

  /** Contenus actuellement masqués, pour la file des modérateurs (§7.4). */
  hiddenCount(member: Member, now: Date = new Date()): number {
    return this.feed(member, now).filter((post) => post.moderation.hidden).length;
  }

  private toMember(row: Record<string, string | null>): Member {
    return {
      id: String(row.id),
      phone: String(row.phone),
      firstName: String(row.first_name),
      neighborhoodId: String(row.neighborhood_id),
      building: row.building ?? undefined,
      joinedAt: String(row.joined_at),
    };
  }
}
