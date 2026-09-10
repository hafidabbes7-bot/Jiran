import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import type { Category, CategoryFilter } from '../domain/types';
import { useI18n } from '../i18n/I18nProvider';
import { colors, fontSizes, radii, spacing } from '../theme/theme';

/** Catégories du socle V1, dans l'ordre d'affichage du fil. */
export const FILTERS: CategoryFilter[] = ['tout', 'securite', 'entraide', 'annonce', 'evenement'];
export const CATEGORIES: Category[] = ['securite', 'entraide', 'annonce', 'evenement'];

export const CATEGORY_EMOJI: Record<CategoryFilter, string> = {
  tout: '🏘️',
  securite: '🚨',
  entraide: '🤝',
  annonce: '🛍️',
  evenement: '📅',
};

/** Couleur de badge par catégorie, reprise du prototype. */
export const CATEGORY_COLORS: Record<Category, { fg: string; bg: string }> = {
  securite: { fg: colors.alert, bg: colors.alertSoft },
  entraide: { fg: colors.aid, bg: colors.aidSoft },
  annonce: { fg: colors.sale, bg: colors.saleSoft },
  evenement: { fg: colors.event, bg: colors.eventSoft },
};

export function CategoryChips<T extends CategoryFilter>({
  options,
  selected,
  onSelect,
}: {
  options: T[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  const { s, isRTL } = useI18n();
  const scroller = useRef<ScrollView>(null);

  // La première puce doit rester visible dans les deux sens de lecture : à
  // droite en arabe, à gauche en français.
  const alignToStart = useCallback(() => {
    if (isRTL) scroller.current?.scrollToEnd({ animated: false });
    else scroller.current?.scrollTo({ x: 0, animated: false });
  }, [isRTL]);

  useEffect(alignToStart, [alignToStart]);

  return (
    <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      onContentSizeChange={alignToStart}
      onLayout={alignToStart}
      contentContainerStyle={[styles.row, isRTL && styles.rowRTL]}
    >
      {options.map((option) => {
        const active = option === selected;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(option)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {CATEGORY_EMOJI[option]} {s.categories[option]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  rowRTL: { flexDirection: 'row-reverse' },
  chip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontSize: fontSizes.small, fontWeight: '600', color: colors.ink },
  chipTextActive: { color: colors.paper },
});
