import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { groupStories } from '../domain/stories';
import { useI18n } from '../i18n/I18nProvider';
import { useApp } from '../state/AppProvider';
import { colors, fontSizes, radii, spacing } from '../theme/theme';

/**
 * Bandeau des stories du quartier, en tête du fil.
 *
 * Une story dure 24 heures : c'est ce qui la distingue d'une publication. On
 * y met ce qui n'a pas vocation à rester — le marché ce matin, la route
 * coupée, le match de ce soir — sans encombrer le fil pour autant.
 */
export function StoriesRow({ onOpen, onAdd }: { onOpen: (index: number) => void; onAdd: () => void }) {
  const { s, rtl } = useI18n();
  const { stories, repository } = useApp();
  const { groups } = groupStories(stories);

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.row, rtl.row]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={s.stories.add}
          onPress={onAdd}
          style={styles.item}
        >
          <View style={[styles.bubble, styles.addBubble]}>
            <Text style={styles.addSign}>＋</Text>
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {s.stories.mine}
          </Text>
        </Pressable>

        {groups.map((group) => {
          const première = group.items[0]!;
          return (
            <Pressable
              key={group.authorName + group.firstIndex}
              accessibilityRole="button"
              accessibilityLabel={`${s.stories.of} ${group.authorName}`}
              onPress={() => onOpen(group.firstIndex)}
              style={styles.item}
            >
              <View style={styles.bubble}>
                {première.photoId ? (
                  <Image
                    source={{ uri: repository.photoUri(première.photoId) }}
                    style={styles.thumb}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.initial}>{group.authorName.slice(0, 1).toUpperCase()}</Text>
                )}

                {/* Plusieurs stories du même voisin : une seule bulle, avec
                    leur nombre. */}
                {group.items.length > 1 ? (
                  <View style={styles.count}>
                    <Text style={styles.countText}>{group.items.length}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.name} numberOfLines={1}>
                {group.authorIsMe ? s.stories.mine : group.authorName}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  row: { gap: spacing.md, paddingVertical: spacing.xs },
  item: { width: 64, alignItems: 'center' },
  bubble: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: colors.brand,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  addBubble: { borderStyle: 'dashed', borderColor: colors.muted },
  addSign: { fontSize: 24, color: colors.muted },
  thumb: { width: '100%', height: '100%', borderRadius: radii.lg },
  initial: { fontSize: 22, fontWeight: '700', color: colors.brand },
  count: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    minWidth: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: colors.brand,
    alignItems: 'center',
  },
  countText: { color: colors.paper, fontSize: fontSizes.caption, fontWeight: '700' },
  name: { marginTop: 4, fontSize: fontSizes.caption, color: colors.muted, maxWidth: 64 },
});
