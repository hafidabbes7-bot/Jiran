import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type {
  Category,
  Comment,
  Neighbor,
  Post,
  ReportReason,
  Session,
} from '../domain/types';
import { RepositoryError, type JiranRepository } from '../data/repository';

export interface PublishInput {
  category: Category;
  text: string;
}

interface AppValue {
  ready: boolean;
  session: Session | null;
  posts: Post[];
  neighbors: Neighbor[];
  /** Chargement du fil en cours (premier affichage ou rafraîchissement). */
  loading: boolean;
  /** Dernière erreur de chargement, à montrer sans vider le fil affiché. */
  loadFailed: boolean;

  register: (session: Session) => Promise<void>;
  signOut: () => Promise<void>;
  updateLanguage: (language: Session['language']) => Promise<void>;

  refresh: () => Promise<void>;
  publish: (input: PublishInput) => Promise<void>;
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
  const [neighbors, setNeighbors] = useState<Neighbor[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [feed, people] = await Promise.all([
        repository.loadFeed(),
        repository.loadNeighbors(),
      ]);
      setPosts(feed);
      setNeighbors(people);
      setLoadFailed(false);
    } catch {
      // Le fil déjà affiché reste à l'écran : une coupure passagère ne doit pas
      // vider le quartier.
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await repository.loadSession();
      if (cancelled) return;
      setSession(stored);
      if (stored) await refresh();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [repository, refresh]);

  const register = useCallback(
    async (next: Session) => {
      // Le profil part au serveur avant d'être gardé en local : sans lui, le
      // voisin aurait une session valide et un fil inaccessible.
      await repository.saveProfile(next);
      await repository.saveSession(next);
      setSession(next);
      await refresh();
    },
    [repository, refresh]
  );

  const signOut = useCallback(async () => {
    await repository.clearSession();
    setSession(null);
    setPosts([]);
    setNeighbors([]);
  }, [repository]);

  const updateLanguage = useCallback(
    async (language: Session['language']) => {
      if (!session || session.language === language) return;
      const next = { ...session, language };
      await repository.saveSession(next);
      setSession(next);
    },
    [repository, session]
  );

  const publish = useCallback(
    async (input: PublishInput) => {
      await repository.createPost(input);
      await refresh();
    },
    [repository, refresh]
  );

  const toggleLike = useCallback(
    async (postId: string) => {
      const post = posts.find((item) => item.id === postId);
      if (!post) return;
      const liked = !post.likedByMe;

      // Réponse immédiate à l'écran, corrigée par le serveur si l'appel échoue.
      setPosts((current) =>
        current.map((item) =>
          item.id === postId
            ? { ...item, likedByMe: liked, likes: Math.max(0, item.likes + (liked ? 1 : -1)) }
            : item
        )
      );

      try {
        await repository.setLiked(postId, liked);
      } catch {
        setPosts((current) =>
          current.map((item) =>
            item.id === postId
              ? { ...item, likedByMe: post.likedByMe, likes: post.likes }
              : item
          )
        );
      }
    },
    [posts, repository]
  );

  const loadComments = useCallback(
    (postId: string) => repository.loadComments(postId),
    [repository]
  );

  const addComment = useCallback(
    async (postId: string, text: string) => {
      await repository.addComment(postId, text);
      setPosts((current) =>
        current.map((post) =>
          post.id === postId ? { ...post, commentCount: post.commentCount + 1 } : post
        )
      );
    },
    [repository]
  );

  const report = useCallback(
    async (postId: string, reason: ReportReason) => {
      try {
        const { accepted, moderation } = await repository.report(postId, reason);
        setPosts((current) =>
          current.map((post) =>
            post.id === postId ? { ...post, moderation, reportedByMe: true } : post
          )
        );
        return accepted;
      } catch (error) {
        if (error instanceof RepositoryError) return false;
        throw error;
      }
    },
    [repository]
  );

  const setTrusted = useCallback(
    async (neighborId: string, trusted: boolean) => {
      await repository.setTrusted(neighborId, trusted);
      setNeighbors((current) =>
        current.map((neighbor) =>
          neighbor.id === neighborId ? { ...neighbor, trusted } : neighbor
        )
      );
    },
    [repository]
  );

  const value = useMemo<AppValue>(
    () => ({
      ready,
      session,
      posts,
      neighbors,
      loading,
      loadFailed,
      register,
      signOut,
      updateLanguage,
      refresh,
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
      neighbors,
      loading,
      loadFailed,
      register,
      signOut,
      updateLanguage,
      refresh,
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
