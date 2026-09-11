import { isValidAlgerianMobile, maskPhone, normalizePhone } from './phone.js';

/**
 * Ce qui identifie un voisin : son numéro de téléphone, ou son adresse e-mail.
 *
 * Le compte appartient à cet identifiant vérifié — c'est lui qui garde
 * l'historique, pas l'appareil. Deux sortes cohabitent parce que l'e-mail est
 * gratuit à envoyer là où le SMS se paie, et qu'un quartier ne se lance pas en
 * attendant un contrat d'agrégateur.
 */
export type IdentifierKind = 'phone' | 'email';

/**
 * Validation d'adresse volontairement large.
 *
 * Un motif strict rejetterait des adresses valides et rares ; de toute façon,
 * la seule preuve qui compte est le code reçu — une adresse inventée ne mène
 * nulle part.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export function isValidEmail(input: string): boolean {
  const value = input.trim();
  return value.length <= 254 && EMAIL.test(value);
}

/** Minuscules et espaces retirés : deux graphies ne doivent pas faire deux comptes. */
export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidIdentifier(input: string, kind: IdentifierKind): boolean {
  return kind === 'email' ? isValidEmail(input) : isValidAlgerianMobile(input);
}

export function normalizeIdentifier(input: string, kind: IdentifierKind): string {
  return kind === 'email' ? normalizeEmail(input) : normalizePhone(input);
}

/** Devine la nature d'un identifiant déjà normalisé — un « @ » ne trompe pas. */
export function kindOf(identifier: string): IdentifierKind {
  return identifier.includes('@') ? 'email' : 'phone';
}

/**
 * Identifiant tronqué pour les journaux : ni un numéro ni une adresse complète
 * n'ont à s'y trouver.
 */
export function maskIdentifier(identifier: string): string {
  if (kindOf(identifier) === 'phone') return maskPhone(identifier);

  const [locale, domaine] = identifier.split('@');
  const visible = (locale ?? '').slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(1, (locale ?? '').length - 2))}@${domaine ?? ''}`;
}
