/** Catégories du socle V1 (§5 du cahier des charges). */
export type Category = 'securite' | 'entraide' | 'annonce' | 'evenement';

/** Filtre du fil : les catégories, plus « tout ». */
export type CategoryFilter = Category | 'tout';

export type Language = 'fr' | 'ar';

export interface Neighborhood {
  id: string;
  /** Nom du quartier / de la commune, tel qu'utilisé aussi par As3ar. */
  name: string;
  nameAr: string;
  wilaya: string;
  wilayaAr: string;
  /** Code de wilaya officiel (16 = Alger, 35 = Boumerdès, 09 = Blida...). */
  wilayaCode: string;
  latitude: number;
  longitude: number;
  /** Rayon accepté pour la vérification par géolocalisation, en mètres. */
  radiusMeters: number;
  /** Nombre de voisins vérifiés déjà inscrits. */
  verifiedNeighbors: number;
  /**
   * Quartier avec lequel celui-ci est jumelé tant qu'il n'a pas atteint le
   * seuil de voisins actifs (§2). Le fil est partagé, mais l'origine exacte
   * reste affichée sur chaque publication.
   */
  twinnedWith?: string;
}

export interface Session {
  firstName: string;
  /** Numéro au format local algérien, normalisé en 0XXXXXXXXX. */
  phone: string;
  /** Date de la vérification du numéro par SMS. */
  phoneVerifiedAt: string;
  /** Jeton de session délivré par le serveur après vérification. */
  token: string;
  neighborhoodId: string;
  /** Champ optionnel « Cité / Immeuble » (§2). */
  building?: string;
  language: Language;
  /** Vrai si la position GPS a été confirmée dans le rayon du quartier. */
  locationVerified: boolean;
  rulesAcceptedAt: string;
  joinedAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface Post {
  id: string;
  authorName: string;
  /** `true` pour les comptes officiels (association de quartier, APC...). */
  authorOfficial?: boolean;
  category: Category;
  text: string;
  /** Quartier d'origine — toujours affiché, y compris sur un fil jumelé. */
  neighborhoodId: string;
  building?: string;
  createdAt: string;
  likes: number;
  likedByMe: boolean;
}

export type ReportReason = 'spam' | 'inapproprie' | 'fausse_alerte' | 'autre';

export interface Report {
  postId: string;
  /** Identifiant du signalant — un même voisin ne compte qu'une fois. */
  reporterId: string;
  reason: ReportReason;
  createdAt: string;
}

/** État de modération d'une publication, dérivé des signalements. */
export interface ModerationState {
  postId: string;
  /** Nombre de cycles de 3 signalements distincts déjà atteints. */
  cycles: number;
  /** Fin du masquage temporaire (ISO), absent si blocage permanent. */
  hiddenUntil?: string;
  permanent: boolean;
}

export interface Neighbor {
  id: string;
  name: string;
  building?: string;
  /** Voisin désigné comme personne de confiance pour l'alerte SOS. */
  trusted: boolean;
}
