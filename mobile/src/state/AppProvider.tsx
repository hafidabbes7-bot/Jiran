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
  ActiveSos,
  Category,
  Comment,
  Game,
  ModerationState,
  Neighbor,
  Notification,
  Post,
  QueuedPost,
  ReportReason,
  Session,
  Story,
} from '../domain/types';
import { AppState } from 'react-native';

import { localNotify } from '../data/localNotify';
import { loadSettings } from '../data/notificationSettings';
import { registerForPush } from '../data/pushRegistration';
import { RepositoryError, type JiranRepository, type SosResult } from '../data/repository';

/**
 * Intervalle de rafraîchissement du fil, en millisecondes.
 *
 * Douze secondes : assez court pour qu'un message entre voisins arrive sans
 * qu'on ait à tirer l'écran, assez long pour ne pas vider la batterie ni
 * assommer un hébergement gratuit.
 */
const REFRESH_MS = 12_000;

export interface PublishInput {
  category: Category;
  text: string;
  /** Photo déjà envoyée au serveur, s'il y en a une. */
  photoId?: string;
}

interface AppValue {
  /**
   * Accès direct au serveur pour les écrans de la vie de quartier (§4.6, §4.9
   * à §4.15). Ces données ne sont pas de l'état partagé — chaque écran charge
   * les siennes en s'ouvrant — et les recopier ici n'apporterait qu'un cache à
   * maintenir. Le fil, la session et les voisins, eux, restent gérés ici.
   */
  repository: JiranRepository;

  ready: boolean;
  session: Session | null;
  posts: Post[];
  neighbors: Neighbor[];
  /** Alertes SOS en cours qui concernent ce voisin (§4.16). */
  activeSos: ActiveSos[];
  /** Stories du quartier, moins de 24 heures. */
  stories: Story[];
  /** Ce qui est arrivé au voisin, non lu en tête. */
  notifications: Notification[];
  unreadNotifications: number;
  markNotificationsRead: (id?: string) => Promise<void>;
  publishStory: (input: { photoId?: string; text?: string }) => Promise<void>;
  removeStory: (storyId: string) => Promise<void>;
  /** Chargement du fil en cours (premier affichage ou rafraîchissement). */
  loading: boolean;
  /** Dernière erreur de chargement, à montrer sans vider le fil affiché. */
  loadFailed: boolean;
  /**
   * Vrai quand le serveur ne connaissait plus ce voisin : sur l'hébergement
   * gratuit, un redémarrage efface la base. Le compte est recréé tout seul,
   * mais les publications, elles, sont perdues — et il vaut mieux le dire que
   * laisser croire à un fil vide.
   */
  serverReset: boolean;
  dismissServerReset: () => void;

  register: (session: Session) => Promise<void>;
  signOut: () => Promise<void>;
  updateLanguage: (language: Session['language']) => Promise<void>;
  /** Change de quartier après un déménagement, sans refaire vérifier le numéro. */
  move: (neighborhoodId: string, building?: string, locationVerified?: boolean) => Promise<void>;

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

  loadGames: () => Promise<Game[]>;
  createGame: () => Promise<Game>;
  joinGame: (gameId: string) => Promise<Game>;
  playMove: (gameId: string, cell: number) => Promise<Game>;

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
  const [activeSos, setActiveSos] = useState<ActiveSos[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotifications, setUnread] = useState(0);

  /**
   * Notifications déjà signalées sur cet appareil.
   *
   * Sans cette mémoire, chaque rafraîchissement — toutes les 12 secondes —
   * re-sonnerait pour les mêmes.
   */
  const signalées = useRef(new Set<string>());
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [serverReset, setServerReset] = useState(false);

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

  /** Vrai tant que le premier chargement n'a pas eu lieu. */
  const premierChargement = useRef(true);

  /**
   * Fait sonner le téléphone pour ce qui vient d'arriver.
   *
   * Au premier chargement, on ne signale rien : un voisin qui ouvre
   * l'application n'a pas besoin qu'on lui rejoue les trois derniers jours.
   */
  const annoncer = useCallback(async (journal: Notification[]) => {
    const nouvelles = journal.filter((item) => !item.read && !signalées.current.has(item.id));
    for (const item of journal) signalées.current.add(item.id);
    if (premierChargement.current) {
      premierChargement.current = false;
      return;
    }

    if (nouvelles.length === 0) return;
    const réglages = await loadSettings();
    for (const item of nouvelles.slice(0, 3)) {
      if (réglages[item.kind]) await localNotify(item.title, item.body);
    }
  }, []);

