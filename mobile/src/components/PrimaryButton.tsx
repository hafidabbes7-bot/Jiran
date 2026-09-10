import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { colors, fontSizes, radii, spacing } from '../theme/theme';

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  tone = 'brand',
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: 'brand' | 'alert' | 'ghost';
  style?: ViewStyle;
}) {
  const inactive = disabled || loading;
  const background =
    tone === 'ghost' ? 'transparent' : tone === 'alert' ? colors.alert : colors.brand;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: inactive ? colors.disabled : background },
        tone === 'ghost' && styles.ghost,
        pressed && !inactive && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.paper} />
      ) : (
        <Text style={[styles.label, tone === 'ghost' && styles.ghostLabel]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  ghost: {
    borderWidth: 1,
    borderColor: colors.line,
  },
  pressed: { opacity: 0.85 },
  label: {
    color: colors.paper,
    fontSize: fontSizes.body,
    fontWeight: '700',
    textAlign: 'center',
  },
  ghostLabel: { color: colors.ink },
});
