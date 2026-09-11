import type {
  ActiveSos,
  Category,
  ChatMessage,
  Comment,
  Conversation,
  Game,
  Group,
  GroupPost,
  Item,
  Place,
  PlaceKind,
  Service,
  SolidarityAction,
  SolidarityKind,
  Vacation,
  WasteKind,
  WasteSlot,
  WatchedVacation,
  ModerationState,
  Neighbor,
  Post,
  QueuedPost,
  ReportReason,
  Session,
  Story,
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
  createPost(input: { category: Category; text: string; photoId?: string }): Promise<void>;

  /** Envoie une photo réduite et renvoie son identifiant. */
  uploadPhoto(base64: string, mime: string): Promise<string>;
  /** Adresse d'affichage d'une photo, jeton de session compris. */
  photoUri(photoId: string): string;

  /** Stories du quartier, les plus récentes d'abord. */
  loadStories(): Promise<Story[]>;
  addStory(input: { photoId?: string; text?: string }): Promise<Story>;
  removeStory(storyId: string): Promise<void>;
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

  /** Alertes SOS en cours qui concernent ce voisin — les siennes comprises. */
  loadActiveSos(): Promise<ActiveSos[]>;

  /** Annule un SOS : les mêmes voisins sont prévenus que c'est une fausse alerte. */
  cancelSos(alertId: string): Promise<void>;

  /** Parties du quartier : les siennes, et celles qui cherchent un adversaire. */
  loadGames(): Promise<Game[]>;
  createGame(): Promise<Game>;
  joinGame(gameId: string): Promise<Game>;
  playMove(gameId: string, cell: number): Promise<Game>;

  // --- Vie de quartier (§4.6, §4.9 à §4.15) ----------------------------

  loadConversations(): Promise<Conversation[]>;
  loadMessages(neighborId: string): Promise<ChatMessage[]>;
  sendMessage(neighborId: string, text: string): Promise<ChatMessage>;

  loadServices(): Promise<Service[]>;
  addService(input: { name: string; trade: string; phone?: string }): Promise<Service>;
  recommendService(serviceId: string, rating: number): Promise<Service>;

  loadItems(): Promise<Item[]>;
  addItem(name: string): Promise<Item>;
  borrowItem(itemId: string, dueDate?: string): Promise<Item>;
  returnItem(itemId: string): Promise<Item>;

  loadGroups(): Promise<Group[]>;
  createGroup(name: string, emoji: string): Promise<Group>;
  setGroupMembership(groupId: string, joined: boolean): Promise<Group>;
  loadGroupPosts(groupId: string): Promise<GroupPost[]>;
  addGroupPost(groupId: string, text: string): Promise<GroupPost>;

  loadPlaces(): Promise<Place[]>;
  addPlace(input: {
    name: string;
    kind: PlaceKind;
    latitude: number;
    longitude: number;
  }): Promise<Place>;

  loadVacation(): Promise<{ vacation: Vacation | null; watched: WatchedVacation[] }>;
  declareVacation(input: {
    startsOn: string;
    endsOn: string;
    note?: string;
    watcherIds: string[];
  }): Promise<Vacation>;
  cancelVacation(): Promise<void>;

  loadWasteSlots(): Promise<WasteSlot[]>;
  addWasteSlot(input: { kind: WasteKind; weekday: number; hour: string }): Promise<WasteSlot>;
  removeWasteSlot(slotId: string): Promise<void>;

  loadSolidarityActions(): Promise<SolidarityAction[]>;
  createSolidarityAction(input: {
    title: string;
    kind: SolidarityKind;
    details?: string;
    happensOn?: string;
  }): Promise<SolidarityAction>;
  setParticipation(actionId: string, joined: boolean): Promise<SolidarityAction>;

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
