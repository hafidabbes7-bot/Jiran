/**
 * Petites conversions entre ce que renvoie PostgreSQL et ce qu'attend le reste
 * du code.
 *
 * `pg` rend les dates en objets `Date`, les compteurs en `string` — parce
 * qu'un `bigint` ne tient pas toujours dans un nombre — et les booléens en
 * vrais booléens. Le reste de Jiran parle en chaînes ISO et en nombres : ces
 * trois fonctions sont la frontière, et elles sont au même endroit pour qu'on
 * n'aille pas l'oublier quelque part.
 */

export function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? '');
}

export function toIsoOrUndefined(value: unknown): string | undefined {
  return value === null || value === undefined ? undefined : toIso(value);
}

export function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

export function toBool(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 't';
}

/**
 * Vrai si la chaîne a la forme d'un identifiant.
 *
 * PostgreSQL refuse une valeur mal formée sur une colonne `uuid`, et lève une
 * erreur là où l'application veut simplement répondre « introuvable ». Les
 * identifiants viennent de l'extérieur — d'une adresse, d'un corps de requête —
 * donc on les contrôle avant de les passer à la base.
 */
export function estUuid(valeur: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valeur);
}
