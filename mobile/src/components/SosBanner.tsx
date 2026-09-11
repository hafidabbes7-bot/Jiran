import React from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatRelative } from '../domain/time';
import { useI18n } from '../i18n/I18nProvider';
import { useApp } from '../state/AppProvider';
import { colors, fontSizes, radii, spacing } from '../theme/theme';

/**
 * Bandeau rouge des alertes SOS en cours, en tête du fil et des alertes.
 *
 * Une alerte d'urgence ne peut pas reposer sur les seules notifications : tant
 * qu'aucun service de remise n'est branché — et même après, si le voisin les a
 * coupées — c'est l'application qui doit la montrer. Elle apparaît ici dans les
 * secondes qui suivent, sans rien toucher.
 */
export function SosBanner() {
  const { s, format, language, rtl } = useI18n();
  const { activeSos, cancelSos, refresh } = useApp();

  if (activeSos.length === 0) return null;

  const ouvrirCarte = (latitude: number, longitude: number, nom: string) => {
    const coords = `${latitude},${longitude}`;
    const url = Platform.select({
      ios: `maps://?daddr=${coords}`,
      android: `geo:${coords}?q=${coords}(${encodeURIComponent(nom)})`,
      default: `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`,
    });
    Linking.openURL(url).catch(() => undefined);
  };

  return (
    <View>
      {activeSos.map((alerte) => (
        <View key={alerte.id} style={[styles.banner, alerte.mine && styles.mine]}>
          <Text style={[styles.title, rtl.text]}>
            {alerte.mine
              ? s.sos.activeMine
              : format(s.sos.activeFrom, { name: alerte.fromName })}
          </Text>
          <Text style={[styles.meta, rtl.text]}>
            {alerte.building ? `${alerte.building} · ` : ''}
            {formatRelative(alerte.createdAt, language)}
          </Text>

          <View style={[styles.actions, rtl.row]}>
            {alerte.latitude !== undefined && alerte.longitude !== undefined ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => ouvrirCarte(alerte.latitude!, alerte.longitude!, alerte.fromName)}
              >
                <Text style={styles.action}>{s.sos.openMap}</Text>
              </Pressable>
            ) : (
              <Text style={styles.metaAction}>{s.sos.positionUnknown}</Text>
            )}

            {alerte.mine ? (
              <Pressable
                accessibilityRole="button"
                onPress={async () => {
                  await cancelSos(alerte.id);
                  await refresh();
                }}
              >
                <Text style={styles.action}>{s.sos.falseAlarm}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.alert,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  mine: { opacity: 0.92 },
  title: { color: colors.paper, fontSize: fontSizes.body, fontWeight: '700' },
  meta: { color: colors.paper, opacity: 0.9, fontSize: fontSizes.small, marginTop: 2 },
  actions: { marginTop: spacing.sm, gap: spacing.lg },
  action: {
    color: colors.paper,
    fontSize: fontSizes.small,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  metaAction: { color: colors.paper, opacity: 0.9, fontSize: fontSizes.small },
});
