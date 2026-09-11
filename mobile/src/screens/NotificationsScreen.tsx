import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import { PrimaryButton } from '../components/PrimaryButton';
import { askNotificationPermission, notificationPermission } from '../data/localNotify';
import {
  DEFAULT_SETTINGS,
  SETTABLE_KINDS,
  loadSettings,
  saveSettings,
  type NotificationSettings,
} from '../data/notificationSettings';
import { formatRelative } from '../domain/time';
import type { NotificationKind } from '../domain/types';
import { useI18n } from '../i18n/I18nProvider';
import { useApp } from '../state/AppProvider';
import { colors, fontSizes, radii, spacing } from '../theme/theme';
import type { RootStackParamList, TabParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  NativeStackScreenProps<RootStackParamList, 'Notifications'>,
  BottomTabScreenProps<TabParamList>
>;

const EMOJIS: Record<NotificationKind, string> = {
  securite: '🚨',
  reponse: '💬',
  message: '✉️',
  sos: '🆘',
  annonce: '📢',
  evenement: '📅',
};

/**
 * Ce qui est arrivé au voisin, et ce qu'il accepte d'être prévenu (§4.17).
 *
 * La liste vient du serveur : elle reste juste même quand aucune notification
 * n'est arrivée sur le téléphone — ce qui est le cas tant qu'aucun service de
 * remise n'est branché. Les réglages, eux, sont propres à cet appareil.
 */
export function NotificationsScreen({ navigation }: Props) {
  const { s, language, rtl } = useI18n();
  const { notifications, markNotificationsRead } = useApp();

  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    loadSettings().then(setSettings);
    // On regarde l'état sans rien demander : la demande, elle, part d'un geste.
    notificationPermission().then(setAllowed);
  }, []);

  const basculer = async (kind: NotificationKind, value: boolean) => {
    const suivant = { ...settings, [kind]: value };
    setSettings(suivant);
    await saveSettings(suivant);
    // Activer une catégorie sans l'autorisation du téléphone ne donnerait
    // rien : on la demande au moment où le voisin la demande.
    if (value && allowed !== true) setAllowed(await askNotificationPermission());
  };

  /** Ouvre ce que la notification désigne, quand c'est possible. */
  const ouvrir = async (kind: NotificationKind, ref?: string) => {
    if (kind === 'reponse' || kind === 'securite' || kind === 'annonce' || kind === 'evenement') {
      if (ref) navigation.navigate('PostDetail', { postId: ref });
      return;
    }
    if (kind === 'message' && ref) {
      navigation.navigate('Messages');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Sans l'autorisation du téléphone, aucune notification n'apparaît —
          et rien ne le disait. C'est la première chose de l'écran. */}
      {allowed === true ? (
        <Text style={[styles.allowed, rtl.text]}>{s.notifications.allowed}</Text>
      ) : (
        <View>
          <Text style={[styles.hint, rtl.text]}>{s.notifications.askHint}</Text>
          <PrimaryButton
            label={s.notifications.ask}
            onPress={async () => setAllowed(await askNotificationPermission())}
          />
          {allowed === false ? (
            <Text style={[styles.hint, styles.refused, rtl.text]}>
              {s.notifications.refused}
            </Text>
          ) : null}
        </View>
      )}

      <View style={[styles.headerRow, rtl.row]}>
        <Text style={[styles.section, rtl.text]}>{s.notifications.recent}</Text>
        {notifications.some((item) => !item.read) ? (
          <Pressable accessibilityRole="button" onPress={() => markNotificationsRead()}>
            <Text style={styles.link}>{s.notifications.markAll}</Text>
          </Pressable>
        ) : null}
      </View>

      {notifications.length === 0 ? (
        <Text style={[styles.empty, rtl.text]}>{s.notifications.empty}</Text>
      ) : null}

      {notifications.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={item.title}
          onPress={async () => {
            if (!item.read) await markNotificationsRead(item.id);
            await ouvrir(item.kind, item.ref);
          }}
          style={[styles.card, !item.read && styles.unread]}
        >
          <Text style={[styles.title, rtl.text]}>
            {EMOJIS[item.kind]} {item.title}
          </Text>
          {item.body ? (
            <Text style={[styles.body, rtl.text]} numberOfLines={2}>
              {item.body}
            </Text>
          ) : null}
          <Text style={[styles.time, rtl.text]}>{formatRelative(item.createdAt, language)}</Text>
        </Pressable>
      ))}

      <Text style={[styles.section, rtl.text]}>{s.notifications.settings}</Text>
      <Text style={[styles.hint, rtl.text]}>{s.notifications.settingsHint}</Text>

      {SETTABLE_KINDS.map((kind) => (
        <View key={kind} style={[styles.card, styles.settingRow, rtl.row]}>
          <Text style={[styles.title, rtl.text]}>
            {EMOJIS[kind]} {s.notifications.kinds[kind]}
          </Text>
          <Switch
            value={settings[kind]}
            onValueChange={(value) => basculer(kind, value)}
            trackColor={{ true: colors.brand, false: colors.line }}
            accessibilityLabel={s.notifications.kinds[kind]}
          />
        </View>
      ))}

      <Text style={[styles.hint, rtl.text]}>{s.notifications.sosAlways}</Text>
      <Text style={[styles.hint, rtl.text]}>{s.notifications.openAppHint}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  headerRow: { alignItems: 'center', justifyContent: 'space-between' },
  section: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    fontSize: fontSizes.small,
    fontWeight: '700',
    color: colors.muted,
  },
  link: { color: colors.brand, fontWeight: '700', fontSize: fontSizes.small },
  empty: { fontSize: fontSizes.small, color: colors.muted },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  unread: { borderColor: colors.brand, backgroundColor: colors.sand },
  settingRow: { alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: fontSizes.body, fontWeight: '600', color: colors.ink, flexShrink: 1 },
  body: { marginTop: 2, fontSize: fontSizes.small, color: colors.muted },
  time: { marginTop: 2, fontSize: fontSizes.caption, color: colors.muted },
  hint: { fontSize: fontSizes.small, color: colors.muted, lineHeight: 18, marginBottom: spacing.sm },
  refused: { color: colors.alert },
  allowed: { color: colors.aid, fontSize: fontSizes.small, fontWeight: '600' },
});
