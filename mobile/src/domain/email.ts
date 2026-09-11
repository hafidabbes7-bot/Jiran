/**
 * Adresses e-mail — copie volontairement indépendante de celle du serveur : le
 * serveur ne fait jamais confiance à une adresse déjà validée par le client, et
 * le client doit pouvoir prévenir avant d'envoyer quoi que ce soit.
 *
 * Le motif est large à dessein. Un motif strict rejetterait des adresses
 * valides et rares ; de toute façon, la seule preuve qui compte est le code
 * reçu — une adresse inventée ne mène nulle part.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export function isValidEmail(input: string): boolean {
  const value = input.trim();
  return value.length <= 254 && EMAIL.test(value);
}

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}
