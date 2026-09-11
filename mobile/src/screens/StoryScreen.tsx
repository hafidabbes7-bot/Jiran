import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { groupStories } from '../domain/stories';
import { formatRelative } from '../domain/time';
import { useI18n } from '../i18n/I18nProvider';
import { useApp } from '../state/AppProvider';
import { colors, fontSizes, radii, spacing } from '../theme/theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Story'>;

/**
 * Lecture d'une story, plein écran.
 *
 * On avance d'une touche sur la droite, on recule sur la gauche — le geste
 * que tout le monde connaît déjà. Pas de minuterie qui fait défiler tout
 * seul : sur un réseau lent, elle passerait avant que la photo s'affiche.
 */
export function StoryScreen({ route, navigation }: Props) {
  const { s, format, language, rtl } = useI18n();
  const { stories, removeStory, repository } = useApp();
  const [index, setIndex] = useState(route.params.index);

  // Même ordre que le bandeau : les stories d'un voisin se suivent, donc une
  // touche à droite passe à la suivante du même voisin avant de changer.
  const { ordered } = groupStories(stories);
  const story = ordered[index];
  if (!story) return null;

  const aller = (pas: number) => {
    const suivant = index + pas;
    if (suivant < 0 || suivant >= ordered.length) navigation.goBack();
    else setIndex(suivant);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.author}>{story.authorName}</Text>
        <Text style={styles.time}>{formatRelative(story.createdAt, language)}</Text>
      </View>

      <View style={styles.stage}>
        {story.photoId ? (
          <Image
            source={{ uri: repository.photoUri(story.photoId) }}
            style={styles.photo}
            resizeMode="contain"
            accessibilityLabel={format(s.feed.photoOf, { name: story.authorName })}
          />
        ) : null}
        {story.text ? <Text style={[styles.text, rtl.text]}>{story.text}</Text> : null}

        {/* Zones de navigation, invisibles mais larges. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={s.stories.previous}
          style={[styles.zone, styles.left]}
          onPress={() => aller(-1)}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={s.stories.next}
          style={[styles.zone, styles.right]}
          onPress={() => aller(1)}
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.counter}>
          {index + 1} / {ordered.length}
        </Text>
        {story.authorIsMe ? (
          <Pressable
            accessibilityRole="button"
            onPress={async () => {
              await removeStory(story.id);
              navigation.goBack();
            }}
          >
            <Text style={styles.remove}>{s.stories.remove}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  author: { color: colors.paper, fontSize: fontSizes.body, fontWeight: '700' },
  time: { color: colors.paper, opacity: 0.7, fontSize: fontSizes.caption },
  stage: { flex: 1, justifyContent: 'center' },
  photo: { width: '100%', height: '80%' },
  text: {
    color: colors.paper,
    fontSize: fontSizes.body,
    lineHeight: 22,
    padding: spacing.lg,
    backgroundColor: '#0007',
    borderRadius: radii.sm,
    margin: spacing.lg,
  },
  zone: { position: 'absolute', top: 0, bottom: 0, width: '35%' },
  left: { left: 0 },
  right: { right: 0 },
  footer: {
    padding: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  counter: { color: colors.paper, opacity: 0.7, fontSize: fontSizes.small },
  remove: { color: colors.alert, fontWeight: '700', fontSize: fontSizes.small },
});
