import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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

        {stories.map((story, index) => (
          <Pressable
            key={story.id}
            accessibilityRole="button"
            accessibilityLabel={`${s.stories.of} ${story.authorName}`}
            onPress={() => onOpen(index)}
            style={styles.item}
          >
            <View style={styles.bubble}>
              {story.photoId ? (
                <Image
                  source={{ uri: repository.photoUri(story.photoId) }}
                  style={styles.thumb}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.initial}>{story.authorName.slice(0, 1).toUpperCase()}</Text>
              )}
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {story.authorIsMe ? s.stories.mine : story.authorName}
            </Text>
          </Pressable>
        ))}
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
  name: { marginTop: 4, fontSize: fontSizes.caption, color: colors.muted, maxWidth: 64 },
});
