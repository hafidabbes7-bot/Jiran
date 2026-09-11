/**
 * Mode essai : la porte qui laisse tourner, sur un serveur déclaré en
 * production, des fournisseurs qui n'envoient rien.
 *
 * Elle existe parce que les hébergeurs posent tous `NODE_ENV=production` :
 * sans elle, impossible de faire essayer l'application à des voisins avant
 * d'avoir un contrat d'agrégateur. Elle doit rester explicite — jamais un
 * défaut, jamais la conséquence d'un autre réglage.
 *
 * Ces deux fonctions sont pures pour être vérifiables : un garde-fou qu'on
 * peut franchir par accident n'en est pas un.
 */

/** N'ouvre la porte que sur la valeur exacte `true`. */
export function modeEssaiDemande(brut: string | undefined): boolean {
  return brut === 'true';
}

/**
 * `true` si un fournisseur muet (console) peut être utilisé : hors production,
 * ou en production quand l'essai est assumé.
 */
export function fournisseurMuetAutorise(enProduction: boolean, modeEssai: boolean): boolean {
  return !enProduction || modeEssai;
}
