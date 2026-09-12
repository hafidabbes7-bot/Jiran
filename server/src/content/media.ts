import crypto from 'node:crypto';

import type { Db } from '../db/client.js';
import { estUuid, toIso } from '../db/rows.js';
import type { PhotoStorage } from '../storage/photos.js';
import { sharedFeedNeighborhoodIds } from './neighborhoods.js';
import type { Member } from './repository.js';
import { moderateText } from './textModeration.js';

/**
 * Taille maximale d'une photo, en octets.
 *
 * L'application réduit chaque image à 1280 px et la ré-encode avant l'envoi :
 * au-delà de 400 Ko, c'est que quelque chose ne s'est pas passé comme prévu.
 */
export const MAX_PHOTO_BYTES = 400 * 1024;

/** Formats acceptés. Le reste est refusé sans discussion : on ne les affiche pas. */
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Durée de vie d'une story, en millisecondes. */
export const STORY_WINDOW_MS = 24 * 60 * 60 * 1000;

export type MediaError = 'trop_lourde' | 'format_refuse' | 'introuvable' | 'texte_refuse';

/**
 * Une photo prête à être servie : soit une adresse publique — c'est le cas
 * quand Supabase Storage est branché — soit les octets eux-mêmes.
 */
export type StoredPhoto = { kind: 'url'; url: string } | { kind: 'bytes'; mime: string; bytes: Uint8Array };

export interface Story {
  id: string;
  authorName: string;
  authorIsMe: boolean;
  photoId?: string;
  text?: string;
  createdAt: string;
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Photos et stories.
 *
 * Les photos ne sont pas modérées automatiquement — la modération d'image
 * demande un service tiers (§7.3). Elles sont donc traitées comme une
 * publication : visibles du seul quartier, signalables, et masquées par la
 * règle des trois signalements comme n'importe quel contenu.
 */
export class MediaService {
  constructor(
    private readonly db: Db,
    /** Absent en développement : les octets retombent alors dans la base. */
    private readonly storage?: PhotoStorage
  ) {}

  async savePhoto(
    member: Member,
    mime: string,
    bytes: Uint8Array
  ): Promise<{ id: string } | MediaError> {
    if (!PHOTO_TYPES.includes(mime as (typeof PHOTO_TYPES)[number])) return 'format_refuse';
    if (bytes.byteLength > MAX_PHOTO_BYTES) return 'trop_lourde';

    const id = crypto.randomUUID();

    if (this.storage) {
      const chemin = `${member.neighborhoodId}/${id}.${EXTENSIONS[mime] ?? 'bin'}`;
      const déposée = await this.storage.upload(chemin, mime, bytes);
      await this.db.query(
        `INSERT INTO photos (id, owner_id, neighborhood_id, mime, storage_path, public_url)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, member.id, member.neighborhoodId, mime, déposée.path, déposée.url]
      );
      return { id };
    }

    await this.db.query(
      `INSERT INTO photos (id, owner_id, neighborhood_id, mime, bytes)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, member.id, member.neighborhoodId, mime, Buffer.from(bytes)]
    );
    return { id };
  }

  /** Une photo n'est lisible que depuis le fil où elle a été déposée. */
  async photo(member: Member, photoId: string): Promise<StoredPhoto | MediaError> {
    if (!estUuid(photoId)) return 'introuvable';
    const row = await this.db.one<{
      mime: string;
      public_url: string | null;
      bytes: Buffer | null;
    }>(
      `SELECT mime, public_url, bytes FROM photos
       WHERE id = $1 AND neighborhood_id = ANY($2)`,
      [photoId, sharedFeedNeighborhoodIds(member.neighborhoodId)]
    );

    if (!row) return 'introuvable';
    if (row.public_url) return { kind: 'url', url: row.public_url };
    if (row.bytes) return { kind: 'bytes', mime: row.mime, bytes: row.bytes };
    return 'introuvable';
  }

  /** Vérifie qu'une photo existe et appartient bien à celui qui la joint. */
  async ownsPhoto(member: Member, photoId: string): Promise<boolean> {
    if (!estUuid(photoId)) return false;
    const row = await this.db.one('SELECT 1 FROM photos WHERE id = $1 AND owner_id = $2', [
      photoId,
      member.id,
    ]);
    return row !== undefined;
  }

  // --- Stories ---------------------------------------------------------

  async stories(member: Member, now: Date = new Date()): Promise<Story[]> {
    const depuis = new Date(now.getTime() - STORY_WINDOW_MS).toISOString();

    const rows = await this.db.query<{
      id: string;
      photo_id: string | null;
      body: string | null;
      created_at: Date;
      author_id: string;
      first_name: string;
    }>(
      `SELECT s.id, s.photo_id, s.body, s.created_at, s.author_id, m.first_name
       FROM stories s JOIN members m ON m.id = s.author_id
       WHERE s.neighborhood_id = ANY($1) AND s.created_at >= $2
       ORDER BY s.created_at DESC, s.id DESC
       LIMIT 60`,
      [sharedFeedNeighborhoodIds(member.neighborhoodId), depuis]
    );

    return rows.map((row) => ({
      id: row.id,
      authorName: row.first_name,
      authorIsMe: row.author_id === member.id,
      photoId: row.photo_id ?? undefined,
      text: row.body ?? undefined,
      createdAt: toIso(row.created_at),
    }));
  }

  async addStory(
    member: Member,
    input: { photoId?: string; text?: string },
    now: Date = new Date()
  ): Promise<Story | MediaError> {
    if (input.text && !moderateText(input.text).clean) return 'texte_refuse';
    if (input.photoId && !(await this.ownsPhoto(member, input.photoId))) return 'introuvable';

    const id = crypto.randomUUID();
    const stamp = now.toISOString();
    await this.db.query(
      `INSERT INTO stories (id, author_id, neighborhood_id, photo_id, body, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, member.id, member.neighborhoodId, input.photoId ?? null, input.text ?? null, stamp]
    );

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
  async removeStory(member: Member, storyId: string): Promise<boolean> {
    if (!estUuid(storyId)) return false;
    const supprimées = await this.db.query(
      'DELETE FROM stories WHERE id = $1 AND author_id = $2 RETURNING id',
      [storyId, member.id]
    );
    return supprimées.length > 0;
  }
}
