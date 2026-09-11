import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { CATEGORIES, CategoryChips } from '../components/CategoryChips';
import { PrimaryButton } from '../components/PrimaryButton';
import { useToast } from '../components/Toast';
import { RepositoryError } from '../data/repository';
import { moderateText } from '../domain/moderation/textModeration';
import type { Category } from '../domain/types';
import { useI18n } from '../i18n/I18nProvider';
import { useApp } from '../state/AppProvider';
import { colors, fontSizes, radii, spacing } from '../theme/theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Compose'>;

export function ComposeScreen({ navigation }: Props) {
  const { s, rtl } = useI18n();
  const { publish } = useApp();
  const toast = useToast();

  const [category, setCategory] = useState<Category>('entraide');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Le filtre tourne à chaque frappe : le voisin voit le problème pendant qu'il
  // écrit, pas après avoir appuyé sur « Publier » (§3).
  const moderation = useMemo(() => moderateText(text), [text]);
  const tooShort = text.trim().length < 3;
  const blocked = !moderation.clean || tooShort;

  const submit = async () => {
    if (blocked) return;
    setSubmitting(true);
    try {
      await publish({ category, text });
      toast(s.compose.published);
      navigation.goBack();
    } catch (error) {
      // Le filtre local prévient pendant la frappe, mais c'est le serveur qui
      // décide : son refus doit être visible, pas avalé.
      const refusedByModeration =
        error instanceof RepositoryError && error.kind === 'inappropriate_text';
      toast(refusedByModeration ? s.compose.moderationWarning : s.compose.publishFailed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.label, rtl.text]}>{s.compose.categoryLabel}</Text>
        <View style={styles.chips}>
          <CategoryChips options={CATEGORIES} selected={category} onSelect={setCategory} />
        </View>

        <TextInput
          multiline
          textAlignVertical="top"
          placeholder={s.compose.placeholder}
          placeholderTextColor={colors.muted}
          value={text}
          onChangeText={setText}
          style={[styles.textarea, rtl.text]}
        />

        {!moderation.clean ? (
          <Text style={[styles.warning, rtl.text]}>{s.compose.moderationWarning}</Text>
        ) : null}

        <Text style={[styles.photoNote, rtl.text]}>{s.compose.photoUnavailable}</Text>

        <PrimaryButton
          label={s.compose.publish}
          disabled={blocked}
          loading={submitting}
          onPress={submit}
        />
        {tooShort && moderation.clean ? (
          <Text style={[styles.hint, rtl.text]}>{s.compose.tooShort}</Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  label: {
    fontSize: fontSizes.small,
    fontWeight: '600',
    color: colors.muted,
    marginBottom: spacing.xs,
  },
  chips: { marginHorizontal: -spacing.lg, marginBottom: spacing.sm },
  textarea: {
    minHeight: 160,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: fontSizes.body,
    lineHeight: 20,
    color: colors.ink,
  },
  warning: {
    marginTop: spacing.md,
    backgroundColor: colors.alertSoft,
    color: colors.alert,
    borderRadius: radii.sm,
    padding: spacing.md,
    fontSize: fontSizes.small,
    lineHeight: 18,
  },
  photoNote: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    color: colors.muted,
    fontSize: fontSizes.small,
    lineHeight: 18,
  },
  hint: { marginTop: spacing.sm, color: colors.muted, fontSize: fontSizes.small },
});
