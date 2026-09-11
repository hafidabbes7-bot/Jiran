import AsyncStorage from '@react-native-async-storage/async-storage';

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
      const session = raw ? (JSON.parse(raw) as Session) : null;
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

  async createPost(input: { category: Category; text: string }): Promise<void> {
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
