import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import { CategoryChips, FILTERS } from '../components/CategoryChips';
import {
  AlertBanner,
  WelcomeCard,
  latestAlert,
  newcomer,
} from '../components/FeedHighlights';
import { PostCard } from '../components/PostCard';
import { ReportSheet } from '../components/ReportSheet';
import { useToast } from '../components/Toast';
import { TWINNING_THRESHOLD, findNeighborhood } from '../data/neighborhoods';
import type { CategoryFilter, ReportReason } from '../domain/types';
import { useI18n, useLocalizedName } from '../i18n/I18nProvider';
import { SosBanner } from '../components/SosBanner';
import { StoriesRow } from '../components/StoriesRow';
import { useApp } from '../state/AppProvider';
import { colors, fontSizes, radii, spacing } from '../theme/theme';
import type { RootStackParamList, TabParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Feed'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function FeedScreen({ navigation }: Props) {
  const { s, format, language, setLanguage, rtl } = useI18n();
  const localizedName = useLocalizedName();
  const {
    session,
    posts,
    neighbors,
    toggleLike,
    report,
    updateLanguage,
    refresh,
    loading,
    loadFailed,
    repository,
    serverReset,
    dismissServerReset,
  } = useApp();
  const toast = useToast();

  const [filter, setFilter] = useState<CategoryFilter>('tout');
  const [query, setQuery] = useState('');
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  /** Voisin à qui la bienvenue vient d'être envoyée, pour ne pas la renvoyer. */
  const [bienvenue, setBienvenue] = useState<string | null>(null);

  const neighborhood = session ? findNeighborhood(session.neighborhoodId) : undefined;

  /** Quartier de rattachement, quand celui du voisin est encore jumelé (§2). */
  const twin = useMemo(() => {
    if (!neighborhood?.twinnedWith) return undefined;
    return findNeighborhood(neighborhood.twinnedWith);
  }, [neighborhood]);

  // Mises en avant du haut de fil : l'alerte du moment, et le dernier arrivé.
  const alerte = useMemo(() => latestAlert(posts), [posts]);
  const nouveau = useMemo(() => newcomer(neighbors), [neighbors]);

  const visiblePosts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return posts.filter((post) => {
      if (filter !== 'tout' && post.category !== filter) return false;
      if (!needle) return true;
      return (
        post.text.toLowerCase().includes(needle) ||
        post.authorName.toLowerCase().includes(needle)
      );
    });
  }, [posts, filter, query]);

  /**
   * Envoie un vrai message de bienvenue au nouveau voisin.
   *
   * C'est un message privé, pas une publication : souhaiter la bienvenue
   * s'adresse à quelqu'un, et le nouveau venu reçoit la notification qui va
   * avec.
   */
  const souhaiterBienvenue = async (voisin: { id: string; name: string }) => {
    try {
      await repository.sendMessage(voisin.id, format(s.feed.welcomeMessage, { name: voisin.name }));
      setBienvenue(voisin.id);
      toast(s.feed.welcomeSent);
    } catch {
      toast(s.feed.welcomeFailed);
    }
  };

  const submitReport = async (reason: ReportReason) => {
    const postId = reportTarget;
    setReportTarget(null);
    if (!postId) return;
    const accepted = await report(postId, reason);
    toast(accepted ? s.report.sent : s.report.alreadyReported);
  };

  return (
    <View style={styles.screen}>
      {/* En-tête épinglé : le quartier, la recherche et les catégories
          restent atteignables quand le fil défile. */}
      <View style={styles.sticky}>
          <View style={[styles.topbar, rtl.row]}>
            <View style={styles.flex}>
              <Text style={[styles.title, rtl.text]}>Jiran</Text>
              <Text style={[styles.location, rtl.text]}>
                📍 {neighborhood ? localizedName(neighborhood) : ''}
                {neighborhood ? ` · ${language === 'ar' ? neighborhood.regionAr : neighborhood.region}` : ''}
              </Text>
            </View>

            <View style={[styles.langToggle, rtl.row]}>
              {(['fr', 'ar'] as const).map((code) => (
                <Pressable
                  key={code}
                  accessibilityRole="button"
                  accessibilityState={{ selected: language === code }}
                  onPress={() => {
                    setLanguage(code);
                    updateLanguage(code);
                  }}
                  style={[styles.langButton, language === code && styles.langButtonActive]}
                >
                  <Text
                    style={[styles.langText, language === code && styles.langTextActive]}
                  >
                    {code === 'fr' ? 'FR' : 'ع'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <TextInput
            placeholder={s.feed.searchPlaceholder}
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={setQuery}
            style={[styles.search, rtl.text]}
          />

          <View style={styles.chips}>
            <CategoryChips options={FILTERS} selected={filter} onSelect={setFilter} />
          </View>

      </View>

      <FlatList
        data={visiblePosts}
        keyExtractor={(post) => post.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.brand} />
        }
        ListHeaderComponent={
          <View>
            <SosBanner />

            {/* Un profil que le serveur ne reconnaît plus n'est pas une panne
                du téléphone : le dire vaut mieux que le laisser croire. */}
            {serverReset ? (
              <Pressable accessibilityRole="button" onPress={dismissServerReset}>
                <View style={styles.reset}>
                  <Text style={[styles.resetText, rtl.text]}>{s.feed.serverReset}</Text>
                  <Text style={[styles.resetDismiss, rtl.text]}>{s.common.close}</Text>
                </View>
              </Pressable>
            ) : null}
            {loadFailed ? (
              <Text style={[styles.offline, rtl.text]}>{s.feed.offline}</Text>
            ) : null}

            {twin && neighborhood ? (
              <Text style={[styles.twinned, rtl.text]}>
                {format(s.feed.twinnedNotice, {
                  neighborhood: localizedName(neighborhood),
                  twin: localizedName(twin),
                  threshold: TWINNING_THRESHOLD,
                })}
              </Text>
            ) : null}

            <StoriesRow
              onOpen={(index) => navigation.navigate('Story', { index })}
              onAdd={() => navigation.navigate('NewStory')}
            />

            {/* L'alerte passe avant tout, y compris avant la carte de
                bienvenue : c'est ce pour quoi l'application existe. */}
            {alerte ? (
              <AlertBanner
                post={alerte}
                onPress={() => navigation.navigate('PostDetail', { postId: alerte.id })}
              />
            ) : null}

            {nouveau ? (
              <WelcomeCard
                neighbor={nouveau}
                sent={bienvenue === nouveau.id}
                onWelcome={() => souhaiterBienvenue(nouveau)}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View>
            <Text style={styles.empty}>
              {filter === 'tout' && !query ? s.feed.empty : s.feed.emptyFiltered}
            </Text>
            {/* Un fil vide sans mode d'emploi ne donne pas envie d'écrire. */}
            {filter === 'tout' && !query ? (
              <Text style={styles.emptyHint}>{s.feed.firstPostHint}</Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
            onLike={() => toggleLike(item.id)}
            onReport={() => setReportTarget(item.id)}
          />
        )}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={s.feed.newPost}
        onPress={() => navigation.navigate('Compose')}
        style={styles.fab}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      <ReportSheet
        visible={reportTarget !== null}
        onClose={() => setReportTarget(null)}
        onSelect={submitReport}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  reset: {
    backgroundColor: colors.sand,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  resetText: { fontSize: fontSizes.small, color: colors.ink, lineHeight: 18 },
  resetDismiss: {
    marginTop: spacing.xs,
    fontSize: fontSizes.small,
    color: colors.brand,
    fontWeight: '700',
  },
  sticky: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.paper,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 120 },
  topbar: { alignItems: 'flex-start', paddingTop: spacing.md, marginBottom: spacing.md },
  title: { fontSize: fontSizes.heading, fontWeight: '700', color: colors.ink },
  location: { fontSize: fontSizes.small, color: colors.muted, marginTop: 2 },
  langToggle: { backgroundColor: colors.sand, borderRadius: radii.pill, padding: 3, gap: 2 },
  langButton: { paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radii.pill },
  langButtonActive: { backgroundColor: colors.ink },
  langText: { fontSize: fontSizes.small, fontWeight: '700', color: colors.muted },
  langTextActive: { color: colors.paper },
  search: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSizes.body,
    color: colors.ink,
  },
  offline: {
    backgroundColor: colors.alertSoft,
    color: colors.alert,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    fontSize: fontSizes.small,
  },
  twinned: {
    marginTop: spacing.md,
    backgroundColor: colors.eventSoft,
    color: colors.event,
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: fontSizes.small,
    lineHeight: 18,
  },
  chips: { marginHorizontal: -spacing.lg, marginBottom: spacing.sm },
  empty: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: fontSizes.small,
    marginTop: spacing.xxl,
  },
  emptyHint: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: fontSizes.small,
    lineHeight: 19,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  fabText: { color: colors.paper, fontSize: 30, lineHeight: 34, fontWeight: '600' },
});
