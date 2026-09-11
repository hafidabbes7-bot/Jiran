import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { PrimaryButton } from '../components/PrimaryButton';
import { useToast } from '../components/Toast';
import { pickPhoto, type PickedPhoto } from '../data/photos';
import { moderateText } from '../domain/moderation/textModeration';
import { useI18n } from '../i18n/I18nProvider';
import { useApp } from '../state/AppProvider';
import { colors, fontSizes, radii, spacing } from '../theme/theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'NewStory'>;

/** Nouvelle story : une photo, un mot, ou les deux — mais pas rien. */
export function NewStoryScreen({ navigation }: Props) {
  const { s, rtl } = useI18n();
  const { publishStory, repository } = useApp();
  const toast = useToast();

  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [text, setText] = useState('');
  const [choosing, setChoosing] = useState(false);
  const [sending, setSending] = useState(false);

  const verdict = moderateText(text);
  const prêt = (photo !== null || text.trim().length > 0) && verdict.clean;

  const choisir = async () => {
    setChoosing(true);
    try {
      const choisie = await pickPhoto();
      if (choisie) setPhoto(choisie);
      else toast(s.compose.photoDenied);
    } catch {
      toast(s.compose.photoFailed);
    } finally {
      setChoosing(false);
    }
  };

  const publier = async () => {
    if (!prêt) return;
    setSending(true);
    try {
      const photoId = photo ? await repository.uploadPhoto(photo.base64, photo.mime) : undefined;
      await publishStory({ photoId, text: text.trim() || undefined });
      navigation.goBack();
    } catch {
      toast(s.compose.publishFailed);
    } finally {
      setSending(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={[styles.intro, rtl.text]}>{s.stories.intro}</Text>

      {photo ? (
        <Image source={{ uri: photo.uri }} style={styles.preview} resizeMode="cover" />
      ) : null}

      <PrimaryButton
        label={photo ? s.stories.changePhoto : s.compose.photoAdd}
        tone="ghost"
        loading={choosing}
        onPress={choisir}
      />

      <TextInput
        multiline
        textAlignVertical="top"
        placeholder={s.stories.textPlaceholder}
        placeholderTextColor={colors.muted}
        value={text}
        onChangeText={setText}
        maxLength={300}
        style={[styles.textarea, rtl.text]}
      />

      {!verdict.clean ? (
        <Text style={[styles.warning, rtl.text]}>{s.compose.moderationWarning}</Text>
      ) : null}

      <PrimaryButton
        label={s.stories.publish}
        disabled={!prêt}
        loading={sending}
        onPress={publier}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  intro: { fontSize: fontSizes.small, color: colors.muted, lineHeight: 18 },
  preview: {
    width: '100%',
    // Hauteur fixe : un aperçu plein format repoussait le bouton « Partager »
    // hors de l'écran.
    height: 220,
    borderRadius: radii.md,
    backgroundColor: colors.sand,
  },
  textarea: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    padding: spacing.md,
    minHeight: 90,
    fontSize: fontSizes.body,
    color: colors.ink,
  },
  warning: { color: colors.alert, fontSize: fontSizes.small },
});
