import type {
  Category,
  Comment,
  ModerationState,
  Neighbor,
  Post,
  ReportReason,
  Session,
} from '../domain/types';

/**
 * Contrat d'accès aux données de Jiran.
 *
 * Tout le contenu vit sur le serveur : c'est la seule façon pour deux voisins
 * de voir le même fil, et pour la règle des trois signalements de compter trois
 * personnes différentes. Seuls la session et les voisins de confiance du SOS
 * restent sur l'appareil.
 */
export interface JiranRepository {
  /** Jeton de session à présenter au serveur, ou `null` avant l'inscription. */
  setToken(token: string | null): void;

  loadSession(): Promise<Session | null>;
  saveSession(session: Session): Promise<void>;
  clearSession(): Promise<void>;

  /** Enregistre le profil du voisin auprès du serveur, après vérification. */
  saveProfile(session: Session): Promise<void>;

  /** Fil du quartier, jumelage compris — le plus récent d'abord. */
  loadFeed(): Promise<Post[]>;
  createPost(input: { category: Category; text: string }): Promise<void>;
  setLiked(postId: string, liked: boolean): Promise<void>;

  loadComments(postId: string): Promise<Comment[]>;
  addComment(postId: string, text: string): Promise<void>;

  /** Signale une publication et renvoie le verdict mis à jour. */
  report(
    postId: string,
    reason: ReportReason
  ): Promise<{ accepted: boolean; moderation: ModerationState }>;

  /** Voisins du fil, avec leur statut « de confiance » stocké localement. */
  loadNeighbors(): Promise<Neighbor[]>;
  setTrusted(neighborId: string, trusted: boolean): Promise<void>;
}

/** Erreur remontée quand le serveur est injoignable ou refuse la requête. */
export class RepositoryError extends Error {
  constructor(
    message: string,
    readonly kind: 'network' | 'unauthorized' | 'rejected' | 'inappropriate_text'
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}
