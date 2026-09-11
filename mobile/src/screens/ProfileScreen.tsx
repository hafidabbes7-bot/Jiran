import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { findNeighborhood } from '../data/neighborhoods';
import { formatRelative } from '../domain/time';
import { useI18n, useLocalizedName } from '../i18n/I18nProvider';
import { useApp } from '../state/AppProvider';
import { colors, fontSizes, radii, spacing } from '../theme/theme';
import type { RootStackParamList, TabParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Profile'>,
  NativeStackScreenProps<RootStackParamList>
>;

/** Masque le milieu du numéro : il n'est montré qu'à son propriétaire, et jamais en entier. */
function maskPhone(phone: string): string {
  return phone.length < 8 ? phone : `${phone.slice(0, 4)}····${phone.slice(-2)}`;
}

/**
 * Profil du voisin (§4.7) : ce que l'application sait de lui, ses publications,
 * et le chemin vers le reste. Le badge « voisin vérifié » n'est pas décoratif —
 * il dit lequel des deux contrôles a réellement eu lieu, le numéro et la
 * position, pour qu'un compte entré sans vérification ne se fasse pas passer
 * pour l'autre.
 */
export function ProfileScreen({ navigation }: Props) {
  const { s, format, language, setLanguage, rtl } = useI18n();
  const localizedName = useLocalizedName();
  const { session, posts, signOut, updateLanguage, unreadNotifications } = useApp();

  const neighborhood = session ? findNeighborhood(session.neighborhoodId) : undefined;
  const mine = useMemo(() => posts.filter((post) => post.authorIsMe), [posts]);

  if (!session) return null;

  const changerLangue = async (next: 'fr' | 'ar') => {
    setLanguage(next);
    await updateLanguage(next);
  };

  const entrées: { emoji: string; label: string; onPress: () => void }[] = [
    {
      emoji: '🔔',
      label:
        unreadNotifications > 0
          ? `${s.notifications.title} (${unreadNotifications})`
          : s.notifications.title,
      onPress: () => navigation.navigate('Notifications'),
    },
    { emoji: '✉️', label: s.community.messagesTitle, onPress: () => navigation.navigate('Messages') },
    { emoji: '🔧', label: s.community.servicesTitle, onPress: () => navigation.navigate('Services') },
    { emoji: '🪜', label: s.community.itemsTitle, onPress: () => navigation.navigate('Items') },
    { emoji: '👥', label: s.community.groupsTitle, onPress: () => navigation.navigate('Groups') },
    { emoji: '🗺️', label: s.community.mapTitle, onPress: () => navigation.navigate('Map') },
    { emoji: '🧳', label: s.community.vacationTitle, onPress: () => navigation.navigate('Vacation') },
    { emoji: '🗑️', label: s.community.wasteTitle, onPress: () => navigation.navigate('Waste') },
    { emoji: '🤝', label: s.community.solidarityTitle, onPress: () => navigation.navigate('Solidarity') },
    { emoji: '🎲', label: s.profile.games, onPress: () => navigation.navigate('Games') },
    { emoji: '📍', label: s.profile.neighborhood, onPress: () => navigation.navigate('Neighborhood') },
    { emoji: '🚨', label: s.profile.alerts, onPress: () => navigation.navigate('Alerts') },
    { emoji: '📦', label: s.community.moveTitle, onPress: () => navigation.navigate('Move') },
  ];
  if (session.isModerator) {
    entrées.push({
      emoji: '🛡️',
      label: s.profile.moderation,
      onPress: () => navigation.navigate('Moderation'),
    });
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{session.firstName.slice(0, 1).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{session.firstName}</Text>
        <Text style={styles.place}>
          📍 {neighborhood ? localizedName(neighborhood) : session.neighborhoodId}
          {session.building ? ` · ${session.building}` : ''}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={[styles.cardTitle, rtl.text]}>{s.profile.checksTitle}</Text>
        <Text style={[styles.line, rtl.text]}>
          ✅ {format(s.profile.phoneVerified, { phone: maskPhone(session.phone) })}
        </Text>
        <Text style={[styles.line, rtl.text]}>
          {session.locationVerified ? '✅ ' : '⚠️ '}
          {session.locationVerified ? s.profile.placeVerified : s.profile.placeUnverified}
        </Text>
        <Text style={[styles.line, rtl.text]}>
          🗓️ {format(s.profile.joined, { when: formatRelative(session.joinedAt, language) })}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={[styles.cardTitle, rtl.text]}>{s.profile.languageTitle}</Text>
        <View style={[styles.langRow, rtl.row]}>
          {(['fr', 'ar'] as const).map((code) => {
            const active = language === code;
            return (
              <Pressable
                key={code}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => changerLangue(code)}
                style={[styles.langButton, active && styles.langButtonActive]}
              >
                <Text style={[styles.langText, active && styles.langTextActive]}>
                  {code === 'fr' ? 'Français' : 'العربية'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={[styles.cardTitle, rtl.text]}>{s.profile.menuTitle}</Text>
        {entrées.map((entrée) => (
          <Pressable
            key={entrée.label}
            accessibilityRole="button"
            onPress={entrée.onPress}
            style={[styles.menuRow, rtl.row]}
          >
            <Text style={styles.menuEmoji}>{entrée.emoji}</Text>
            <Text style={[styles.menuLabel, rtl.text]}>{entrée.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={[styles.cardTitle, rtl.text]}>
          {format(s.profile.myPostsTitle, { count: mine.length })}
        </Text>
        {mine.length === 0 ? (
          <Text style={[styles.line, rtl.text]}>{s.profile.noPosts}</Text>
        ) : (
          mine.slice(0, 10).map((post) => (
            <Pressable
              key={post.id}
              accessibilityRole="button"
              onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
              style={styles.postRow}
            >
              <Text style={[styles.postText, rtl.text]} numberOfLines={2}>
                {post.text}
              </Text>
              <Text style={[styles.postMeta, rtl.text]}>
                {formatRelative(post.createdAt, language)} · ❤️ {post.likes} · 💬{' '}
                {post.commentCount}
                {post.moderation.hidden ? ` · ${s.profile.postHidden}` : ''}
              </Text>
            </Pressable>
          ))
        )}
      </View>

      <Pressable accessibilityRole="button" onPress={signOut}>
        <Text style={styles.signOut}>{s.profile.signOut}</Text>
      </Pressable>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { alignItems: 'center', marginBottom: spacing.lg },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 30, fontWeight: '700', color: colors.paper },
  name: { marginTop: spacing.sm, fontSize: fontSizes.title, fontWeight: '700', color: colors.ink },
  place: { marginTop: 2, fontSize: fontSizes.small, color: colors.muted },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: fontSizes.small,
    fontWeight: '700',
    color: colors.muted,
    marginBottom: spacing.sm,
  },
  line: { fontSize: fontSizes.small, color: colors.ink, marginBottom: spacing.xs, lineHeight: 20 },
  langRow: { gap: spacing.sm },
  langButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  langButtonActive: { borderColor: colors.brand, backgroundColor: colors.sand },
  langText: { fontSize: fontSizes.small, fontWeight: '600', color: colors.muted },
  langTextActive: { color: colors.brand },
  menuRow: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  menuEmoji: { fontSize: 20 },
  menuLabel: { flex: 1, fontSize: fontSizes.body, color: colors.ink },
  postRow: { paddingVertical: spacing.sm },
  postText: { fontSize: fontSizes.small, color: colors.ink },
  postMeta: { marginTop: 2, fontSize: fontSizes.caption, color: colors.muted },
  signOut: {
    textAlign: 'center',
    color: colors.alert,
    fontWeight: '700',
    fontSize: fontSizes.small,
    paddingVertical: spacing.md,
  },
  comingSoon: {
    marginTop: spacing.sm,
    fontSize: fontSizes.caption,
    color: colors.muted,
    lineHeight: 17,
  },
});
