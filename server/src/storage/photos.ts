import { Buffer } from 'node:buffer';

import { config } from '../config.js';

/**
 * Où vivent les photos.
 *
 * Pas sur le disque du serveur : sur un hébergement gratuit, ce disque
 * disparaît à chaque redémarrage, et une photo perdue ne revient pas. Pas non
 * plus dans la base, sauf faute de mieux : 400 Ko par photo rempliraient les
 * 500 Mo offerts en quelques centaines de publications.
 */
export interface PhotoStorage {
  readonly name: string;
  /** Dépose les octets et rend l'adresse publique de la photo. */
  upload(path: string, mime: string, bytes: Uint8Array): Promise<{ url: string; path: string }>;
  /** Retire la photo. Une photo déjà absente n'est pas une erreur. */
  remove(path: string): Promise<void>;
}

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Supabase Storage, par son API HTTP.
 *
 * Écrit avec `fetch` plutôt qu'avec le paquet `@supabase/supabase-js` : trois
 * appels suffisent, et une dépendance de moins est une dépendance de moins à
 * suivre. La clé de service ne quitte jamais le serveur.
 */
export class SupabaseStorage implements PhotoStorage {
  readonly name = 'supabase';

  constructor(
    private readonly url: string,
    private readonly serviceKey: string,
    private readonly bucket: string
  ) {}

  async upload(
    path: string,
    mime: string,
    bytes: Uint8Array
  ): Promise<{ url: string; path: string }> {
    const réponse = await fetch(this.objectUrl(path), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.serviceKey}`,
        'content-type': mime,
        // Un identifiant de photo est unique ; l'écrasement ne sert qu'à
        // rendre un réessai inoffensif.
        'x-upsert': 'true',
      },
      body: Buffer.from(bytes),
    });

    if (!réponse.ok) {
      throw new StorageError(
        `Supabase a refusé le dépôt (${réponse.status}) : ${(await réponse.text().catch(() => '')).slice(0, 200)}`
      );
    }

    return { url: this.publicUrl(path), path };
  }

  async remove(path: string): Promise<void> {
    const réponse = await fetch(this.objectUrl(path), {
      method: 'DELETE',
      headers: { authorization: `Bearer ${this.serviceKey}` },
    });

    // 404 : la photo n'est plus là, ce qui est exactement le but.
    if (!réponse.ok && réponse.status !== 404) {
      throw new StorageError(`Supabase a refusé la suppression (${réponse.status})`);
    }
  }

  private objectUrl(path: string): string {
    return `${this.url}/storage/v1/object/${this.bucket}/${path}`;
  }

  private publicUrl(path: string): string {
    return `${this.url}/storage/v1/object/public/${this.bucket}/${path}`;
  }
}

/**
 * Espace de stockage configuré, ou `undefined`.
 *
 * Sans Supabase, les photos retombent dans la base : l'application continue de
 * marcher en développement et pendant les essais, et `/health` dit lequel des
 * deux est en service plutôt que de le laisser deviner.
 */
export function createPhotoStorage(): PhotoStorage | undefined {
  const { url, serviceKey, bucket } = config.supabase;
  if (!url || !serviceKey) return undefined;

  return new SupabaseStorage(url.replace(/\/+$/, ''), serviceKey, bucket);
}
