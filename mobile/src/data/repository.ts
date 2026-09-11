import type {
  Category,
  Comment,
  ModerationState,
  Neighbor,
  Post,
  QueuedPost,
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

  /**
   * Enregistre le profil du voisin auprès du serveur après vérification, et
   * renvoie ce que le serveur en dit — dont son rôle de modérateur.
   */
  saveProfile(session: Session): Promise<{ isModerator: boolean }>;

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

  /** Enregistre l'appareil pour recevoir les alertes et les SOS. */
  registerDevice(token: string, platform: 'ios' | 'android' | 'web'): Promise<void>;

  /** Déclenche un SOS vers les voisins choisis. */
  triggerSos(
    neighborIds: string[],
    position?: { latitude: number; longitude: number }
  ): Promise<SosResult>;

  /** Annule un SOS : les mêmes voisins sont prévenus que c'est une fausse alerte. */
  cancelSos(alertId: string): Promise<void>;

  /** File des contenus signalés — réservée aux modérateurs par le serveur. */
  loadModerationQueue(): Promise<QueuedPost[]>;
  decideModeration(
    postId: string,
    decision: 'block' | 'restore',
    note?: string
  ): Promise<ModerationState>;
}

export interface SosResult {
  alertId: string;
  /** Voisins réellement prévenus. */
  alerted: number;
  /** Appareils joints — zéro si aucun n'a encore ouvert l'application. */
  devices: number;
  /** `false` si le serveur ne remet pas encore les notifications. */
  delivered: boolean;
}

/**
 * Erreur remontée quand le serveur est injoignable ou refuse la requête.
 *
 * `unauthorized` et `profile_required` sont distingués à dessein : le premier
 * veut dire que la session ne vaut plus rien et qu'il faut refaire
 * l'inscription, le second qu'il manque seulement le profil — et cela,
 * l'application sait le réparer toute seule.
 */
export class RepositoryError extends Error {
  constructor(
    message: string,
    readonly kind:
      | 'network'
      | 'unauthorized'
      | 'profile_required'
      | 'rejected'
      | 'inappropriate_text'
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}
