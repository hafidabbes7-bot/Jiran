import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useI18n } from '../i18n/I18nProvider';
import { colors, fontSizes, radii, spacing } from '../theme/theme';

export function Field({
  label,
  error,
  hint,
  action,
  ...inputProps
}: TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  /**
   * Bouton de texte posé au bout de l'étiquette — « Afficher » sur un mot de
   * passe, par exemple. Il vit là plutôt que dans le champ : superposé au
   * texte saisi, il masquerait les derniers caractères, précisément ceux que
   * l'on veut relire.
   */
  action?: { label: string; onPress: () => void };
}) {
  const { rtl } = useI18n();

  return (
    <View style={styles.wrapper}>
      <View style={[styles.labelRow, rtl.row]}>
        <Text style={[styles.label, rtl.text]}>{label}</Text>
        {action ? (
          <Pressable accessibilityRole="button" accessibilityLabel={action.label} onPress={action.onPress} hitSlop={8}>
            <Text style={styles.action}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
      <TextInput
        placeholderTextColor={colors.muted}
        {...inputProps}
        style={[styles.input, rtl.text, error ? styles.inputError : null, inputProps.style]}
      />
      {error ? <Text style={[styles.error, rtl.text]}>{error}</Text> : null}
      {!error && hint ? <Text style={[styles.hint, rtl.text]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  labelRow: { alignItems: 'center', justifyContent: 'space-between' },
  label: {
    fontSize: fontSizes.small,
    fontWeight: '600',
    color: colors.muted,
    marginBottom: spacing.xs,
  },
  action: {
    fontSize: fontSizes.small,
    fontWeight: '700',
    color: colors.brand,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSizes.body,
    color: colors.ink,
  },
  inputError: { borderColor: colors.alert },
  error: { marginTop: spacing.xs, fontSize: fontSizes.small, color: colors.alert },
  hint: { marginTop: spacing.xs, fontSize: fontSizes.small, color: colors.muted },
});
