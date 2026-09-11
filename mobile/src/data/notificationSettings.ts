import AsyncStorage from '@react-native-async-storage/async-storage';

import type { NotificationKind } from '../domain/types';

const KEY = 'jiran/notifications';

/**
 * Catégories qu'un voisin peut couper (§4.17).
 *
 * Le SOS n'en fait pas partie : une demande d'aide d'un voisin qu'on a soi-même
 * accepté d'être alerté par n'est pas une préférence d'affichage.
 */
export const SETTABLE_KINDS: NotificationKind[] = [
  'securite',
  'reponse',
  'message',
  'annonce',
  'evenement',
];

export type NotificationSettings = Record<NotificationKind, boolean>;

export const DEFAULT_SETTINGS: NotificationSettings = {
  securite: true,
  reponse: true,
  message: true,
  sos: true,
  annonce: true,
  evenement: true,
};

/** Réglages de cet appareil ; un stockage illisible ne doit rien casser. */
export async function loadSettings(): Promise<NotificationSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<NotificationSettings>), sos: true };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: NotificationSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...settings, sos: true }));
  } catch {
    // Réglage perdu au prochain démarrage, rien de plus.
  }
}
