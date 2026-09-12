import type { Db } from '../db/client.js';
import type { PhotoStorage } from '../storage/photos.js';
import { PALIERS } from './retention.js';

export interface RapportNettoyage {
  /** Publications examinées, toutes catégories confondues. */
  examinées: number;
  /** Publications supprimées — et, en cascade, leurs j'aime et réponses. */
  supprimées: number;
  /** Photos retirées de Supabase Storage. */
  photosRetirées: number;
  /** Photos que le stockage a refusé de rendre ; la ligne reste en base. */
  photosEnÉchec: number;
  /** Vrai si rien n'a été écrit : simple aperçu. */
  aperçu: boolean;
  /** Identifiants concernés, pour pouvoir vérifier ce qui a été fait. */
  ids: string[];
}

interface PostÀSupprimer {
  id: string;
  created_at: Date;
  interactions: number;
  jours: number;
  photo_id: string | null;
  storage_path: string | null;
  /** Vrai si la photo sert encore ailleurs — une story, une autre publication. */
  photo_partagée: boolean;
}

/**
 * Ménage quotidien des publications (et d'elles seules).
 *
 * Ce que ce ménage ne touche jamais, quoi qu'il arrive :
 * les comptes, les quartiers, les conversations et leurs messages, les
 * signalements traités, les décisions de modération. Un message privé ou une
 * trace de modération qui disparaîtrait tout seul serait une perte sèche —
 * pour le voisin comme pour la sécurité du quartier. Seules les publications
 * du fil vieillissent, avec ce qu'elles portent : j'aime, réponses, photo.
 */
export class CleanupService {
  constructor(
    private readonly db: Db,
    private readonly storage?: PhotoStorage
  ) {}

  /**
   * Passe le ménage.
   *
   * `aperçu` (le défaut) ne supprime rien : il dit ce qui partirait. C'est
   * volontaire — une commande destructive ne doit pas être ce qui se produit
   * quand on l'exécute sans réfléchir.
   */
  async run(options?: {
    maintenant?: Date;
    aperçu?: boolean;
    /** Sécurité : au-delà, la passe s'arrête. */
    maxParPasse?: number;
  }): Promise<RapportNettoyage> {
    const maintenant = options?.maintenant ?? new Date();
    const aperçu = options?.aperçu ?? true;
    const max = options?.maxParPasse ?? 500;

    const candidats = await this.candidats(maintenant, max);
    const examinées = await this.total();

    const rapport: RapportNettoyage = {
      examinées,
      supprimées: 0,
      photosRetirées: 0,
      photosEnÉchec: 0,
      aperçu,
      ids: candidats.map((post) => post.id),
    };

    if (aperçu || candidats.length === 0) return rapport;

    for (const post of candidats) {
      // La photo part d'abord : si le stockage refuse, la publication reste,
      // et la passe suivante réessaiera. L'inverse laisserait un fichier
      // orphelin que plus rien ne désigne — de la place perdue pour toujours.
      if (post.storage_path && !post.photo_partagée) {
        if (this.storage) {
          try {
            await this.storage.remove(post.storage_path);
            rapport.photosRetirées += 1;
          } catch (error) {
            console.error(`[cleanup] photo ${post.storage_path} non retirée`, error);
            rapport.photosEnÉchec += 1;
            continue;
          }
        } else {
          // Stockage non configuré : on ne peut pas garantir le retrait du
          // fichier, donc on ne supprime pas la ligne qui le désigne.
          rapport.photosEnÉchec += 1;
          continue;
        }
      }

      // Une transaction par publication : la photo est déjà partie, la base
      // doit suivre ou ne rien changer. Les j'aime, réponses et signalements
      // s'en vont avec, par les contraintes ON DELETE CASCADE du schéma.
      await this.db.tx(async (tx) => {
        await tx.query('DELETE FROM posts WHERE id = $1', [post.id]);
        if (post.photo_id && !post.photo_partagée) {
          await tx.query('DELETE FROM photos WHERE id = $1', [post.photo_id]);
        }
      });

      rapport.supprimées += 1;
    }

    return rapport;
  }

  private async total(): Promise<number> {
    const row = await this.db.one<{ n: string }>('SELECT COUNT(*) AS n FROM posts');
    return Number(row?.n ?? 0);
  }

  /**
   * Publications dont la date de publication a dépassé le palier.
   *
   * Les paliers sont traduits en SQL plutôt que filtrés en mémoire : charger
   * tout le fil pour n'en garder que quelques lignes ferait payer au serveur
   * gratuit exactement ce qu'on cherche à économiser.
   */
  private async candidats(maintenant: Date, max: number): Promise<PostÀSupprimer[]> {
    const cas = PALIERS.map(
      (palier) => `WHEN interactions >= ${palier.interactionsMin} THEN ${palier.jours}`
    ).join('\n             ');

    return this.db.query<PostÀSupprimer>(
      `WITH compté AS (
         SELECT p.id, p.created_at, p.photo_id,
                (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id)
              + (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS interactions
         FROM posts p
       ),
       classé AS (
         SELECT *, CASE ${cas} ELSE ${PALIERS[PALIERS.length - 1]!.jours} END AS jours
         FROM compté
       )
       SELECT c.id, c.created_at, c.interactions, c.jours, c.photo_id,
              ph.storage_path,
              EXISTS (
                SELECT 1 FROM stories s WHERE s.photo_id = c.photo_id
                UNION ALL
                SELECT 1 FROM posts p2 WHERE p2.photo_id = c.photo_id AND p2.id <> c.id
              ) AS photo_partagée
       FROM classé c
       LEFT JOIN photos ph ON ph.id = c.photo_id
       WHERE c.created_at + make_interval(days => c.jours) <= $1
       ORDER BY c.created_at
       LIMIT $2`,
      [maintenant.toISOString(), max]
    );
  }
}
