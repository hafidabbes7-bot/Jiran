import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

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
import { registerForPush } from '../data/pushRegistration';
import { RepositoryError, type JiranRepository, type SosResult } from '../data/repository';

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

  triggerSos: (
    neighborIds: string[],
    position?: { latitude: number; longitude: number }
  ) => Promise<SosResult>;
  cancelSos: (alertId: string) => Promise<void>;

  loadModerationQueue: () => Promise<QueuedPost[]>;
  decideModeration: (
    postId: string,
    decision: 'block' | 'restore',
    note?: string
  ) => Promise<ModerationState>;
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

  /**
   * La session courante, lisible sans faire dépendre `refresh` de l'état.
   *
   * Sans cette référence, `refresh` changerait d'identité à chaque session, ce
   * qui relancerait l'effet de démarrage, qui relirait la session, qui en
   * produirait un nouvel objet… et le fil se rechargerait sans fin.
   */
  const sessionRef = useRef<Session | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  /** Vide la session : le voisin repart de l'inscription. */
  const forgetSession = useCallback(async () => {
    await repository.clearSession();
    setSession(null);
    setPosts([]);
    setNeighbors([]);
  }, [repository]);

  const refresh = useCallback(
    async (options?: { session?: Session; allowRepair?: boolean }) => {
      setLoading(true);
      try {
        const [feed, people] = await Promise.all([
          repository.loadFeed(),
          repository.loadNeighbors(),
        ]);
        setPosts(feed);
        setNeighbors(people);
        setLoadFailed(false);
      } catch (error) {
        const kind = error instanceof RepositoryError ? error.kind : 'network';

        // Jeton périmé ou refusé : rester sur un fil vide en affichant
        // « serveur injoignable » enfermerait le voisin sans issue.
        if (kind === 'unauthorized') {
          await forgetSession();
          return;
        }

        // Profil absent côté serveur — base repartie de zéro, par exemple.
        // La session reste valable : on le recrée plutôt que de tout refaire.
        const current = options?.session ?? sessionRef.current;
        if (kind === 'profile_required' && current && options?.allowRepair !== false) {
          try {
            await repository.saveProfile(current);
            await refresh({ session: current, allowRepair: false });
            return;
          } catch {
            await forgetSession();
            return;
          }
        }

        // Le fil déjà affiché reste à l'écran : une coupure passagère ne doit
        // pas vider le quartier.
        setLoadFailed(true);
      } finally {
        setLoading(false);
      }
    },
    // `refresh` s'appelle elle-même après réparation, d'où la session passée
    // en argument : au moment de ce rappel, l'état n'est pas encore à jour.
    [repository, forgetSession]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await repository.loadSession();
      if (cancelled) return;
      setSession(stored);
      if (stored) await refresh({ session: stored });
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [repository, refresh]);

  /**
   * Déclare l'appareil dès qu'une session existe : sans jeton enregistré, le
   * voisin ne recevrait ni alerte de sécurité ni SOS.
   */
  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    (async () => {
      const registration = await registerForPush();
      if (cancelled || !registration) return;
      try {
        await repository.registerDevice(registration.token, registration.platform);
      } catch {
        // Sans notifications, l'application reste utilisable ; on réessaiera
        // au prochain lancement.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, repository]);

  const register = useCallback(
    async (next: Session) => {
      // Le profil part au serveur avant d'être gardé en local : sans lui, le
      // voisin aurait une session valide et un fil inaccessible.
      const { isModerator } = await repository.saveProfile(next);
      const session = { ...next, isModerator };
      await repository.saveSession(session);
      setSession(session);
      await refresh({ session });
    },
    [repository, refresh]
  );

  const signOut = forgetSession;

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

  const triggerSos = useCallback(
    (neighborIds: string[], position?: { latitude: number; longitude: number }) =>
      repository.triggerSos(neighborIds, position),
    [repository]
  );

  const cancelSos = useCallback(
    (alertId: string) => repository.cancelSos(alertId),
    [repository]
  );

  const loadModerationQueue = useCallback(
    () => repository.loadModerationQueue(),
    [repository]
  );

  const decideModeration = useCallback(
    async (postId: string, decision: 'block' | 'restore', note?: string) => {
      const moderation = await repository.decideModeration(postId, decision, note);
      // Le fil affiché doit suivre la décision sans attendre un rechargement.
      setPosts((current) =>
        current.map((post) => (post.id === postId ? { ...post, moderation } : post))
      );
      return moderation;
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
      triggerSos,
      cancelSos,
      loadModerationQueue,
      decideModeration,
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
      triggerSos,
      cancelSos,
      loadModerationQueue,
      decideModeration,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp doit être utilisé dans un AppProvider');
  return value;
}
