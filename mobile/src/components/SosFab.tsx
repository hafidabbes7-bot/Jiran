import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useI18n } from '../i18n/I18nProvider';
import { colors, fontSizes } from '../theme/theme';

/**
 * Bouton SOS flottant, visible sur tous les écrans (§4.16) : en urgence, il ne
 * doit jamais falloir chercher dans un menu.
 */
export function SosFab({ onPress }: { onPress: () => void }) {
  const { s } = useI18n();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={s.sos.title}
      onPress={onPress}
      style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
    >
      <Text style={styles.text}>🆘</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    left: 18,
    bottom: 96,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.alert,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: colors.ink,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  pressed: { opacity: 0.85 },
  text: { fontSize: fontSizes.heading },
});
