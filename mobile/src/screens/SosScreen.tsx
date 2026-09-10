import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { PrimaryButton } from '../components/PrimaryButton';
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n/I18nProvider';
import { useApp } from '../state/AppProvider';
import { colors, fontSizes, radii, spacing } from '../theme/theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Sos'>;

/**
 * Alerte SOS (§4.16).
 *
 * Le voisin choisit lui-même qui il alerte : pas de diffusion automatique à
 * tout le quartier. La position n'est jointe que si la localisation est
 * autorisée, et l'écran laisse toujours la possibilité d'annuler pour fausse
 * alerte.
 */
export function SosScreen({ navigation }: Props) {
  const { s, format, rtl } = useI18n();
  const { neighbors, setTrusted } = useApp();
  const toast = useToast();

  const trusted = useMemo(() => neighbors.filter((n) => n.trusted), [neighbors]);
  const others = useMemo(() => neighbors.filter((n) => !n.trusted), [neighbors]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [position, setPosition] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<number | null>(null);

  // Les voisins de confiance sont pré-cochés : en urgence, on veut appuyer une
  // seule fois.
  useEffect(() => {
    setSelected(new Set(trusted.map((n) => n.id)));
  }, [trusted]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== Location.PermissionStatus.GRANTED) return;
        const reading = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        setPosition(
          `${reading.coords.latitude.toFixed(5)}, ${reading.coords.longitude.toFixed(5)}`
        );
      } catch {
        // Sans position, l'alerte part quand même : elle vaut mieux que rien.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = selected.size > 0 && selected.size === trusted.length;

  const send = () => {
    if (selected.size === 0) {
      toast(s.sos.noSelection);
      return;
    }
    // TODO(§7.7) : remettre l'alerte au service de notifications push, pour
    // qu'elle arrive même application fermée. Ici, elle n'est que confirmée
    // localement.
    setSentTo(selected.size);
  };

  const cancel = () => {
    setSentTo(null);
    toast(s.sos.cancelled);
    navigation.goBack();
  };

  if (sentTo !== null) {
    return (
      <View style={styles.sentScreen}>
        <Text style={styles.sentEmoji}>🆘</Text>
        <Text style={styles.sentTitle}>{s.sos.sentTitle}</Text>
        <Text style={styles.sentDetail}>
          {sentTo === 1 ? s.sos.sentDetailOne : format(s.sos.sentDetailMany, { count: sentTo })}
        </Text>
        <Text style={styles.sentPosition}>
          {position ? format(s.sos.positionShared, { position }) : s.sos.positionUnknown}
        </Text>
        <Text style={styles.sentPending}>{s.sos.deliveryPending}</Text>
        <PrimaryButton label={s.sos.falseAlarm} tone="ghost" onPress={cancel} style={styles.wide} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.subtitle, rtl.text]}>{s.sos.subtitle}</Text>

        {trusted.length === 0 ? (
          <Text style={[styles.empty, rtl.text]}>{s.sos.noTrusted}</Text>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                setSelected(allSelected ? new Set() : new Set(trusted.map((n) => n.id)))
              }
            >
              <Text style={[styles.selectAll, rtl.text]}>
                {allSelected ? s.sos.unselectAll : s.sos.selectAll}
              </Text>
            </Pressable>

            {trusted.map((neighbor) => (
              <Pressable
                key={neighbor.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected.has(neighbor.id) }}
                onPress={() => toggle(neighbor.id)}
                style={[styles.row, rtl.row, selected.has(neighbor.id) && styles.rowSelected]}
              >
                <Text style={styles.rowEmoji}>{selected.has(neighbor.id) ? '☑️' : '⬜'}</Text>
                <View style={styles.flex}>
                  <Text style={[styles.rowName, rtl.text]}>{neighbor.name}</Text>
                  {neighbor.building ? (
                    <Text style={[styles.rowMeta, rtl.text]}>{neighbor.building}</Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </>
        )}

        <Text style={[styles.sectionTitle, rtl.text]}>{s.sos.othersTitle}</Text>
        {others.map((neighbor) => (
          <View key={neighbor.id} style={[styles.row, rtl.row]}>
            <View style={styles.flex}>
              <Text style={[styles.rowName, rtl.text]}>{neighbor.name}</Text>
              {neighbor.building ? (
                <Text style={[styles.rowMeta, rtl.text]}>{neighbor.building}</Text>
              ) : null}
            </View>
            <Switch
              value={false}
              onValueChange={() => setTrusted(neighbor.id, true)}
              trackColor={{ true: colors.brand, false: colors.line }}
              accessibilityLabel={s.neighborhood.trustedAdd}
            />
          </View>
        ))}

        <Text style={[styles.pending, rtl.text]}>{s.sos.deliveryPending}</Text>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton label={s.sos.send} tone="alert" onPress={send} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 120 },
  subtitle: { fontSize: fontSizes.small, color: colors.muted, marginBottom: spacing.md, lineHeight: 18 },
  empty: { fontSize: fontSizes.small, color: colors.muted, marginBottom: spacing.md },
  selectAll: {
    color: colors.brand,
    fontWeight: '700',
    fontSize: fontSizes.small,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    fontSize: fontSizes.small,
    fontWeight: '700',
    color: colors.muted,
  },
  row: {
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowSelected: { borderColor: colors.brand },
  rowEmoji: { fontSize: fontSizes.title },
  rowName: { fontSize: fontSizes.body, fontWeight: '600', color: colors.ink },
  rowMeta: { fontSize: fontSizes.caption, color: colors.muted, marginTop: 2 },
  pending: {
    marginTop: spacing.lg,
    fontSize: fontSizes.caption,
    color: colors.muted,
    lineHeight: 16,
  },
  footer: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
  },
  sentScreen: {
    flex: 1,
    backgroundColor: colors.alert,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  sentEmoji: { fontSize: 56 },
  sentTitle: { fontSize: fontSizes.heading, fontWeight: '700', color: colors.paper },
  sentDetail: { fontSize: fontSizes.body, color: colors.paper, textAlign: 'center' },
  sentPosition: { fontSize: fontSizes.small, color: colors.alertSoft, textAlign: 'center' },
  sentPending: {
    fontSize: fontSizes.caption,
    color: colors.alertSoft,
    textAlign: 'center',
    lineHeight: 16,
  },
  wide: { alignSelf: 'stretch', marginTop: spacing.lg, backgroundColor: colors.paper },
});
