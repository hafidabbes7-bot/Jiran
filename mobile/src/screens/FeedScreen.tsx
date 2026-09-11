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
import { PostCard } from '../components/PostCard';
import { ReportSheet } from '../components/ReportSheet';
import { useToast } from '../components/Toast';
import { TWINNING_THRESHOLD, findNeighborhood } from '../data/neighborhoods';
import type { CategoryFilter, ReportReason } from '../domain/types';
import { useI18n, useLocalizedName } from '../i18n/I18nProvider';
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
  const { session, posts, toggleLike, report, updateLanguage, refresh, loading, loadFailed } =
    useApp();
  const toast = useToast();

  const [filter, setFilter] = useState<CategoryFilter>('tout');
  const [query, setQuery] = useState('');
  const [reportTarget, setReportTarget] = useState<string | null>(null);

  const neighborhood = session ? findNeighborhood(session.neighborhoodId) : undefined;

  /** Quartier de rattachement, quand celui du voisin est encore jumelé (§2). */
  const twin = useMemo(() => {
    if (!neighborhood?.twinnedWith) return undefined;
    return findNeighborhood(neighborhood.twinnedWith);
  }, [neighborhood]);

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

  const submitReport = async (reason: ReportReason) => {
    const postId = reportTarget;
    setReportTarget(null);
    if (!postId) return;
    const accepted = await report(postId, reason);
    toast(accepted ? s.report.sent : s.report.alreadyReported);
  };

  return (
    <View style={styles.screen}>
      <FlatList
        data={visiblePosts}
        keyExtractor={(post) => post.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.brand} />
        }
        ListHeaderComponent={
          <View>
            <View style={[styles.topbar, rtl.row]}>
              <View style={styles.flex}>
                <Text style={[styles.title, rtl.text]}>Jiran</Text>
                <Text style={[styles.location, rtl.text]}>
                  📍 {neighborhood ? localizedName(neighborhood) : ''}
                  {neighborhood ? ` · ${language === 'ar' ? neighborhood.wilayaAr : neighborhood.wilaya}` : ''}
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

            {loadFailed ? (
              <Text style={[styles.offline, rtl.text]}>{s.feed.offline}</Text>
            ) : null}

            <TextInput
              placeholder={s.feed.searchPlaceholder}
              placeholderTextColor={colors.muted}
              value={query}
              onChangeText={setQuery}
              style={[styles.search, rtl.text]}
            />

            {twin && neighborhood ? (
              <Text style={[styles.twinned, rtl.text]}>
                {format(s.feed.twinnedNotice, {
                  neighborhood: localizedName(neighborhood),
                  twin: localizedName(twin),
                  threshold: TWINNING_THRESHOLD,
                })}
              </Text>
            ) : null}

            <View style={styles.chips}>
              <CategoryChips options={FILTERS} selected={filter} onSelect={setFilter} />
            </View>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {filter === 'tout' && !query ? s.feed.empty : s.feed.emptyFiltered}
          </Text>
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
