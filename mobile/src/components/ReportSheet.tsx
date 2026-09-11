import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ReportReason } from '../domain/types';
import { useI18n } from '../i18n/I18nProvider';
import { colors, fontSizes, radii, spacing } from '../theme/theme';

const REASONS: { reason: ReportReason; emoji: string }[] = [
  { reason: 'spam', emoji: '🚫' },
  { reason: 'inapproprie', emoji: '⚠️' },
  { reason: 'fausse_alerte', emoji: '🚨' },
  { reason: 'autre', emoji: '❓' },
];

/**
 * Feuille de signalement. Le décompte est tenu par le serveur : trois voisins
 * différents masquent le contenu, la récidive le bloque définitivement (§3).
 */
export function ReportSheet({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (reason: ReportReason) => void;
}) {
  const { s, rtl } = useI18n();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={s.common.close}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={[styles.title, rtl.text]}>{s.report.title}</Text>

          {REASONS.map(({ reason, emoji }) => (
            <Pressable
              key={reason}
              accessibilityRole="button"
              onPress={() => onSelect(reason)}
              style={({ pressed }) => [styles.option, rtl.row, pressed && styles.pressed]}
            >
              <Text style={styles.optionEmoji}>{emoji}</Text>
              <Text style={[styles.optionText, rtl.text]}>{s.report[reason]}</Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(36,28,23,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginBottom: spacing.md,
  },
  title: { fontSize: fontSizes.title, fontWeight: '700', color: colors.ink, marginBottom: spacing.sm },
  option: {
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  pressed: { opacity: 0.85 },
  optionEmoji: { fontSize: fontSizes.title },
  optionText: { flex: 1, fontSize: fontSizes.body, color: colors.ink },
});
