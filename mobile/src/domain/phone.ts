/**
 * Numéros de téléphone algériens. L'inscription se fait par téléphone
 * uniquement (§4.1), c'est donc le seul identifiant du compte : il doit être
 * normalisé avant d'être stocké ou envoyé au service SMS.
 */

/** Mobiles algériens : Mobilis (06), Djezzy (07), Ooredoo (05). */
const NATIONAL = /^0[567]\d{8}$/;

/** Retire espaces, points et tirets, et ramène +213 / 00213 à la forme 0X. */
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
