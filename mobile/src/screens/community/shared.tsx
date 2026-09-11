import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { useI18n } from '../../i18n/I18nProvider';
import { colors, fontSizes, radii, spacing } from '../../theme/theme';

/**
 * Petite mécanique commune aux écrans de la vie de quartier : charger au
 * premier affichage, dire franchement quand le serveur n'a pas répondu, et
 * appliquer le résultat d'une action sans attendre un rechargement complet.
 *
 * Écrite une fois ici plutôt que huit fois : ces écrans se ressemblent, et
 * c'est la partie qu'on oublie de traiter — l'échec réseau — qui compte.
 */
export function useRemote<T>(load: () => Promise<T>, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(true);
  const monté = useRef(true);

  const reload = useCallback(async () => {
    setBusy(true);
    try {
      const next = await load();
      if (monté.current) {
        setData(next);
        setFailed(false);
      }
    } catch {
      if (monté.current) setFailed(true);
    } finally {
      if (monté.current) setBusy(false);
    }
  }, [load]);

  useEffect(() => {
    monté.current = true;
    reload();
    return () => {
      monté.current = false;
    };
  }, [reload]);

  /** Lance une action, puis recharge : le serveur reste la source de vérité. */
  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      setBusy(true);
      try {
        await action();
        setFailed(false);
        await reload();
      } catch {
        if (monté.current) setFailed(true);
      } finally {
        if (monté.current) setBusy(false);
      }
    },
    [reload]
  );

  return { data, setData, failed, busy, reload, run };
}

export function CommunityScreen({
  children,
  failed,
}: {
  children: React.ReactNode;
  failed?: boolean;
}) {
  const { s, rtl } = useI18n();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {failed ? <Text style={[styles.failed, rtl.text]}>{s.community.failed}</Text> : null}
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  const { rtl } = useI18n();
  return <Text style={[styles.section, rtl.text]}>{children}</Text>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  const { rtl } = useI18n();
  return <Text style={[styles.empty, rtl.text]}>{children}</Text>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  intro: { fontSize: fontSizes.small, color: colors.muted, marginBottom: spacing.md, lineHeight: 19 },
  failed: { marginBottom: spacing.md, fontSize: fontSizes.small, color: colors.alert },
  section: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    fontSize: fontSizes.small,
    fontWeight: '700',
    color: colors.muted,
  },
  empty: { fontSize: fontSizes.small, color: colors.muted },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  title: { fontSize: fontSizes.body, fontWeight: '700', color: colors.ink },
  meta: { marginTop: 2, fontSize: fontSizes.small, color: colors.muted },
  row: { alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  spaced: { marginTop: spacing.sm },
  pill: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  pillActive: { borderColor: colors.brand, backgroundColor: colors.sand },
  pillText: { fontSize: fontSizes.small, fontWeight: '600', color: colors.muted },
  pillTextActive: { color: colors.brand },
  pillRow: { flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  link: { color: colors.brand, fontWeight: '700', fontSize: fontSizes.small },
  moveError: { marginTop: spacing.sm, fontSize: fontSizes.small, color: colors.alert },
});
