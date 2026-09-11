import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/** Côté le plus long après réduction : au-delà, on transporte du vide. */
const MAX_SIDE = 1280;

/** Qualité JPEG. 0,6 tient dans les 400 Ko acceptés par le serveur. */
const QUALITY = 0.6;

export interface PickedPhoto {
  base64: string;
  mime: 'image/jpeg';
  /** Adresse locale, pour l'aperçu avant envoi. */
  uri: string;
}

/**
 * Choisit une photo et la réduit avant de l'envoyer.
 *
 * La réduction se fait sur le téléphone, pas sur le serveur : une photo
 * d'appareil moderne pèse plusieurs méga-octets, et les faire passer sur un
 * réseau algérien pour les jeter ensuite serait payer deux fois — en données
 * et en attente.
 *
 * Renvoie `null` si le voisin annule ou refuse l'accès à ses photos.
 */
export async function pickPhoto(): Promise<PickedPhoto | null> {
  // Sur le web, il n'y a pas d'autorisation à demander : la boîte de dialogue
  // de fichiers est elle-même le consentement, et la demander renvoie un refus
  // qui empêcherait de choisir quoi que ce soit.
  if (Platform.OS !== 'web') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return null;
  }

  const choix = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsMultipleSelection: false,
  });
  if (choix.canceled || !choix.assets[0]) return null;

  const asset = choix.assets[0];
  const réduite = await ImageManipulator.manipulateAsync(
    asset.uri,
    asset.width > asset.height
      ? [{ resize: { width: Math.min(MAX_SIDE, asset.width) } }]
      : [{ resize: { height: Math.min(MAX_SIDE, asset.height) } }],
    { compress: QUALITY, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );

  if (!réduite.base64) return null;
  return { base64: réduite.base64, mime: 'image/jpeg', uri: réduite.uri };
}
