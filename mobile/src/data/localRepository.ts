import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Comment, Neighbor, Post, Report, Session } from '../domain/types';
import { seedComments, seedNeighbors, seedPosts } from './seed';
import type { JiranRepository } from './repository';

const KEYS = {
  session: 'jiran/session',
  posts: 'jiran/posts',
  comments: 'jiran/comments',
  reports: 'jiran/reports',
  neighbors: 'jiran/neighbors',
} as const;

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    // Un stockage corrompu ne doit pas empêcher l'application de démarrer :
    // on repart des valeurs par défaut plutôt que de planter au lancement.
    return fallback;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

/**
 * Stockage local, sur l'appareil. Permet d'utiliser et de tester tout le socle
 * V1 sans backend ; à remplacer par un client HTTP/WebSocket implémentant
 * `JiranRepository` (§7.5).
 */
export class LocalRepository implements JiranRepository {
  async loadSession(): Promise<Session | null> {
    return readJson<Session | null>(KEYS.session, null);
  }

  async saveSession(session: Session): Promise<void> {
    await writeJson(KEYS.session, session);
    // Premier lancement : on amorce le quartier avec le contenu de démonstration.
    const existing = await readJson<Post[] | null>(KEYS.posts, null);
    if (existing === null) {
      await writeJson(KEYS.posts, seedPosts(session.neighborhoodId));
      await writeJson(KEYS.comments, seedComments());
      await writeJson(KEYS.neighbors, seedNeighbors());
    }
  }

  async clearSession(): Promise<void> {
    await AsyncStorage.removeMany(Object.values(KEYS));
  }

  async loadPosts(neighborhoodIds: string[]): Promise<Post[]> {
    const posts = await readJson<Post[]>(KEYS.posts, []);
    return posts
      .filter((post) => neighborhoodIds.includes(post.neighborhoodId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createPost(post: Post): Promise<void> {
    const posts = await readJson<Post[]>(KEYS.posts, []);
    await writeJson(KEYS.posts, [post, ...posts]);
  }

  async setLiked(postId: string, liked: boolean): Promise<void> {
    const posts = await readJson<Post[]>(KEYS.posts, []);
    await writeJson(
      KEYS.posts,
      posts.map((post) =>
        post.id === postId
          ? { ...post, likedByMe: liked, likes: Math.max(0, post.likes + (liked ? 1 : -1)) }
          : post
      )
    );
  }

  async loadComments(postId: string): Promise<Comment[]> {
    const comments = await readJson<Comment[]>(KEYS.comments, []);
    return comments
      .filter((comment) => comment.postId === postId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async loadCommentCounts(): Promise<Record<string, number>> {
    const comments = await readJson<Comment[]>(KEYS.comments, []);
    return comments.reduce<Record<string, number>>((counts, comment) => {
      counts[comment.postId] = (counts[comment.postId] ?? 0) + 1;
      return counts;
    }, {});
  }

  async addComment(comment: Comment): Promise<void> {
    const comments = await readJson<Comment[]>(KEYS.comments, []);
    await writeJson(KEYS.comments, [...comments, comment]);
  }

  async loadReports(): Promise<Report[]> {
    return readJson<Report[]>(KEYS.reports, []);
  }

  async addReport(report: Report): Promise<void> {
    const reports = await readJson<Report[]>(KEYS.reports, []);
    await writeJson(KEYS.reports, [...reports, report]);
  }

  async loadNeighbors(): Promise<Neighbor[]> {
    return readJson<Neighbor[]>(KEYS.neighbors, seedNeighbors());
  }

  async setTrusted(neighborId: string, trusted: boolean): Promise<void> {
    const neighbors = await this.loadNeighbors();
    await writeJson(
      KEYS.neighbors,
      neighbors.map((n) => (n.id === neighborId ? { ...n, trusted } : n))
    );
  }
}
