/** Catégories du socle V1 (§5 du cahier des charges). */
export type Category = 'securite' | 'entraide' | 'annonce' | 'evenement';

/** Filtre du fil : les catégories, plus « tout ». */
export type CategoryFilter = Category | 'tout';

export type Language = 'fr' | 'ar';

/** Pays couverts par Jiran. */
export type Country = 'DZ' | 'CA';

export interface Neighborhood {
  id: string;
  country: Country;
  /** Nom du quartier / de la commune, tel qu'utilisé aussi par As3ar. */
  name: string;
  nameAr: string;
  /** Wilaya en Algérie, province au Canada. */
  region: string;
  regionAr: string;
  /** Code officiel : « 06 » pour Béjaïa, « QC » pour le Québec. */
  regionCode: string;
  /** Daïra en Algérie ; absent au Canada, où le découpage s'arrête à la province. */
  subRegion?: string;
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
  /**
   * Renseigné par le serveur à l'inscription. N'ouvre aucun droit par
   * lui-même : il ne fait qu'afficher l'entrée « Modération », le serveur
   * refusant de toute façon la file à qui n'y a pas droit.
   */
  isModerator?: boolean;
}

/** Une publication signalée, telle que la voit un modérateur (§7.4). */
export interface QueuedPost {
  postId: string;
  authorName: string;
  category: Category;
  text: string;
  neighborhoodId: string;
  createdAt: string;
  reports: { reason: ReportReason; createdAt: string }[];
  moderation: ModerationState;
  /** Note laissée par le modérateur qui a déjà tranché. */
  note?: string;
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
  /** `true` si c'est une publication du voisin connecté. */
  authorIsMe: boolean;
  category: Category;
  text: string;
  /** Quartier d'origine — toujours affiché, y compris sur un fil jumelé. */
  neighborhoodId: string;
  building?: string;
  createdAt: string;
  likes: number;
  likedByMe: boolean;
  commentCount: number;
  /** `true` si le voisin connecté a déjà signalé cette publication. */
  reportedByMe: boolean;
  moderation: ModerationState;
}

export type ReportReason = 'spam' | 'inapproprie' | 'fausse_alerte' | 'autre';

/**
 * Verdict de modération, **calculé par le serveur**.
 *
 * L'application ne le recalcule pas : elle ne voit que ses propres
 * signalements, alors que la règle compte trois voisins différents (§3).
 */
export interface ModerationState {
  /** Nombre de cycles de 3 signalements distincts déjà atteints. */
  cycles: number;
  /** Fin du masquage temporaire (ISO), absent si blocage permanent. */
  hiddenUntil?: string;
  permanent: boolean;
  /** Verdict prêt à l'emploi : le contenu doit-il être masqué maintenant. */
  hidden: boolean;
  /** Renseigné quand un modérateur a tranché lui-même. */
  decidedByModerator?: 'block' | 'restore';
}

export interface Neighbor {
  id: string;
  name: string;
  building?: string;
  /** Voisin désigné comme personne de confiance pour l'alerte SOS. */
  trusted: boolean;
  /** Date d'arrivée dans le quartier, pour repérer les nouveaux venus. */
  joinedAt: string;
}

/** Une partie de morpion telle que le serveur la montre au voisin (§4.8). */
export interface Game {
  id: string;
  kind: 'morpion';
  status: 'waiting' | 'playing' | 'won' | 'draw';
  /** Neuf caractères : `.` pour une case libre, sinon `X` ou `O`. */
  board: string;
  hostName: string;
  opponentName?: string;
  /** Absente si le voisin ne joue pas cette partie — il ne fait que la voir. */
  yourMark?: 'X' | 'O';
  yourTurn: boolean;
  outcome?: 'gagne' | 'perdu' | 'nul';
  updatedAt: string;
}

// --- Vie de quartier (§4.6, §4.9 à §4.15) ------------------------------

export interface Conversation {
  neighborId: string;
  neighborName: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
}

export interface ChatMessage {
  id: string;
  fromMe: boolean;
  text: string;
  createdAt: string;
}

export interface Service {
  id: string;
  name: string;
  trade: string;
  phone?: string;
  recommendations: number;
  /** Moyenne des notes, sur 5. */
  rating: number;
  recommendedByMe: boolean;
}

export interface Item {
  id: string;
  name: string;
  ownerName: string;
  ownerIsMe: boolean;
  status: 'disponible' | 'emprunte';
  borrowerName?: string;
  borrowedByMe: boolean;
  /** Date de retour promise, au format AAAA-MM-JJ. */
  dueDate?: string;
}

export interface Group {
  id: string;
  name: string;
  emoji: string;
  members: number;
  joined: boolean;
}

export interface GroupPost {
  id: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export type PlaceKind = 'pharmacie' | 'ecole' | 'mosquee' | 'bus' | 'sante' | 'autre';

export interface Place {
  id: string;
  name: string;
  kind: PlaceKind;
  latitude: number;
  longitude: number;
}

export interface Vacation {
  id: string;
  startsOn: string;
  endsOn: string;
  note?: string;
  watchers: { id: string; name: string }[];
}

export interface WatchedVacation {
  id: string;
  neighborName: string;
  startsOn: string;
  endsOn: string;
  note?: string;
}

export type WasteKind = 'ordures' | 'recyclable' | 'encombrants';

export interface WasteSlot {
  id: string;
  kind: WasteKind;
  /** 0 = dimanche, 6 = samedi. */
  weekday: number;
  hour: string;
}

export type SolidarityKind = 'sang' | 'vetements' | 'ramadan' | 'autre';

export interface SolidarityAction {
  id: string;
  title: string;
  kind: SolidarityKind;
  details?: string;
  happensOn?: string;
  participants: number;
  joined: boolean;
  createdByMe: boolean;
}

/** Une alerte SOS en cours, telle que l'application la montre (§4.16). */
export interface ActiveSos {
  id: string;
  fromName: string;
  building?: string;
  /** Vrai s'il s'agit de sa propre alerte : on propose alors de l'annuler. */
  mine: boolean;
  latitude?: number;
  longitude?: number;
  createdAt: string;
}
