import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/**
 * Prévient le voisin, ici et maintenant.
 *
 * Ce n'est pas une notification distante : aucun service de remise n'est
 * branché (§7.7), et en attendre un laisserait le SOS et les réponses
 * invisibles. L'application, elle, sait ce qui est arrivé dès qu'elle
 * rafraîchit — elle peut donc le faire savoir tout de suite.
 *
 * Sur le web, ça passe par la notification du navigateur ; sur téléphone, par
 * une notification locale. Dans les deux cas, si c'est refusé ou indisponible,
 * la liste dans l'application reste la source de vérité.
 */
export async function localNotify(title: string, body: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      const api = typeof window !== 'undefined' ? window.Notification : undefined;
      if (!api) return;
      if (api.permission === 'default') await api.requestPermission();
      if (api.permission !== 'granted') return;

      // eslint-disable-next-line no-new -- l'objet n'a pas à être gardé
      new api(title, { body });
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    });
  } catch {
    // Une notification qui ne part pas ne doit rien casser : l'information
    // reste dans la liste des notifications de l'application.
  }
}

/** Demande l'autorisation une fois, sur un geste du voisin. */
export async function askNotificationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      const api = typeof window !== 'undefined' ? window.Notification : undefined;
      if (!api) return false;
      if (api.permission === 'granted') return true;
      return (await api.requestPermission()) === 'granted';
    }

    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}
