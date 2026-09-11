import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import { useToast } from '../components/Toast';
import { formatRelative } from '../domain/time';
import type { QueuedPost } from '../domain/types';
import { useI18n } from '../i18n/I18nProvider';
import { useApp } from '../state/AppProvider';
import { colors, fontSizes, radii, spacing } from '../theme/theme';

/**
 * File des signalements (§7.4).
 *
 * Le blocage automatique fait le gros du travail, mais il ne distingue pas un
 * contenu vraiment problématique d'un voisin pris à partie par trois autres.
 * D'où les deux actions : bloquer, et surtout rétablir.
 */
export function ModerationScreen() {
  const { s, format, language, rtl } = useI18n();
  const { loadModerationQueue, decideModeration } = useApp();
  const toast = useToast();

  const [queue, setQueue] = useState<QueuedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [deciding, setDeciding] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setQueue(await loadModerationQueue());
    } catch {
      toast(s.moderation.failed);
    } finally {
      setLoading(false);
    }
  }, [loadModerationQueue, s.moderation.failed, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (postId: string, decision: 'block' | 'restore') => {
    setDeciding(postId);
    try {
      await decideModeration(postId, decision, notes[postId]?.trim() || undefined);
      toast(s.moderation.decided);
      await load();
    } catch {
      toast(s.moderation.failed);
    } finally {
      setDeciding(null);
    }
  };

  const statusOf = (post: QueuedPost) => {
    if (post.moderation.decidedByModerator === 'block') {
      return s.moderation.statusBlockedByModerator;
    }
    if (post.moderation.decidedByModerator === 'restore') {
      return s.moderation.statusRestoredByModerator;
    }
    if (post.moderation.permanent) return s.moderation.statusPermanent;
    if (post.moderation.hidden) return s.moderation.statusHidden;
    return s.moderation.statusVisible;
  };

  if (loading && queue.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      data={queue}
      keyExtractor={(post) => post.postId}
      contentContainerStyle={styles.list}
      refreshing={loading}
      onRefresh={load}
      ListHeaderComponent={
        <Text style={[styles.subtitle, rtl.text]}>{s.moderation.subtitle}</Text>
      }
      ListEmptyComponent={<Text style={styles.empty}>{s.moderation.empty}</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={[styles.head, rtl.row]}>
            <Text style={[styles.author, rtl.text]}>{item.authorName}</Text>
            <Text style={styles.time}>{formatRelative(item.createdAt, language)}</Text>
          </View>

          <Text style={[styles.text, rtl.text]}>{item.text}</Text>

          <Text style={[styles.count, rtl.text]}>
            {item.reports.length === 1
              ? s.moderation.reportCountOne
              : format(s.moderation.reportCountMany, { count: item.reports.length })}
            {' · '}
            {statusOf(item)}
          </Text>

          {/* Les motifs invoqués : trois « spam » ne se jugent pas comme trois
              « contenu inapproprié ». */}
          <View style={[styles.reasons, rtl.row]}>
            {item.reports.map((report, index) => (
              <Text key={`${item.postId}-${index}`} style={styles.reason}>
                {s.moderation.reasons[report.reason]}
              </Text>
            ))}
          </View>

          {item.note ? <Text style={[styles.note, rtl.text]}>« {item.note} »</Text> : null}

          <TextInput
            placeholder={s.moderation.notePlaceholder}
            placeholderTextColor={colors.muted}
            value={notes[item.postId] ?? ''}
            onChangeText={(value) =>
              setNotes((current) => ({ ...current, [item.postId]: value }))
            }
            style={[styles.noteInput, rtl.text]}
          />

          <View style={[styles.actions, rtl.row]}>
            <PrimaryButton
              label={s.moderation.restore}
              tone="ghost"
              loading={deciding === item.postId}
              onPress={() => decide(item.postId, 'restore')}
              style={styles.action}
            />
            <PrimaryButton
              label={s.moderation.block}
              tone="alert"
              loading={deciding === item.postId}
              onPress={() => decide(item.postId, 'block')}
              style={styles.action}
            />
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  center: {
    flex: 1,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { padding: spacing.lg, paddingBottom: 120 },
  subtitle: {
    fontSize: fontSizes.small,
    color: colors.muted,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  empty: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: fontSizes.small,
    marginTop: spacing.xxl,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  head: { justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  author: { fontSize: fontSizes.body, fontWeight: '700', color: colors.ink },
  time: { fontSize: fontSizes.caption, color: colors.muted },
  text: { fontSize: fontSizes.body, lineHeight: 20, color: colors.ink },
  count: { marginTop: spacing.sm, fontSize: fontSizes.small, fontWeight: '600', color: colors.alert },
  reasons: { flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  reason: {
    backgroundColor: colors.sand,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    fontSize: fontSizes.caption,
    color: colors.muted,
  },
  note: {
    marginTop: spacing.sm,
    fontSize: fontSizes.small,
    fontStyle: 'italic',
    color: colors.muted,
  },
  noteInput: {
    marginTop: spacing.md,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSizes.small,
    color: colors.ink,
  },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  action: { flex: 1 },
});
