import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { PostCard } from '../components/PostCard';
import { ReportSheet } from '../components/ReportSheet';
import { useToast } from '../components/Toast';
import type { ReportReason } from '../domain/types';
import { useI18n } from '../i18n/I18nProvider';
import { useApp } from '../state/AppProvider';
import { colors, fontSizes, spacing } from '../theme/theme';
import type { RootStackParamList, TabParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Alerts'>,
  NativeStackScreenProps<RootStackParamList>
>;

/** Fil dédié aux alertes de sécurité et aux coupures officielles (§4.5). */
export function AlertsScreen({ navigation }: Props) {
  const { s, rtl } = useI18n();
  const { posts, toggleLike, report, refresh, loading } = useApp();
  const toast = useToast();
  const [reportTarget, setReportTarget] = useState<string | null>(null);

  const alerts = useMemo(() => posts.filter((post) => post.category === 'securite'), [posts]);

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
        data={alerts}
        keyExtractor={(post) => post.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.brand} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.title, rtl.text]}>{s.alerts.title}</Text>
            <Text style={[styles.subtitle, rtl.text]}>{s.alerts.subtitle}</Text>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>{s.alerts.empty}</Text>}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
            onLike={() => toggleLike(item.id)}
            onReport={() => setReportTarget(item.id)}
          />
        )}
      />

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
  list: { padding: spacing.lg, paddingBottom: 120 },
  header: { marginBottom: spacing.md },
  title: { fontSize: fontSizes.heading, fontWeight: '700', color: colors.ink },
  subtitle: { fontSize: fontSizes.small, color: colors.muted, marginTop: 2 },
  empty: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: fontSizes.small,
    marginTop: spacing.xxl,
  },
});
