import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

import { sharedFeedNeighborhoodIds } from './neighborhoods.js';
import type { Member } from './repository.js';
import { moderateText } from './textModeration.js';

/**
 * Taille maximale d'une photo, en octets.
 *
 * L'application réduit chaque image à 1280 px et la ré-encode avant l'envoi :
 * au-delà de 400 Ko, c'est que quelque chose ne s'est pas passé comme prévu, et
 * la base — qui porte aussi tout le reste — n'a pas à l'absorber.
 */
export const MAX_PHOTO_BYTES = 400 * 1024;

/** Formats acceptés. Le reste est refusé sans discussion : on ne les affiche pas. */
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Durée de vie d'une story, en millisecondes. */
export const STORY_WINDOW_MS = 24 * 60 * 60 * 1000;

export type MediaError = 'trop_lourde' | 'format_refuse' | 'introuvable' | 'texte_refuse';

export interface StoredPhoto {
  mime: string;
  bytes: Uint8Array;
}

export interface Story {
  id: string;
  authorName: string;
  authorIsMe: boolean;
  photoId?: string;
  text?: string;
  createdAt: string;
}

/**
 * Photos et stories.
 *
 * Les photos ne sont pas modérées automatiquement — la modération d'image
 * demande un service tiers (§7.3). Elles sont donc traitées comme une
 * publication : visibles du seul quartier, signalables, et masquées par la
 * règle des trois signalements comme n'importe quel contenu. C'est dit à
 * l'écran plutôt que laissé croire.
 */
export class MediaService {
  constructor(private readonly db: DatabaseSync) {}

  savePhoto(
    member: Member,
    mime: string,
    bytes: Uint8Array,
    now: Date = new Date()
  ): { id: string } | MediaError {
    if (!PHOTO_TYPES.includes(mime as (typeof PHOTO_TYPES)[number])) return 'format_refuse';
    if (bytes.byteLength > MAX_PHOTO_BYTES) return 'trop_lourde';

    const id = crypto.randomUUID();
    this.db
      .prepare(
        `INSERT INTO photos (id, owner_id, neighborhood_id, mime, bytes, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, member.id, member.neighborhoodId, mime, bytes, now.toISOString());
    return { id };
  }

  /** Une photo n'est lisible que depuis le fil où elle a été déposée. */
  photo(member: Member, photoId: string): StoredPhoto | MediaError {
    const ids = sharedFeedNeighborhoodIds(member.neighborhoodId);
    const places = ids.map(() => '?').join(', ');
    const row = this.db
      .prepare(`SELECT mime, bytes FROM photos WHERE id = ? AND neighborhood_id IN (${places})`)
      .get(photoId, ...ids) as { mime: string; bytes: Uint8Array } | undefined;

    return row ? { mime: row.mime, bytes: row.bytes } : 'introuvable';
  }

  /** Vérifie qu'une photo existe et appartient bien à celui qui la joint. */
  ownsPhoto(member: Member, photoId: string): boolean {
    return Boolean(
      this.db.prepare('SELECT 1 FROM photos WHERE id = ? AND owner_id = ?').get(photoId, member.id)
    );
  }

  // --- Stories ---------------------------------------------------------

  stories(member: Member, now: Date = new Date()): Story[] {
    const ids = sharedFeedNeighborhoodIds(member.neighborhoodId);
    const places = ids.map(() => '?').join(', ');
    const depuis = new Date(now.getTime() - STORY_WINDOW_MS).toISOString();

    const rows = this.db
      .prepare(
        `SELECT s.id, s.photo_id, s.body, s.created_at, s.author_id, m.first_name
         FROM stories s JOIN members m ON m.id = s.author_id
         WHERE s.neighborhood_id IN (${places}) AND s.created_at >= ?
         ORDER BY s.created_at DESC, s.rowid DESC
         LIMIT 60`
      )
      .all(...ids, depuis) as {
      id: string;
      photo_id: string | null;
      body: string | null;
      created_at: string;
      author_id: string;
      first_name: string;
    }[];

    return rows.map((row) => ({
      id: row.id,
      authorName: row.first_name,
      authorIsMe: row.author_id === member.id,
      photoId: row.photo_id ?? undefined,
      text: row.body ?? undefined,
      createdAt: row.created_at,
    }));
  }

  addStory(
    member: Member,
    input: { photoId?: string; text?: string },
    now: Date = new Date()
  ): Story | MediaError {
    if (input.text && !moderateText(input.text).clean) return 'texte_refuse';
    if (input.photoId && !this.ownsPhoto(member, input.photoId)) return 'introuvable';

    const id = crypto.randomUUID();
    const stamp = now.toISOString();
    this.db
      .prepare(
        `INSERT INTO stories (id, author_id, neighborhood_id, photo_id, body, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, member.id, member.neighborhoodId, input.photoId ?? null, input.text ?? null, stamp);

    return {
      id,
      authorName: member.firstName,
      authorIsMe: true,
      photoId: input.photoId,
      text: input.text,
      createdAt: stamp,
    };
  }

  /** Retire sa propre story. Personne ne peut retirer celle d'un autre. */
  removeStory(member: Member, storyId: string): boolean {
    const row = this.db
      .prepare('SELECT author_id FROM stories WHERE id = ?')
      .get(storyId) as { author_id: string } | undefined;
    if (!row || row.author_id !== member.id) return false;

    this.db.prepare('DELETE FROM stories WHERE id = ?').run(storyId);
    return true;
  }
}
