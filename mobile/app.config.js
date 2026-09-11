/**
 * Configuration de l'application.
 *
 * En JavaScript plutôt qu'en JSON pour un seul réglage : autoriser le HTTP en
 * clair. Un APK d'essai est une version « release », et Android y refuse le
 * HTTP non chiffré depuis Android 9 — à juste titre. Mais pour essayer
 * l'application contre un serveur posé sur un ordinateur du réseau local, il
 * n'y a pas de HTTPS.
 *
 * D'où ce drapeau, éteint par défaut : il ne s'allume que si on le demande
 * explicitement, et ne peut donc pas partir dans une version publiée par
 * inadvertance.
 */
const autoriserHttpEnClair = process.env.EXPO_ALLOW_CLEARTEXT === 'true';

const PERMISSION_POSITION =
  "Jiran utilise ta position une seule fois à l'inscription, pour vérifier que " +
  'tu habites bien dans le quartier que tu déclares, et pour joindre ta ' +
  'position à une alerte SOS.';

module.exports = () => ({
  expo: {
    name: 'Jiran',
    slug: 'jiran',
    scheme: 'jiran',
    version: '0.1.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    backgroundColor: '#FBF7EF',

    // Traductions des textes d'autorisation affichés par le système.
    locales: {
      ar: './locales/ar.json',
      fr: './locales/fr.json',
    },

    ios: {
      supportsTablet: false,
      bundleIdentifier: 'dz.jiran.app',
    },

    android: {
      package: 'dz.jiran.app',
      adaptiveIcon: {
        backgroundColor: '#B5502E',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
      predictiveBackGestureEnabled: false,
      // Le jeton de session ne doit pas partir dans une sauvegarde cloud, d'où
      // il pourrait être restauré sur un autre appareil.
      allowBackup: false,
    },

    web: {
      favicon: './assets/favicon.png',
    },

    // Identifiant du projet Expo. `npx eas init` l'affiche : coller la ligne
    // ci-dessous en la décommentant. Il est nécessaire pour compiler dans le
    // nuage et pour les notifications.
    // extra: { eas: { projectId: '00000000-0000-0000-0000-000000000000' } },

    plugins: [
      [
        'expo-location',
        {
          locationWhenInUsePermission: PERMISSION_POSITION,
          // L'application n'a jamais besoin de la position en arrière-plan ni
          // des capteurs de mouvement : ne pas les réclamer.
          locationAlwaysAndWhenInUsePermission: false,
          locationAlwaysPermission: false,
          isIosBackgroundLocationEnabled: false,
          isAndroidBackgroundLocationEnabled: false,
          motionUsagePermission: false,
        },
      ],
      ['expo-notifications', { color: '#C1272D', defaultChannel: 'alertes' }],
      ...(autoriserHttpEnClair ? ['./plugins/http-en-clair'] : []),
    ],
  },
});
