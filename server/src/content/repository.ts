import crypto from 'node:crypto';

import type { Db } from '../db/client.js';
import { estUuid, toBool, toIso, toNumber } from '../db/rows.js';
import { kindOf, type IdentifierKind } from '../identity.js';
import { readDecisions } from './decisions.js';
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
  /** Numéro de téléphone ou adresse e-mail, vérifié. C'est lui qui possède le compte. */
  identifier: string;
  identifierKind: IdentifierKind;
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
  constructor(private readonly db: Db) {}

  // --- Membres ---------------------------------------------------------

  async findMemberByIdentifier(identifier: string): Promise<Member | undefined> {
    const row = await this.db.one<Record<string, unknown>>(
      `SELECT id, identifier, identifier_kind, first_name, neighborhood_id, building, joined_at
       FROM members WHERE identifier = $1`,
      [identifier]
    );

    return row ? toMember(row) : undefined;
  }

  /**
   * Crée le membre au premier passage, met à jour son profil ensuite.
   *
   * L'identifiant — numéro ou adresse — vient du jeton de session, jamais du
   * corps de la requête : c'est ce qui rattache l'historique à la personne
   * vérifiée plutôt qu'à l'appareil.
   */
  async saveMember(input: {
    identifier: string;
    firstName: string;
    neighborhoodId: string;
    building?: string;
  }): Promise<Member> {
    const row = await this.db.one<Record<string, unknown>>(
      `INSERT INTO members (id, identifier, identifier_kind, first_name, neighborhood_id, building)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (identifier) DO UPDATE SET
         first_name = excluded.first_name,
         neighborhood_id = excluded.neighborhood_id,
         building = excluded.building,
         updated_at = now()
       RETURNING id, identifier, identifier_kind, first_name, neighborhood_id, building, joined_at`,
      [
        newId(),
        input.identifier,
        kindOf(input.identifier),
        input.firstName,
        input.neighborhoodId,
        input.building ?? null,
      ]
    );

    return toMember(row!);
  }

  /**
   * Voisins du même fil : liste de confiance du SOS, et repérage des nouveaux
   * arrivants à qui souhaiter la bienvenue.
   */
  async neighbors(member: Member): Promise<
    { id: string; name: string; building?: string; joinedAt: string }[]
  > {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT id, first_name, building, joined_at FROM members
       WHERE neighborhood_id = ANY($1) AND id <> $2
       ORDER BY first_name`,
      [sharedFeedNeighborhoodIds(member.neighborhoodId), member.id]
    );

    return rows.map((row) => ({
      id: String(row.id),
      name: String(row.first_name),
      building: (row.building as string | null) ?? undefined,
      joinedAt: toIso(row.joined_at),
    }));
  }

  // --- Fil -------------------------------------------------------------

  /**
   * Fil du quartier, jumelage compris. Les contenus bloqués ne sont pas
   * retirés de la liste : l'application affiche le bandeau à leur place, comme
   * le prévoit le prototype.
   *
   * Signalements et décisions sont relus en deux requêtes pour tout le fil, et
   * non une par publication : deux cents allers-retours pour afficher un
   * écran, ce serait l'application lente sur un réseau lent.
   */
  async feed(member: Member, now: Date = new Date()): Promise<FeedPost[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT p.id, p.category, p.body, p.neighborhood_id, p.building, p.photo_id, p.created_at,
              m.first_name AS author_name,
              (p.author_id = $1) AS author_is_me,
              (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS likes,
              EXISTS (SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.member_id = $1) AS liked_by_me,
              (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
              EXISTS (SELECT 1 FROM reports r WHERE r.post_id = p.id AND r.reporter_id = $1) AS reported_by_me
       FROM posts p
       JOIN members m ON m.id = p.author_id
       WHERE p.neighborhood_id = ANY($2)
       ORDER BY p.created_at DESC
       LIMIT 200`,
      [member.id, sharedFeedNeighborhoodIds(member.neighborhoodId)]
    );

    const ids = rows.map((row) => String(row.id));
    const [signalements, décisions] = await Promise.all([
      this.reportsOf(ids),
      readDecisions(this.db, ids),
    ]);

    return rows.map((row) => {
      const id = String(row.id);
      return {
        id,
        authorName: String(row.author_name),
        authorIsMe: toBool(row.author_is_me),
        category: String(row.category) as Category,
        text: String(row.body),
        neighborhoodId: String(row.neighborhood_id),
        building: (row.building as string | null) ?? undefined,
        photoId: (row.photo_id as string | null) ?? undefined,
        createdAt: toIso(row.created_at),
        likes: toNumber(row.likes),
        likedByMe: toBool(row.liked_by_me),
        commentCount: toNumber(row.comment_count),
        reportedByMe: toBool(row.reported_by_me),
        moderation: moderationState(signalements.get(id) ?? [], now, décisions.get(id)),
      };
    });
  }

  /** Horodatages des signalements, par publication. */
  private async reportsOf(postIds: readonly string[]): Promise<Map<string, string[]>> {
    const valides = postIds.filter(estUuid);
    if (valides.length === 0) return new Map();

    const rows = await this.db.query<{ post_id: string; created_at: Date }>(
      `SELECT post_id, created_at FROM reports
       WHERE post_id = ANY($1::uuid[]) ORDER BY created_at`,
      [valides]
    );

    const parPublication = new Map<string, string[]>();
    for (const row of rows) {
      const liste = parPublication.get(row.post_id) ?? [];
      liste.push(toIso(row.created_at));
      parPublication.set(row.post_id, liste);
    }
    return parPublication;
  }

  /** Auteur d'une publication, pour prévenir la bonne personne. */
  async authorOf(postId: string): Promise<string | undefined> {
    if (!estUuid(postId)) return undefined;
    const row = await this.db.one<{ author_id: string }>(
      'SELECT author_id FROM posts WHERE id = $1',
      [postId]
    );
    return row?.author_id;
  }

  /** Tous les membres du fil d'un voisin, lui compris. */
  async memberIdsOfFeed(member: Member): Promise<string[]> {
    const rows = await this.db.query<{ id: string }>(
      'SELECT id FROM members WHERE neighborhood_id = ANY($1)',
      [sharedFeedNeighborhoodIds(member.neighborhoodId)]
    );
    return rows.map((row) => row.id);
  }

  async postExists(postId: string): Promise<boolean> {
    if (!estUuid(postId)) return false;
    return (await this.db.one('SELECT 1 FROM posts WHERE id = $1', [postId])) !== undefined;
  }

  async createPost(
    member: Member,
    input: { category: Category; text: string; photoId?: string },
    now: Date = new Date()
  ): Promise<string> {
    const id = newId();
    await this.db.query(
      `INSERT INTO posts (id, author_id, category, body, neighborhood_id, building, photo_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        member.id,
        input.category,
        input.text,
        member.neighborhoodId,
        member.building ?? null,
        input.photoId ?? null,
        now.toISOString(),
      ]
    );
    return id;
  }

  async setLiked(postId: string, member: Member, liked: boolean): Promise<void> {
    if (liked) {
      await this.db.query(
        `INSERT INTO likes (post_id, member_id) VALUES ($1, $2)
         ON CONFLICT (post_id, member_id) DO NOTHING`,
        [postId, member.id]
      );
      return;
    }

    await this.db.query('DELETE FROM likes WHERE post_id = $1 AND member_id = $2', [
      postId,
      member.id,
    ]);
  }

  // --- Réponses --------------------------------------------------------

  async comments(postId: string): Promise<FeedComment[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT c.id, c.post_id, c.body, c.created_at, m.first_name AS author_name
       FROM comments c JOIN members m ON m.id = c.author_id
       WHERE c.post_id = $1 ORDER BY c.created_at, c.id`,
      [postId]
    );

    return rows.map((row) => ({
      id: String(row.id),
      postId: String(row.post_id),
      authorName: String(row.author_name),
      text: String(row.body),
      createdAt: toIso(row.created_at),
    }));
  }

  async addComment(
    postId: string,
    member: Member,
    text: string,
    now: Date = new Date()
  ): Promise<string> {
    const id = newId();
    await this.db.query(
      'INSERT INTO comments (id, post_id, author_id, body, created_at) VALUES ($1, $2, $3, $4, $5)',
      [id, postId, member.id, text, now.toISOString()]
    );
    return id;
  }

  // --- Signalements ----------------------------------------------------

  /** `false` si ce voisin avait déjà signalé cette publication. */
  async addReport(
    postId: string,
    member: Member,
    reason: string,
    now: Date = new Date()
  ): Promise<boolean> {
    const inséré = await this.db.query(
      `INSERT INTO reports (post_id, reporter_id, reason, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (post_id, reporter_id) DO NOTHING
       RETURNING post_id`,
      [postId, member.id, reason, now.toISOString()]
    );

    return inséré.length > 0;
  }

  async moderationOf(postId: string, now: Date = new Date()): Promise<ModerationState> {
    const [signalements, décisions] = await Promise.all([
      this.reportsOf([postId]),
      readDecisions(this.db, [postId]),
    ]);

    return moderationState(signalements.get(postId) ?? [], now, décisions.get(postId));
  }

  /** Contenus actuellement masqués, pour la file des modérateurs (§7.4). */
  async hiddenCount(member: Member, now: Date = new Date()): Promise<number> {
    const fil = await this.feed(member, now);
    return fil.filter((post) => post.moderation.hidden).length;
  }
}

function toMember(row: Record<string, unknown>): Member {
  return {
    id: String(row.id),
    identifier: String(row.identifier),
    identifierKind: String(row.identifier_kind) as IdentifierKind,
    firstName: String(row.first_name),
    neighborhoodId: String(row.neighborhood_id),
    building: (row.building as string | null) ?? undefined,
    joinedAt: toIso(row.joined_at),
  };
}
