import AsyncStorage from '@react-native-async-storage/async-storage';

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
  Notification,
  Post,
  QueuedPost,
  ReportReason,
  Session,
  Story,
} from '../domain/types';
import { API_URL } from './authService';
import { RepositoryError, type JiranRepository, type SosResult } from './repository';

const KEYS = {
  session: 'jiran/session',
  /** Identifiants des voisins de confiance : un choix propre à l'appareil. */
  trusted: 'jiran/trusted',
} as const;

const TIMEOUT_MS = 12_000;

type JsonObject = Record<string, any>;

/**
 * Client HTTP du serveur Jiran.
 *
 * La session reste sur l'appareil pour ne pas redemander le numéro à chaque
 * ouverture ; tout le reste vient du serveur.
 */
export class HttpRepository implements JiranRepository {
  private token: string | null = null;

  setToken(token: string | null): void {
    this.token = token;
  }

  // --- Session locale --------------------------------------------------

  async loadSession(): Promise<Session | null> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.session);
      const session = raw ? reprendreSession(JSON.parse(raw)) : null;
      this.token = session?.token ?? null;
      return session;
    } catch {
      // Stockage illisible : mieux vaut refaire l'inscription que planter au
      // lancement.
      return null;
    }
  }

  async saveSession(session: Session): Promise<void> {
    this.token = session.token;
    await AsyncStorage.setItem(KEYS.session, JSON.stringify(session));
  }

  async clearSession(): Promise<void> {
    this.token = null;
    await AsyncStorage.removeMany([KEYS.session, KEYS.trusted]);
  }

  // --- Profil ----------------------------------------------------------

  async saveProfile(session: Session): Promise<{ isModerator: boolean }> {
    this.token = session.token;
    const data = await this.request('POST', '/profile', {
      firstName: session.firstName,
      neighborhoodId: session.neighborhoodId,
      ...(session.building ? { building: session.building } : {}),
    });
    return { isModerator: Boolean(data.isModerator) };
  }

  // --- Fil -------------------------------------------------------------

  async loadFeed(): Promise<Post[]> {
    const data = await this.request('GET', '/feed');
    const posts = Array.isArray(data.posts) ? data.posts : [];
    return posts.map(toPost);
  }

  async uploadPhoto(base64: string, mime: string): Promise<string> {
    const data = await this.request('POST', '/photos', { data: base64, mime });
    return String(data.id);
  }

  photoUri(photoId: string): string {
    // Le jeton voyage dans l'adresse : une balise <img> ne sait pas poser
    // d'en-tête. Il ne sort pas du serveur de Jiran, qui est aussi celui qui
    // sert l'application.
    return `${API_URL}/photos/${encodeURIComponent(photoId)}?t=${encodeURIComponent(this.token ?? '')}`;
  }

  async loadStories(): Promise<Story[]> {
    const data = await this.request('GET', '/stories');
    return (Array.isArray(data.stories) ? data.stories : []).map(toStory);
  }

  async addStory(input: { photoId?: string; text?: string }): Promise<Story> {
    const data = await this.request('POST', '/stories', input);
    return toStory(data.story);
  }

  async removeStory(storyId: string): Promise<void> {
    await this.request('DELETE', `/stories/${encodeURIComponent(storyId)}`);
  }

  async createPost(input: { category: Category; text: string; photoId?: string }): Promise<void> {
    await this.request('POST', '/posts', input);
  }

  async setLiked(postId: string, liked: boolean): Promise<void> {
    await this.request('POST', `/posts/${encodeURIComponent(postId)}/like`, { liked });
  }

  async loadComments(postId: string): Promise<Comment[]> {
    const data = await this.request('GET', `/posts/${encodeURIComponent(postId)}/comments`);
    const comments = Array.isArray(data.comments) ? data.comments : [];
    return comments.map(
      (comment: JsonObject): Comment => ({
        id: String(comment.id),
        postId: String(comment.postId),
        authorName: String(comment.authorName),
        text: String(comment.text),
        createdAt: String(comment.createdAt),
      })
    );
  }

  async addComment(postId: string, text: string): Promise<void> {
    await this.request('POST', `/posts/${encodeURIComponent(postId)}/comments`, { text });
  }

  async report(
    postId: string,
    reason: ReportReason
  ): Promise<{ accepted: boolean; moderation: ModerationState }> {
    const data = await this.request(
      'POST',
      `/posts/${encodeURIComponent(postId)}/report`,
      { reason },
      // 409 = ce voisin avait déjà signalé : ce n'est pas une panne, le
      // serveur renvoie quand même le verdict à jour.
      [201, 409]
    );

    return { accepted: Boolean(data.accepted), moderation: toModeration(data.moderation) };
  }

  // --- Voisins ---------------------------------------------------------

  async loadNeighbors(): Promise<Neighbor[]> {
    const data = await this.request('GET', '/neighbors');
    const trusted = await this.trustedIds();
    const neighbors = Array.isArray(data.neighbors) ? data.neighbors : [];

    return neighbors.map(
      (neighbor: JsonObject): Neighbor => ({
        id: String(neighbor.id),
        name: String(neighbor.name),
        building: neighbor.building ? String(neighbor.building) : undefined,
        trusted: trusted.includes(String(neighbor.id)),
        joinedAt: String(neighbor.joinedAt),
      })
    );
  }

  async setTrusted(neighborId: string, trusted: boolean): Promise<void> {
    const current = await this.trustedIds();
    const next = trusted
      ? [...new Set([...current, neighborId])]
      : current.filter((id) => id !== neighborId);
    await AsyncStorage.setItem(KEYS.trusted, JSON.stringify(next));
  }

  // --- Modération ------------------------------------------------------

  async loadModerationQueue(): Promise<QueuedPost[]> {
    const data = await this.request('GET', '/moderation/queue');
    const posts = Array.isArray(data.posts) ? data.posts : [];

    return posts.map(
      (raw: JsonObject): QueuedPost => ({
        postId: String(raw.postId),
        authorName: String(raw.authorName),
        category: String(raw.category) as Category,
        text: String(raw.text),
        neighborhoodId: String(raw.neighborhoodId),
        createdAt: String(raw.createdAt),
        reports: (Array.isArray(raw.reports) ? raw.reports : []).map((report: JsonObject) => ({
          reason: String(report.reason) as ReportReason,
          createdAt: String(report.createdAt),
        })),
        moderation: toModeration(raw.moderation),
        ...(raw.note ? { note: String(raw.note) } : {}),
      })
    );
  }

  async decideModeration(
    postId: string,
    decision: 'block' | 'restore',
    note?: string
  ): Promise<ModerationState> {
    const data = await this.request(
      'POST',
      `/moderation/posts/${encodeURIComponent(postId)}/decision`,
      { decision, ...(note ? { note } : {}) }
    );
    return toModeration(data.moderation);
  }

  // --- Jeux ------------------------------------------------------------

  async loadGames(): Promise<Game[]> {
    const data = await this.request('GET', '/games');
    return (Array.isArray(data.games) ? data.games : []).map(toGame);
  }

  async createGame(): Promise<Game> {
    const data = await this.request('POST', '/games', { kind: 'morpion' });
    return toGame(data.game);
  }

  async joinGame(gameId: string): Promise<Game> {
    const data = await this.request('POST', `/games/${encodeURIComponent(gameId)}/join`);
    return toGame(data.game);
  }

  async playMove(gameId: string, cell: number): Promise<Game> {
    const data = await this.request('POST', `/games/${encodeURIComponent(gameId)}/move`, { cell });
    return toGame(data.game);
  }

  // --- Vie de quartier -------------------------------------------------

  async loadConversations(): Promise<Conversation[]> {
    const data = await this.request('GET', '/messages');
    return (Array.isArray(data.conversations) ? data.conversations : []).map(
      (raw: JsonObject): Conversation => ({
        neighborId: String(raw.neighborId),
        neighborName: String(raw.neighborName),
        lastMessage: String(raw.lastMessage ?? ''),
        lastAt: String(raw.lastAt ?? ''),
        unread: Number(raw.unread ?? 0),
      })
    );
  }

  async loadMessages(neighborId: string): Promise<ChatMessage[]> {
    const data = await this.request('GET', `/messages/${encodeURIComponent(neighborId)}`);
    return (Array.isArray(data.messages) ? data.messages : []).map(toChatMessage);
  }

  async sendMessage(neighborId: string, text: string): Promise<ChatMessage> {
    const data = await this.request('POST', `/messages/${encodeURIComponent(neighborId)}`, { text });
    return toChatMessage(data.message);
  }

  async loadServices(): Promise<Service[]> {
    const data = await this.request('GET', '/services');
    return (Array.isArray(data.services) ? data.services : []).map(toService);
  }

  async addService(input: { name: string; trade: string; phone?: string }): Promise<Service> {
    const data = await this.request('POST', '/services', input);
    return toService(data.service);
  }

  async recommendService(serviceId: string, rating: number): Promise<Service> {
    const data = await this.request(
      'POST',
      `/services/${encodeURIComponent(serviceId)}/recommend`,
      { rating }
    );
    return toService(data.service);
  }

  async loadItems(): Promise<Item[]> {
    const data = await this.request('GET', '/items');
    return (Array.isArray(data.items) ? data.items : []).map(toItem);
  }

  async addItem(name: string): Promise<Item> {
    const data = await this.request('POST', '/items', { name });
    return toItem(data.item);
  }

  async borrowItem(itemId: string, dueDate?: string): Promise<Item> {
    const data = await this.request('POST', `/items/${encodeURIComponent(itemId)}/borrow`, {
      ...(dueDate ? { dueDate } : {}),
    });
    return toItem(data.item);
  }

  async returnItem(itemId: string): Promise<Item> {
    const data = await this.request('POST', `/items/${encodeURIComponent(itemId)}/return`);
    return toItem(data.item);
  }

  async loadGroups(): Promise<Group[]> {
    const data = await this.request('GET', '/groups');
    return (Array.isArray(data.groups) ? data.groups : []).map(toGroup);
  }

  async createGroup(name: string, emoji: string): Promise<Group> {
    const data = await this.request('POST', '/groups', { name, emoji });
    return toGroup(data.group);
  }

  async setGroupMembership(groupId: string, joined: boolean): Promise<Group> {
    const data = await this.request(
      'POST',
      `/groups/${encodeURIComponent(groupId)}/membership`,
      { joined }
    );
    return toGroup(data.group);
  }

  async loadGroupPosts(groupId: string): Promise<GroupPost[]> {
    const data = await this.request('GET', `/groups/${encodeURIComponent(groupId)}/posts`);
    return (Array.isArray(data.posts) ? data.posts : []).map(toGroupPost);
  }

  async addGroupPost(groupId: string, text: string): Promise<GroupPost> {
    const data = await this.request('POST', `/groups/${encodeURIComponent(groupId)}/posts`, { text });
    return toGroupPost(data.post);
  }

  async loadPlaces(): Promise<Place[]> {
    const data = await this.request('GET', '/places');
    return (Array.isArray(data.places) ? data.places : []).map(toPlace);
  }

  async addPlace(input: {
    name: string;
    kind: PlaceKind;
    latitude: number;
    longitude: number;
  }): Promise<Place> {
    const data = await this.request('POST', '/places', input);
    return toPlace(data.place);
  }

  async loadVacation(): Promise<{ vacation: Vacation | null; watched: WatchedVacation[] }> {
    const data = await this.request('GET', '/vacation');
    return {
      vacation: data.vacation ? toVacation(data.vacation) : null,
      watched: (Array.isArray(data.watched) ? data.watched : []).map(
        (raw: JsonObject): WatchedVacation => ({
          id: String(raw.id),
          neighborName: String(raw.neighborName),
          startsOn: String(raw.startsOn),
          endsOn: String(raw.endsOn),
          note: raw.note ? String(raw.note) : undefined,
        })
      ),
    };
  }

  async declareVacation(input: {
    startsOn: string;
    endsOn: string;
    note?: string;
    watcherIds: string[];
  }): Promise<Vacation> {
    const data = await this.request('POST', '/vacation', input);
    return toVacation(data.vacation);
  }

  async cancelVacation(): Promise<void> {
    await this.request('DELETE', '/vacation');
  }

  async loadWasteSlots(): Promise<WasteSlot[]> {
    const data = await this.request('GET', '/waste');
    return (Array.isArray(data.slots) ? data.slots : []).map(toWasteSlot);
  }

  async addWasteSlot(input: { kind: WasteKind; weekday: number; hour: string }): Promise<WasteSlot> {
    const data = await this.request('POST', '/waste', input);
    return toWasteSlot(data.slot);
  }

  async removeWasteSlot(slotId: string): Promise<void> {
    await this.request('DELETE', `/waste/${encodeURIComponent(slotId)}`);
  }

  async loadSolidarityActions(): Promise<SolidarityAction[]> {
    const data = await this.request('GET', '/solidarity');
    return (Array.isArray(data.actions) ? data.actions : []).map(toAction);
  }

  async createSolidarityAction(input: {
    title: string;
    kind: SolidarityKind;
    details?: string;
    happensOn?: string;
  }): Promise<SolidarityAction> {
    const data = await this.request('POST', '/solidarity', input);
    return toAction(data.action);
  }

  async setParticipation(actionId: string, joined: boolean): Promise<SolidarityAction> {
    const data = await this.request(
      'POST',
      `/solidarity/${encodeURIComponent(actionId)}/participation`,
      { joined }
    );
    return toAction(data.action);
  }

  // --- Alertes ---------------------------------------------------------

  async registerDevice(token: string, platform: 'ios' | 'android' | 'web'): Promise<void> {
    await this.request('POST', '/devices', { token, platform });
  }

  async triggerSos(
    neighborIds: string[],
    position?: { latitude: number; longitude: number }
  ): Promise<SosResult> {
    const data = await this.request('POST', '/sos', {
      neighborIds,
      ...(position ? { position } : {}),
    });

    return {
      alertId: String(data.alertId),
      alerted: Number(data.alerted) || 0,
      devices: Number(data.devices) || 0,
      delivered: Boolean(data.delivered),
    };
  }

  async loadNotifications(): Promise<{ notifications: Notification[]; unread: number }> {
    const data = await this.request('GET', '/notifications');
    return {
      notifications: (Array.isArray(data.notifications) ? data.notifications : []).map(
        (raw: JsonObject): Notification => ({
          id: String(raw.id),
          kind: String(raw.kind) as Notification['kind'],
          title: String(raw.title),
          body: String(raw.body ?? ''),
          ref: raw.ref ? String(raw.ref) : undefined,
          createdAt: String(raw.createdAt ?? ''),
          read: Boolean(raw.read),
        })
      ),
      unread: Number(data.unread ?? 0),
    };
  }

  async markNotificationsRead(id?: string): Promise<void> {
    await this.request('POST', '/notifications/read', id ? { id } : {});
  }

  async loadActiveSos(): Promise<ActiveSos[]> {
    const data = await this.request('GET', '/sos/active');
    return (Array.isArray(data.alerts) ? data.alerts : []).map(
      (raw: JsonObject): ActiveSos => ({
        id: String(raw.id),
        fromName: String(raw.fromName),
        building: raw.building ? String(raw.building) : undefined,
        mine: Boolean(raw.mine),
        latitude: raw.latitude === undefined || raw.latitude === null ? undefined : Number(raw.latitude),
        longitude: raw.longitude === undefined || raw.longitude === null ? undefined : Number(raw.longitude),
        createdAt: String(raw.createdAt),
      })
    );
  }

  async cancelSos(alertId: string): Promise<void> {
    await this.request('POST', `/sos/${encodeURIComponent(alertId)}/cancel`);
  }

  private async trustedIds(): Promise<string[]> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.trusted);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  // --- Transport -------------------------------------------------------

  private async request(
    method: string,
    path: string,
    body?: unknown,
    acceptedStatuses: number[] = [200, 201, 204]
  ): Promise<JsonObject> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let status: number;
    let data: JsonObject;

    try {
      const response = await fetch(`${API_URL}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
      });
      status = response.status;
      data = status === 204 ? {} : ((await response.json().catch(() => ({}))) as JsonObject);
    } catch {
      throw new RepositoryError('Serveur injoignable', 'network');
    } finally {
      clearTimeout(timeout);
    }

    if (acceptedStatuses.includes(status)) return data;

    if (status === 403 && data.error === 'profile_required') {
      throw new RepositoryError('Profil à recréer', 'profile_required');
    }
    if (status === 401 || status === 403) {
      throw new RepositoryError('Session refusée', 'unauthorized');
    }
    if (status === 422 && data.error === 'inappropriate_text') {
      throw new RepositoryError('Texte refusé par la modération', 'inappropriate_text');
    }
    throw new RepositoryError(`Requête refusée (${status})`, 'rejected');
  }
}

/**
 * Relit une session enregistrée, y compris celle d'une version où le compte
 * était forcément un numéro.
 *
 * Sans cela, les voisins déjà inscrits se retrouveraient devant l'inscription
 * au prochain lancement — et perdraient leur fil pour une histoire de nom de
 * champ.
 */
function reprendreSession(raw: JsonObject): Session {
  const identifier = String(raw.identifier ?? raw.phone ?? '');
  return {
    ...(raw as unknown as Session),
    identifier,
    identifierKind: raw.identifierKind === 'email' || identifier.includes('@') ? 'email' : 'phone',
  };
}

function toStory(raw: JsonObject): Story {
  return {
    id: String(raw.id),
    authorName: String(raw.authorName),
    authorIsMe: Boolean(raw.authorIsMe),
    photoId: raw.photoId ? String(raw.photoId) : undefined,
    text: raw.text ? String(raw.text) : undefined,
    createdAt: String(raw.createdAt ?? ''),
  };
}

function toChatMessage(raw: JsonObject): ChatMessage {
  return {
    id: String(raw.id),
    fromMe: Boolean(raw.fromMe),
    text: String(raw.text ?? ''),
    createdAt: String(raw.createdAt ?? ''),
  };
}

function toService(raw: JsonObject): Service {
  return {
    id: String(raw.id),
    name: String(raw.name),
    trade: String(raw.trade),
    phone: raw.phone ? String(raw.phone) : undefined,
    recommendations: Number(raw.recommendations ?? 0),
    rating: Number(raw.rating ?? 0),
    recommendedByMe: Boolean(raw.recommendedByMe),
  };
}

function toItem(raw: JsonObject): Item {
  return {
    id: String(raw.id),
    name: String(raw.name),
    ownerName: String(raw.ownerName),
    ownerIsMe: Boolean(raw.ownerIsMe),
    status: raw.status === 'emprunte' ? 'emprunte' : 'disponible',
    borrowerName: raw.borrowerName ? String(raw.borrowerName) : undefined,
    borrowedByMe: Boolean(raw.borrowedByMe),
    dueDate: raw.dueDate ? String(raw.dueDate) : undefined,
  };
}

function toGroup(raw: JsonObject): Group {
  return {
    id: String(raw.id),
    name: String(raw.name),
    emoji: String(raw.emoji ?? '👥'),
    members: Number(raw.members ?? 0),
    joined: Boolean(raw.joined),
  };
}

function toGroupPost(raw: JsonObject): GroupPost {
  return {
    id: String(raw.id),
    authorName: String(raw.authorName),
    text: String(raw.text ?? ''),
    createdAt: String(raw.createdAt ?? ''),
  };
}

function toPlace(raw: JsonObject): Place {
  return {
    id: String(raw.id),
    name: String(raw.name),
    kind: String(raw.kind) as PlaceKind,
    latitude: Number(raw.latitude),
    longitude: Number(raw.longitude),
  };
}

function toVacation(raw: JsonObject): Vacation {
  return {
    id: String(raw.id),
    startsOn: String(raw.startsOn),
    endsOn: String(raw.endsOn),
    note: raw.note ? String(raw.note) : undefined,
    watchers: (Array.isArray(raw.watchers) ? raw.watchers : []).map((watcher: JsonObject) => ({
      id: String(watcher.id),
      name: String(watcher.name),
    })),
  };
}

function toWasteSlot(raw: JsonObject): WasteSlot {
  return {
    id: String(raw.id),
    kind: String(raw.kind) as WasteKind,
    weekday: Number(raw.weekday ?? 0),
    hour: String(raw.hour ?? '00:00'),
  };
}

function toAction(raw: JsonObject): SolidarityAction {
  return {
    id: String(raw.id),
    title: String(raw.title),
    kind: String(raw.kind) as SolidarityKind,
    details: raw.details ? String(raw.details) : undefined,
    happensOn: raw.happensOn ? String(raw.happensOn) : undefined,
    participants: Number(raw.participants ?? 0),
    joined: Boolean(raw.joined),
    createdByMe: Boolean(raw.createdByMe),
  };
}

/** Une partie telle qu'elle arrive du serveur, ramenée au type de l'application. */
function toGame(raw: JsonObject): Game {
  return {
    id: String(raw.id),
    kind: 'morpion',
    status: String(raw.status) as Game['status'],
    board: String(raw.board ?? '.........'),
    hostName: String(raw.hostName ?? ''),
    opponentName: raw.opponentName ? String(raw.opponentName) : undefined,
    yourMark: raw.yourMark === 'X' || raw.yourMark === 'O' ? raw.yourMark : undefined,
    yourTurn: Boolean(raw.yourTurn),
    outcome: raw.outcome ? (String(raw.outcome) as Game['outcome']) : undefined,
    updatedAt: String(raw.updatedAt ?? ''),
  };
}

function toModeration(value: unknown): ModerationState {
  const raw = (value ?? {}) as JsonObject;
  return {
    cycles: Number(raw.cycles) || 0,
    permanent: Boolean(raw.permanent),
    hidden: Boolean(raw.hidden),
    ...(typeof raw.hiddenUntil === 'string' ? { hiddenUntil: raw.hiddenUntil } : {}),
    ...(raw.decidedByModerator === 'block' || raw.decidedByModerator === 'restore'
      ? { decidedByModerator: raw.decidedByModerator }
      : {}),
  };
}

function toPost(raw: JsonObject): Post {
  return {
    id: String(raw.id),
    authorName: String(raw.authorName),
    authorIsMe: Boolean(raw.authorIsMe),
    photoId: raw.photoId ? String(raw.photoId) : undefined,
    category: String(raw.category) as Category,
    text: String(raw.text),
    neighborhoodId: String(raw.neighborhoodId),
    building: raw.building ? String(raw.building) : undefined,
    createdAt: String(raw.createdAt),
    likes: Number(raw.likes) || 0,
    likedByMe: Boolean(raw.likedByMe),
    commentCount: Number(raw.commentCount) || 0,
    reportedByMe: Boolean(raw.reportedByMe),
    moderation: toModeration(raw.moderation),
  };
}
