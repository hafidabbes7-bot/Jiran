import React from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useI18n } from '../i18n/I18nProvider';
import { colors, fontSizes, radii, spacing } from '../theme/theme';

export function Field({
  label,
  error,
  hint,
  ...inputProps
}: TextInputProps & { label: string; error?: string; hint?: string }) {
  const { rtl } = useI18n();

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, rtl.text]}>{label}</Text>
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
  label: {
    fontSize: fontSizes.small,
    fontWeight: '600',
    color: colors.muted,
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
