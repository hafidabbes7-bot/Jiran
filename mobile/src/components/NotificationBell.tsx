import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '../i18n/I18nProvider';
import { useApp } from '../state/AppProvider';
import { colors, fontSizes, radii } from '../theme/theme';

/**
 * Cloche des notifications, dans l'en-tête de l'accueil.
 *
 * Elle était rangée dans le profil, c'est-à-dire à deux gestes de l'écran que
 * le voisin regarde vraiment. Une notification qu'il faut aller chercher n'est
 * pas une notification : elle vit maintenant là où il arrive, avec le nombre
 * de non-lues écrit dessus.
 *
 * Le nombre vient du serveur, et redescend dès qu'une notification est lue —
 * la pastille disparaît à zéro.
 */
export function NotificationBell({ onPress }: { onPress: () => void }) {
  const { s, format } = useI18n();
  const { unreadNotifications } = useApp();

  const compte = unreadNotifications;
  // Au-delà de 99, le nombre exact n'apprend plus rien et ne tient plus dans
  // la pastille.
  const étiquette = compte > 99 ? '99+' : String(compte);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        compte > 0
          ? format(s.notifications.bellUnread, { count: String(compte) })
          : s.notifications.title
      }
      onPress={onPress}
      style={styles.bouton}
      hitSlop={8}
    >
      <Text style={styles.cloche}>🔔</Text>

      {compte > 0 ? (
        <View style={[styles.pastille, compte > 9 && styles.pastilleLarge]}>
          <Text style={styles.nombre} numberOfLines={1}>
            {étiquette}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bouton: { padding: 6, marginEnd: 4 },
  cloche: { fontSize: 22 },
  pastille: {
    position: 'absolute',
    top: 0,
    // La pastille déborde volontairement de la cloche : collée dedans, elle
    // masquerait le dessin et se lirait moins bien.
    end: 0,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.alert,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.paper,
  },
  pastilleLarge: { minWidth: 24 },
  nombre: {
    color: '#fff',
    fontSize: fontSizes.caption,
    fontWeight: '800',
    lineHeight: 14,
  },
});
