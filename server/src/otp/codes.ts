import crypto from 'node:crypto';

/**
 * Génère un code numérique à usage unique.
 *
 * `crypto.randomInt` plutôt que `Math.random` : un code devinable annule toute
 * la vérification.
 */
export function generateCode(length: number): string {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += String(crypto.randomInt(0, 10));
  }
  return code;
}

/**
 * Empreinte du code. On ne stocke jamais le code en clair : une fuite de la
 * base de défis ne doit pas suffire à valider des numéros.
 *
 * L'identifiant du défi sert de sel, pour que deux défis portant le même code
 * n'aient pas la même empreinte.
 */
export function hashCode(challengeId: string, code: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`${challengeId}:${code}`).digest('hex');
}

/** Comparaison à temps constant, pour ne rien révéler par la durée du calcul. */
export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}
