import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: crypto.ScryptOptions
) => Promise<Buffer>;

/**
 * Hachage des mots de passe, par scrypt.
 *
 * scrypt plutôt que bcrypt ou argon2 : il est dans Node, donc rien à compiler
 * ni à suivre, et il est coûteux en mémoire — ce qui met en échec une attaque
 * par carte graphique, là où un simple SHA-256, même salé, se casse à des
 * milliards d'essais par seconde.
 *
 * Les paramètres voyagent avec l'empreinte : le jour où on les durcit, les
 * anciens mots de passe continuent de se vérifier avec les leurs.
 */
const N = 16384; // coût en temps et en mémoire — environ 16 Mo par calcul
const r = 8;
const p = 1;
const LONGUEUR = 32;

/** Refuse les mots de passe qu'on devine en une soirée. */
export const LONGUEUR_MINIMALE = 8;
export const LONGUEUR_MAXIMALE = 200;

/**
 * Ce qu'un voisin tape quand il ne réfléchit pas. La liste est courte à
 * dessein : elle attrape les cas évidents sans transformer l'inscription en
 * examen.
 */
const TROP_COURANTS = new Set([
  '12345678', '123456789', '1234567890', 'password', 'motdepasse', 'azertyui',
  'qwertyui', 'iloveyou', 'sunshine', 'princess', 'football', 'jiran123',
  'abcd1234', '00000000', '11111111', 'algerie1', 'bejaia12',
]);

export type RefusMotDePasse = 'trop_court' | 'trop_long' | 'trop_courant';

/** `undefined` si le mot de passe convient. */
export function refuserMotDePasse(motDePasse: string): RefusMotDePasse | undefined {
  if (motDePasse.length < LONGUEUR_MINIMALE) return 'trop_court';
  if (motDePasse.length > LONGUEUR_MAXIMALE) return 'trop_long';
  if (TROP_COURANTS.has(motDePasse.toLowerCase())) return 'trop_courant';
  return undefined;
}

/** Empreinte autonome : `scrypt$N$r$p$sel$clé`, tout en base64url. */
export async function hacherMotDePasse(motDePasse: string): Promise<string> {
  const sel = crypto.randomBytes(16);
  const clé = await scrypt(motDePasse.normalize('NFKC'), sel, LONGUEUR, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${sel.toString('base64url')}$${clé.toString('base64url')}`;
}

/**
 * Compare sans laisser filtrer par le temps de réponse combien de caractères
 * étaient bons.
 */
export async function motDePasseCorrespond(
  motDePasse: string,
  empreinte: string
): Promise<boolean> {
  const parties = empreinte.split('$');
  if (parties.length !== 6 || parties[0] !== 'scrypt') return false;

  const [, nTexte, rTexte, pTexte, selTexte, cléTexte] = parties;
  const nombre = { N: Number(nTexte), r: Number(rTexte), p: Number(pTexte) };
  if (!Number.isFinite(nombre.N) || !Number.isFinite(nombre.r) || !Number.isFinite(nombre.p)) {
    return false;
  }

  const attendue = Buffer.from(cléTexte!, 'base64url');
  const calculée = await scrypt(motDePasse.normalize('NFKC'), Buffer.from(selTexte!, 'base64url'), attendue.length, {
    ...nombre,
    // scrypt refuse de travailler si la mémoire dépasse sa limite par défaut ;
    // on l'accorde à partir des paramètres enregistrés.
    maxmem: 256 * nombre.N * nombre.r * 2,
  });

  return attendue.length === calculée.length && crypto.timingSafeEqual(attendue, calculée);
}
