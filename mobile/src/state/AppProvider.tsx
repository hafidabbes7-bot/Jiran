import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { computeModerationState, isHidden } from '../domain/moderation/blocking';
import type {
  Category,
  Comment,
  Language,
  ModerationState,
  Neighbor,
  Post,
  Report,
  ReportReason,
  Session,
} from '../domain/types';
import { sharedFeedNeighborhoodIds } from '../data/neighborhoods';
import { CURRENT_USER_ID, type JiranRepository } from '../data/repository';

let idCounter = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${idCounter++}`;

export interface PublishInput {
  category: Category;
  text: string;
}

interface AppValue {
  ready: boolean;
  session: Session | null;
  posts: Post[];
  /** État de modération par publication, recalculé à chaque signalement. */
  moderation: Record<string, ModerationState>;
  neighbors: Neighbor[];
  /** Nombre de réponses par publication. */
  commentCounts: Record<string, number>;

  register: (session: Session) => Promise<void>;
  signOut: () => Promise<void>;
  /** Mémorise la langue choisie depuis le fil, pour les prochains démarrages. */
  updateLanguage: (language: Language) => Promise<void>;

  publish: (input: PublishInput) => Promise<Post>;
  toggleLike: (postId: string) => Promise<void>;
  loadComments: (postId: string) => Promise<Comment[]>;
  addComment: (postId: string, text: string) => Promise<void>;
  /** `false` si ce voisin avait déjà signalé cette publication. */
  report: (postId: string, reason: ReportReason) => Promise<boolean>;
  setTrusted: (neighborId: string, trusted: boolean) => Promise<void>;
}

const AppContext = createContext<AppValue | null>(null);

export function AppProvider({
  repository,
  children,
}: {
  repository: JiranRepository;
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [neighbors, setNeighbors] = useState<Neighbor[]>([]);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  const refreshFeed = useCallback(
    async (current: Session) => {
      const ids = sharedFeedNeighborhoodIds(current.neighborhoodId);
      const [loadedPosts, loadedReports, loadedNeighbors, counts] = await Promise.all([
        repository.loadPosts(ids),
        repository.loadReports(),
        repository.loadNeighbors(),
        repository.loadCommentCounts(),
      ]);
      setPosts(loadedPosts);
      setReports(loadedReports);
      setNeighbors(loadedNeighbors);
      setCommentCounts(counts);
    },
    [repository]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await repository.loadSession();
      if (cancelled) return;
      setSession(stored);
      if (stored) await refreshFeed(stored);
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [repository, refreshFeed]);

  const register = useCallback(
    async (next: Session) => {
      await repository.saveSession(next);
      setSession(next);
      await refreshFeed(next);
    },
    [repository, refreshFeed]
  );

  const updateLanguage = useCallback(
    async (language: Language) => {
      if (!session || session.language === language) return;
      const next = { ...session, language };
      await repository.saveSession(next);
      setSession(next);
    },
    [repository, session]
  );

  const signOut = useCallback(async () => {
    await repository.clearSession();
    setSession(null);
    setPosts([]);
    setReports([]);
    setNeighbors([]);
    setCommentCounts({});
  }, [repository]);

  const publish = useCallback(
    async ({ category, text }: PublishInput) => {
      if (!session) throw new Error('Publication impossible sans session');
      const post: Post = {
        id: newId('post'),
        authorName: session.firstName,
        category,
        text: text.trim(),
        neighborhoodId: session.neighborhoodId,
        building: session.building,
        createdAt: new Date().toISOString(),
        likes: 0,
        likedByMe: false,
      };
      await repository.createPost(post);
      setPosts((current) => [post, ...current]);
      return post;
    },
    [repository, session]
  );

  const toggleLike = useCallback(
    async (postId: string) => {
      const post = posts.find((p) => p.id === postId);
      if (!post) return;
      const liked = !post.likedByMe;
      await repository.setLiked(postId, liked);
      setPosts((current) =>
        current.map((p) =>
          p.id === postId
            ? { ...p, likedByMe: liked, likes: Math.max(0, p.likes + (liked ? 1 : -1)) }
            : p
        )
      );
    },
    [posts, repository]
  );

  const loadComments = useCallback(
    (postId: string) => repository.loadComments(postId),
    [repository]
  );

  const addComment = useCallback(
    async (postId: string, text: string) => {
      if (!session) return;
      await repository.addComment({
        id: newId('comment'),
        postId,
        authorName: session.firstName,
        text: text.trim(),
        createdAt: new Date().toISOString(),
      });
      setCommentCounts((current) => ({ ...current, [postId]: (current[postId] ?? 0) + 1 }));
    },
    [repository, session]
  );

  const report = useCallback(
    async (postId: string, reason: ReportReason) => {
      const alreadyReported = reports.some(
        (r) => r.postId === postId && r.reporterId === CURRENT_USER_ID
      );
      if (alreadyReported) return false;

      const entry: Report = {
        postId,
        reporterId: CURRENT_USER_ID,
        reason,
        createdAt: new Date().toISOString(),
      };
      await repository.addReport(entry);
      setReports((current) => [...current, entry]);
      return true;
    },
    [reports, repository]
  );

  const setTrusted = useCallback(
    async (neighborId: string, trusted: boolean) => {
      await repository.setTrusted(neighborId, trusted);
      setNeighbors((current) =>
        current.map((n) => (n.id === neighborId ? { ...n, trusted } : n))
      );
    },
    [repository]
  );

  const moderation = useMemo(() => {
    const states: Record<string, ModerationState> = {};
    for (const post of posts) {
      states[post.id] = computeModerationState(post.id, reports);
    }
    return states;
  }, [posts, reports]);

  const value = useMemo<AppValue>(
    () => ({
      ready,
      session,
      posts,
      moderation,
      neighbors,
      commentCounts,
      register,
      signOut,
      updateLanguage,
      publish,
      toggleLike,
      loadComments,
      addComment,
      report,
      setTrusted,
    }),
    [
      ready,
      session,
      posts,
      moderation,
      neighbors,
      commentCounts,
      register,
      signOut,
      updateLanguage,
      publish,
      toggleLike,
      loadComments,
      addComment,
      report,
      setTrusted,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp doit être utilisé dans un AppProvider');
  return value;
}

/** Publications visibles dans le fil : les contenus bloqués gardent leur place, marqués comme tels. */
export function useModerationBadge(postId: string): ModerationState | undefined {
  const { moderation } = useApp();
  const state = moderation[postId];
  if (!state) return undefined;
  return isHidden(state) ? state : undefined;
}
