import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { findNeighborhood } from '../data/neighborhoods';
import { isHidden } from '../domain/moderation/blocking';
import { formatRelative } from '../domain/time';
import type { ModerationState, Post } from '../domain/types';
import { useI18n, useLocalizedName } from '../i18n/I18nProvider';
import { colors, fontSizes, radii, spacing } from '../theme/theme';
import { CATEGORY_COLORS } from './CategoryChips';

export function PostCard({
  post,
  moderation,
  commentCount,
  onPress,
  onLike,
  onReport,
}: {
  post: Post;
  moderation?: ModerationState;
  commentCount?: number;
  onPress?: () => void;
  onLike?: () => void;
  onReport?: () => void;
}) {
  const { s, format, language, rtl } = useI18n();
  const localizedName = useLocalizedName();

  const blocked = moderation ? isHidden(moderation) : false;
  if (blocked) {
    return (
      <View style={[styles.card, styles.blockedCard]}>
        <Text style={[styles.blockedText, rtl.text]}>
          {moderation!.permanent ? s.feed.blockedPermanent : s.feed.blockedTemporary}
        </Text>
      </View>
    );
  }

  const neighborhood = findNeighborhood(post.neighborhoodId);
  // L'origine exacte reste affichée même sur un fil partagé entre cités
  // jumelées (§2 du cahier des charges).
  const origin = neighborhood
    ? post.building
      ? format(s.feed.originWithBuilding, {
          building: post.building,
          neighborhood: localizedName(neighborhood),
        })
      : format(s.feed.origin, { neighborhood: localizedName(neighborhood) })
    : (post.building ?? '');

  const badge = CATEGORY_COLORS[post.category];

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && onPress ? styles.pressed : null]}
    >
      <View style={[styles.head, rtl.row]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{post.authorOfficial ? '🏛️' : '👤'}</Text>
        </View>

        <View style={styles.who}>
          <Text style={[styles.name, rtl.text]} numberOfLines={1}>
            {post.authorName}
          </Text>
          <Text style={[styles.meta, rtl.text]} numberOfLines={1}>
            {origin ? `${origin} · ` : ''}
            {formatRelative(post.createdAt, language)}
          </Text>
        </View>

        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.badgeText, { color: badge.fg }]}>
            {s.categories[post.category]}
          </Text>
        </View>

        {onReport ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={s.report.title}
            hitSlop={10}
            onPress={onReport}
            style={styles.menu}
          >
            <Text style={styles.menuText}>⋮</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={[styles.text, rtl.text]}>{post.text}</Text>

      <View style={[styles.actions, rtl.row]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: post.likedByMe }}
          onPress={onLike}
          hitSlop={8}
        >
          <Text style={[styles.action, post.likedByMe && styles.actionActive]}>
            👍 {post.likes}
          </Text>
        </Pressable>

        {commentCount !== undefined ? (
          <Text style={styles.action}>
            💬{' '}
            {commentCount === 0
              ? s.feed.noReply
              : commentCount === 1
                ? s.feed.reply
                : format(s.feed.replies, { count: commentCount })}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  pressed: { opacity: 0.9 },
  blockedCard: {
    backgroundColor: colors.alertSoft,
    borderColor: colors.alertSoft,
    paddingVertical: spacing.lg,
  },
  blockedText: { fontSize: fontSizes.small, color: colors.alert, fontWeight: '600' },
  head: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: fontSizes.body },
  who: { flex: 1 },
  name: { fontSize: fontSizes.body, fontWeight: '700', color: colors.ink },
  meta: { fontSize: fontSizes.caption, color: colors.muted, marginTop: 2 },
  badge: { borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  badgeText: { fontSize: fontSizes.caption, fontWeight: '700' },
  menu: { paddingHorizontal: spacing.xs },
  menuText: { fontSize: fontSizes.title, color: colors.muted },
  text: { fontSize: fontSizes.body, lineHeight: 20, color: colors.ink },
  actions: { gap: spacing.lg, marginTop: spacing.md, alignItems: 'center' },
  action: { fontSize: fontSizes.small, color: colors.muted },
  actionActive: { color: colors.brand, fontWeight: '700' },
});
