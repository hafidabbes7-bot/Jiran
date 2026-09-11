const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Autorise le HTTP non chiffré dans le paquet Android.
 *
 * Android le refuse depuis Android 9, et c'est une bonne chose : un mot de
 * passe ou un jeton qui circule en clair sur un Wi-Fi partagé se lit. Mais un
 * APK d'essai qui doit joindre un serveur de développement posé sur un
 * ordinateur du réseau local n'a pas de HTTPS à sa disposition.
 *
 * Ce greffon n'est branché que si `EXPO_ALLOW_CLEARTEXT=true` (voir
 * `app.config.js`) : il ne peut pas se retrouver dans une version publiée sans
 * qu'on l'ait voulu.
 */
module.exports = function httpEnClair(config) {
  return withAndroidManifest(config, (resultat) => {
    const application = resultat.modResults.manifest.application?.[0];
    if (application) {
      application.$['android:usesCleartextTraffic'] = 'true';
    }
    return resultat;
  });
};
