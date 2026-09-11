import crypto from 'node:crypto';

/**
 * Jeton de session signé, sans base de données : le serveur n'a rien à
 * conserver pour reconnaître un voisin déjà vérifié.
 *
 * Format : `base64url(payload).base64url(signature)`. C'est volontairement plus
 * simple qu'un JWT — un seul algorithme, aucune négociation, donc pas de
 * confusion d'algorithme possible.
 */

interface SessionPayload {
  /** Numéro vérifié, forme nationale. */
  phone: string;
  /** Émission et expiration, en secondes Unix. */
  iat: number;
  exp: number;
}

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

function sign(data: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

export function issueSessionToken(phone: string, secret: string, ttlDays: number): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    phone,
    iat: issuedAt,
    exp: issuedAt + ttlDays * 24 * 3600,
  };
  const body = encode(payload);
  return `${body}.${sign(body, secret)}`;
}

/** Renvoie le numéro vérifié, ou `null` si le jeton est invalide ou périmé. */
export function readSessionToken(token: string, secret: string): string | null {
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expected = sign(body, secret);
  const given = Buffer.from(signature, 'utf8');
  const wanted = Buffer.from(expected, 'utf8');
  if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (typeof payload.phone !== 'string' || typeof payload.exp !== 'number') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.phone;
  } catch {
    return null;
  }
}
