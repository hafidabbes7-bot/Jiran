import type { Comment, Neighbor, Post, Report, Session } from '../domain/types';

/**
 * Contrat d'accès aux données de Jiran.
 *
 * L'implémentation actuelle (`LocalRepository`) stocke tout sur l'appareil :
 * elle permet de faire tourner et tester le socle V1 sans backend. Le vrai
 * backend demandé au §7 (comptes vérifiés par SMS, file de modération, temps
 * réel) doit implémenter cette même interface, sans que les écrans changent.
 */
export interface JiranRepository {
  loadSession(): Promise<Session | null>;
  saveSession(session: Session): Promise<void>;
  clearSession(): Promise<void>;

  /** Fil du quartier, jumelage compris — le plus récent d'abord. */
  loadPosts(neighborhoodIds: string[]): Promise<Post[]>;
  createPost(post: Post): Promise<void>;
  setLiked(postId: string, liked: boolean): Promise<void>;

  loadComments(postId: string): Promise<Comment[]>;
  /** Nombre de réponses par publication, pour l'affichage du fil. */
  loadCommentCounts(): Promise<Record<string, number>>;
  addComment(comment: Comment): Promise<void>;

  loadReports(): Promise<Report[]>;
  addReport(report: Report): Promise<void>;

  loadNeighbors(): Promise<Neighbor[]>;
  setTrusted(neighborId: string, trusted: boolean): Promise<void>;
}

/** Identifiant du voisin connecté, tant qu'il n'y a pas de comptes serveur. */
export const CURRENT_USER_ID = 'me';
