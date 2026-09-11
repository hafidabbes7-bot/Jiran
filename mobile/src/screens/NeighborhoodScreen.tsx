import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  NEIGHBORHOODS,
  TWINNING_THRESHOLD,
  findNeighborhood,
} from '../data/neighborhoods';
import { useI18n, useLocalizedName } from '../i18n/I18nProvider';
import { useApp } from '../state/AppProvider';
import { colors, fontSizes, radii, spacing } from '../theme/theme';
import type { RootStackParamList, TabParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Neighborhood'>,
  NativeStackScreenProps<RootStackParamList>
>;

/**
 * Écran « Mon quartier » (§2) : nombre de voisins vérifiés, cités jumelées avec
 * leur progression vers le seuil, voisins de confiance et état de la
 * modération.
 */
export function NeighborhoodScreen({ navigation }: Props) {
  const { s, format, rtl } = useI18n();
  const localizedName = useLocalizedName();
  const { session, neighbors, posts, setTrusted } = useApp();

  const neighborhood = session ? findNeighborhood(session.neighborhoodId) : undefined;

  /** Cités rattachées au même fil, celle du voisin comprise si elle est jumelée. */
  const twinned = useMemo(() => {
    if (!neighborhood) return [];
    const root = neighborhood.twinnedWith ?? neighborhood.id;
    return NEIGHBORHOODS.filter((item) => item.twinnedWith === root);
  }, [neighborhood]);

  const hiddenCount = useMemo(
    () => posts.filter((post) => post.moderation.hidden).length,
    [posts]
  );

  if (!neighborhood) return null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={[styles.title, rtl.text]}>{localizedName(neighborhood)}</Text>
      <Text style={[styles.subtitle, rtl.text]}>
        {format(s.neighborhood.verified, { count: neighborhood.verifiedNeighbors })}
      </Text>

      {twinned.length > 0 ? (
        <View style={styles.card}>
          <Text style={[styles.cardTitle, rtl.text]}>{s.neighborhood.twinnedTitle}</Text>
          <Text style={[styles.cardText, rtl.text]}>{s.neighborhood.twinnedExplain}</Text>

          {twinned.map((item) => (
            <View key={item.id} style={styles.twinRow}>
              <Text style={[styles.twinName, rtl.text]}>{localizedName(item)}</Text>
              <Text style={[styles.twinMeta, rtl.text]}>
                {format(s.neighborhood.twinnedMeta, {
                  count: item.verifiedNeighbors,
                  threshold: TWINNING_THRESHOLD,
                })}
              </Text>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(
                        100,
                        Math.round((item.verifiedNeighbors / TWINNING_THRESHOLD) * 100)
                      )}%`,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={[styles.cardTitle, rtl.text]}>{s.neighborhood.trustedTitle}</Text>
        <Text style={[styles.cardText, rtl.text]}>{s.neighborhood.trustedExplain}</Text>

        {neighbors.map((neighbor) => (
          <View key={neighbor.id} style={[styles.neighborRow, rtl.row]}>
            <View style={styles.flex}>
              <Text style={[styles.neighborName, rtl.text]}>{neighbor.name}</Text>
              {neighbor.building ? (
                <Text style={[styles.neighborMeta, rtl.text]}>{neighbor.building}</Text>
              ) : null}
            </View>
            <Switch
              value={neighbor.trusted}
              onValueChange={(value) => setTrusted(neighbor.id, value)}
              trackColor={{ true: colors.brand, false: colors.line }}
              accessibilityLabel={
                neighbor.trusted ? s.neighborhood.trustedRemove : s.neighborhood.trustedAdd
              }
            />
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={[styles.cardTitle, rtl.text]}>{s.neighborhood.moderationTitle}</Text>
        <Text style={[styles.cardText, rtl.text]}>
          {format(s.neighborhood.moderationPending, { count: hiddenCount })}
        </Text>

        {/* Entrée réservée aux modérateurs ; le serveur refuse la file aux
            autres, ce drapeau ne fait que masquer un lien inutile. */}
        {session?.isModerator ? (
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Moderation')}>
            <Text style={[styles.link, rtl.text]}>{s.neighborhood.moderationOpen} →</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={[styles.cardTitle, rtl.text]}>{s.neighborhood.rulesTitle}</Text>
        {[s.onboarding.rule1, s.onboarding.rule2, s.onboarding.rule3, s.onboarding.rule4].map(
          (rule) => (
            <Text key={rule} style={[styles.rule, rtl.text]}>
              • {rule}
            </Text>
          )
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: 120 },
  flex: { flex: 1 },
  title: { fontSize: fontSizes.heading, fontWeight: '700', color: colors.ink },
  subtitle: { fontSize: fontSizes.small, color: colors.muted, marginTop: 2 },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  cardTitle: { fontSize: fontSizes.body, fontWeight: '700', color: colors.ink },
  cardText: {
    fontSize: fontSizes.small,
    color: colors.muted,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  twinRow: { marginTop: spacing.md },
  twinName: { fontSize: fontSizes.body, fontWeight: '600', color: colors.ink },
  twinMeta: { fontSize: fontSizes.caption, color: colors.muted, marginTop: 2 },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.sand,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: colors.brand },
  neighborRow: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  neighborName: { fontSize: fontSizes.body, color: colors.ink, fontWeight: '600' },
  neighborMeta: { fontSize: fontSizes.caption, color: colors.muted, marginTop: 2 },
  rule: { fontSize: fontSizes.small, color: colors.ink, marginTop: spacing.sm, lineHeight: 18 },
  link: {
    marginTop: spacing.md,
    color: colors.brand,
    fontWeight: '700',
    fontSize: fontSizes.small,
  },
});
