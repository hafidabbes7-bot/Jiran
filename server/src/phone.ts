/**
 * Numéros de téléphone algériens — copie volontairement indépendante de celle
 * de l'application mobile : le serveur ne fait jamais confiance à un numéro
 * déjà « normalisé » par le client, il le renormalise lui-même.
 */

/** Mobiles algériens : Ooredoo (05), Mobilis (06), Djezzy (07). */
const NATIONAL = /^0[567]\d{8}$/;

export function normalizePhone(input: string): string {
  const digitsOnly = input.replace(/[\s.\-()]/g, '');
  if (digitsOnly.startsWith('+213')) return `0${digitsOnly.slice(4)}`;
  if (digitsOnly.startsWith('00213')) return `0${digitsOnly.slice(5)}`;
  if (digitsOnly.startsWith('213') && digitsOnly.length === 12) return `0${digitsOnly.slice(3)}`;
  return digitsOnly;
}

export function isValidAlgerianMobile(input: string): boolean {
  return NATIONAL.test(normalizePhone(input));
}

/** Forme internationale attendue par la plupart des passerelles SMS. */
export function toE164(input: string): string {
  return `+213${normalizePhone(input).slice(1)}`;
}

/** Numéro tronqué pour les journaux : un log ne doit pas contenir le numéro entier. */
export function maskPhone(input: string): string {
  const national = normalizePhone(input);
  if (national.length < 4) return '***';
  return `${national.slice(0, 4)}****${national.slice(-2)}`;
}
