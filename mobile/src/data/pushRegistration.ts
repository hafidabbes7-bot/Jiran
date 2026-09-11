import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

export type PushPlatform = 'ios' | 'android' | 'web';

export interface PushRegistration {
  token: string;
  platform: PushPlatform;
}

/**
 * Obtient le jeton de notification de cet appareil.
 *
 * Renvoie `null` sans lever d'erreur dans tous les cas où ce n'est pas
 * possible — refus de l'utilisateur, émulateur, Expo Go sur Android depuis le
 * SDK 53, projet Expo sans identifiant. L'inscription ne doit jamais échouer à
 * cause des notifications : le voisin pourra toujours utiliser l'application,
 * il ne recevra simplement pas les alertes tant que ce n'est pas réglé.
 */
export async function registerForPush(): Promise<PushRegistration | null> {
  // Un émulateur n'a pas de jeton : inutile de demander la permission.
  if (!Device.isDevice) return null;

  try {
    // Android n'affiche les alertes prioritaires que si le canal existe.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('alertes', {
        name: 'Alertes et SOS',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    const granted =
      existing.granted ||
      (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return null;

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    const platform: PushPlatform =
      Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

    return { token: data, platform };
  } catch {
    return null;
  }
}

/** Affiche les alertes même quand l'application est ouverte. */
export function configureForegroundAlerts(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}