  const refresh = useCallback(
    async (options?: { session?: Session; allowRepair?: boolean }) => {
      setLoading(true);
      try {
        const [feed, people, sos, récits, journal] = await Promise.all([
          repository.loadFeed(),
          repository.loadNeighbors(),
          repository.loadActiveSos(),
          repository.loadStories(),
          repository.loadNotifications(),
        ]);
        setPosts(feed);
        setNeighbors(people);
        setActiveSos(sos);
        setStories(récits);
        setNotifications(journal.notifications);
        setUnread(journal.unread);
        await annoncer(journal.notifications);
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
            setServerReset(true);
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

  /**
   * Rafraîchissement périodique du fil et des alertes.
   *
   * Sans lui, une publication d'un voisin n'apparaissait qu'en tirant l'écran
   * vers le bas — et un SOS, jamais. Les notifications ne suffisent pas : tant
   * qu'aucun service de remise n'est branché, l'application est la seule à
   * pouvoir prévenir.
   *
   * On ne demande rien quand l'application est en arrière-plan, et on
   * rafraîchit tout de suite au retour à l'écran.
   */
  useEffect(() => {
    if (!session) return;

    const timer = setInterval(() => {
      if (AppState.currentState === 'active') refresh();
    }, REFRESH_MS);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
    // `session` ne sert qu'à savoir s'il y a quelqu'un de connecté : se lier à
    // l'objet entier relancerait l'effet à chaque rafraîchissement.
  }, [session?.token, refresh]);

  const move = useCallback(
    async (neighborhoodId: string, building?: string, locationVerified = true) => {
      const current = sessionRef.current;
      if (!current) return;

      // Le serveur reconnaît le voisin à son numéro : le profil est mis à jour,
      // pas recréé. Il garde donc son identifiant, ses messages et ses parties.
      const next = { ...current, neighborhoodId, building, locationVerified };
      const { isModerator } = await repository.saveProfile(next);
      const session = { ...next, isModerator };
      await repository.saveSession(session);
      setSession(session);
      await refresh({ session });
    },
    [repository, refresh]
  );

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

  const markNotificationsRead = useCallback(
    async (id?: string) => {
      await repository.markNotificationsRead(id);
      setNotifications((current) =>
        current.map((item) => (!id || item.id === id ? { ...item, read: true } : item))
      );
      setUnread((current) => (id ? Math.max(0, current - 1) : 0));
    },
    [repository]
  );

  const dismissServerReset = useCallback(() => setServerReset(false), []);

  const publishStory = useCallback(
    async (input: { photoId?: string; text?: string }) => {
      await repository.addStory(input);
      await refresh();
    },
    [repository, refresh]
  );

  const removeStory = useCallback(
    async (storyId: string) => {
      await repository.removeStory(storyId);
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

  const loadGames = useCallback(() => repository.loadGames(), [repository]);
  const createGame = useCallback(() => repository.createGame(), [repository]);
  const joinGame = useCallback((gameId: string) => repository.joinGame(gameId), [repository]);
  const playMove = useCallback(
    (gameId: string, cell: number) => repository.playMove(gameId, cell),
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
      repository,
      ready,
      session,
      posts,
      neighbors,
      activeSos,
      stories,
      notifications,
      unreadNotifications,
      markNotificationsRead,
      publishStory,
      removeStory,
      loading,
      loadFailed,
      serverReset,
      dismissServerReset,
      register,
      signOut,
      updateLanguage,
      move,
      refresh,
      publish,
      toggleLike,
      loadComments,
      addComment,
      report,
      setTrusted,
      triggerSos,
      cancelSos,
      loadGames,
      createGame,
      joinGame,
      playMove,
      loadModerationQueue,
      decideModeration,
    }),
    [
      repository,
      ready,
      session,
      posts,
      neighbors,
      activeSos,
      stories,
      notifications,
      unreadNotifications,
      markNotificationsRead,
      publishStory,
      removeStory,
      loading,
      loadFailed,
      serverReset,
      dismissServerReset,
      register,
      signOut,
      updateLanguage,
      move,
      refresh,
      publish,
      toggleLike,
      loadComments,
      addComment,
      report,
      setTrusted,
      triggerSos,
      cancelSos,
      loadGames,
      createGame,
      joinGame,
      playMove,
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
