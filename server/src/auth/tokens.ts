import crypto from 'node:crypto';

/**
 * Jetons des liens envoyés par e-mail — confirmation d'adresse et
 * réinitialisation de mot de passe.
 *
 * Le jeton en clair n'existe que dans le message envoyé : la base n'en garde
 * que l'empreinte. Une fuite de la base ne permet donc ni de confirmer un
 * compte, ni de changer un mot de passe. Même règle que pour les codes à usage
 * unique, et pour la même raison.
 *
 * SHA-256 sans étirement suffit ici, contrairement à un mot de passe : un
 * jeton fait 32 octets tirés au hasard, il n'y a rien à deviner.
 */
export function creerJeton(): { clair: string; empreinte: string } {
  const clair = crypto.randomBytes(32).toString('base64url');
  return { clair, empreinte: empreinteDeJeton(clair) };
}

export function empreinteDeJeton(clair: string): string {
  return crypto.createHash('sha256').update(clair).digest('base64url');
}

/** Durées de vie, choisies courtes : un lien qui traîne est un lien qui fuit. */
export const DUREE_CONFIRMATION_MS = 24 * 60 * 60 * 1000;
export const DUREE_REINITIALISATION_MS = 60 * 60 * 1000;
