import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatRelative } from '../domain/time';
import type { Neighbor, Post } from '../domain/types';
import { useI18n } from '../i18n/I18nProvider';
import { colors, fontSizes, radii, spacing } from '../theme/theme';

/** Une alerte n'est mise en avant que si elle est encore d'actualité. */
const ALERT_WINDOW_HOURS = 24;

/** Un voisin est « nouveau » pendant une semaine. */
const WELCOME_WINDOW_DAYS = 7;

const HOUR_MS = 3600_000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Alerte de sécurité la plus récente encore d'actualité.
 *
 * C'est le positionnement de l'application : ce qui touche à la sécurité
 * passe devant le reste du fil, pas noyé dedans (§4.2).
 */
export function latestAlert(posts: Post[], now: Date = new Date()): Post | undefined {
  return posts.find(
    (post) =>
      post.category === 'securite' &&
      !post.moderation.hidden &&
      now.getTime() - new Date(post.createdAt).getTime() < ALERT_WINDOW_HOURS * HOUR_MS
  );
}

/** Voisin arrivé le plus récemment, s'il est arrivé cette semaine. */
export function newcomer(neighbors: Neighbor[], now: Date = new Date()): Neighbor | undefined {
  const recents = neighbors
    .filter((neighbor) => now.getTime() - new Date(neighbor.joinedAt).getTime() < WELCOME_WINDOW_DAYS * DAY_MS)
    .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt));

  return recents[0];
}

export function AlertBanner({ post, onPress }: { post: Post; onPress: () => void }) {
  const { s, format, language, rtl } = useI18n();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.alert, rtl.row, pressed && styles.pressed]}
    >
      <Text style={styles.alertEmoji}>🚨</Text>
      <View style={styles.flex}>
        <Text style={[styles.alertTitle, rtl.text]} numberOfLines={2}>
          {post.text}
        </Text>
        <Text style={[styles.alertMeta, rtl.text]}>
          {format(s.feed.alertBannerMeta, {
            time: formatRelative(post.createdAt, language),
            author: post.authorName,
          })}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Carte de bienvenue au dernier arrivé (§4.2).
 *
 * Un fil de quartier ne démarre pas tout seul : nommer celui qui vient
 * d'arriver donne une raison d'écrire à ceux qui hésitent.
 */
export function WelcomeCard({ neighbor }: { neighbor: Neighbor }) {
  const { s, format, rtl } = useI18n();

  return (
    <View style={[styles.welcome, rtl.row]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>👋</Text>
      </View>
      <View style={styles.flex}>
        <Text style={[styles.welcomeTitle, rtl.text]}>
          {format(s.feed.welcomeTitle, { name: neighbor.name })}
        </Text>
        <Text style={[styles.welcomeSub, rtl.text]}>
          {neighbor.building
            ? format(s.feed.welcomeSubtitleBuilding, { building: neighbor.building })
            : s.feed.welcomeSubtitle}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.9 },
  alert: {
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.alert,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  alertEmoji: { fontSize: 20 },
  alertTitle: { color: '#fff', fontSize: fontSizes.small, fontWeight: '700', lineHeight: 17 },
  alertMeta: { color: colors.alertSoft, fontSize: fontSizes.caption, marginTop: 2 },
  welcome: {
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.aidSoft,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: fontSizes.body },
  welcomeTitle: { fontSize: fontSizes.body, fontWeight: '700', color: colors.aid },
  welcomeSub: { fontSize: fontSizes.caption, color: colors.aid, marginTop: 2, opacity: 0.85 },
});
