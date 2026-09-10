import { ALLOWED_WORDS, BANNED_WORDS } from './bannedWords';

/**
 * Filtre de texte appliqué pendant la rédaction d'une publication.
 *
 * Le prototype se contentait d'un `includes` sur une liste figée, ce qui
 * signalait « concert » à cause de « con » et laissait passer « c0n ». Ici on
 * normalise d'abord (accents, chiffres substitués, lettres répétées,
 * séparateurs insérés), puis on compare mot entier par mot entier.
 *
 * Ce filtre reste un premier niveau : il tourne sur l'appareil et se contourne
 * avec assez d'obstination. La modération IA côté serveur demandée en §7.3
 * doit rester la référence, ce filtre n'existe que pour éviter l'insulte
 * évidente sans aller-retour réseau.
 */

/** Substitutions « leet » les plus courantes. */
const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '9': 'g',
  '@': 'a',
  $: 's',
  '!': 'i',
};

/**
 * Ramène un texte à une forme comparable : minuscules, sans accents, sans
 * chiffre substitué à une lettre.
 */
export function normalize(input: string): string {
  const lowered = input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return lowered.replace(/[01345789@$!]/g, (c) => LEET[c] ?? c);
}

/**
 * Ramène toute lettre répétée à une seule. Appliqué des deux côtés de la
 * comparaison : « connnnard » et « connard » donnent tous deux « conard ».
 */
function squeeze(word: string): string {
  return word.replace(/(.)\1+/g, '$1');
}

/** Lettres retenues après normalisation : latin de base et arabe. */
const LETTER = 'a-z\\u0600-\\u06FF';
const SEPARATORS = '[\\s._\\-*]+';

/**
 * Suite de lettres isolées séparées une à une, technique classique de
 * contournement (« c.o.n.n.a.r.d », « c o n n a r d »). On ne recolle que ces
 * suites-là, jamais deux mots normaux qui se suivent.
 */
const SPACED_OUT = new RegExp(
  `(^|[^${LETTER}])([${LETTER}](?:${SEPARATORS}[${LETTER}]){2,})(?![${LETTER}])`,
  'g'
);

/** Découpe en mots, après avoir recollé les suites de lettres isolées. */
function tokenize(normalized: string): string[] {
  const deseparated = normalized.replace(
    SPACED_OUT,
    (_match, before: string, run: string) => before + run.replace(/[\s._\-*]+/g, '')
  );
  return deseparated.split(new RegExp(`[^${LETTER}0-9]+`)).filter(Boolean);
}

export interface TextModerationResult {
  /** `true` si le texte peut être publié en l'état. */
  clean: boolean;
  /** Mots interdits repérés, sous leur forme normalisée. */
  matches: string[];
}

export function moderateText(text: string): TextModerationResult {
  const tokens = tokenize(normalize(text)).map(squeeze);
  const allowed = new Set(ALLOWED_WORDS.map((word) => squeeze(normalize(word))));
  const banned = BANNED_WORDS.map((word) => squeeze(normalize(word)));
  const matches = new Set<string>();

  for (const token of tokens) {
    if (allowed.has(token)) continue;
    for (const word of banned) {
      // Mot entier, ou mot entier suivi d'une marque de pluriel
      // (« connards », « putes ») — jamais une simple sous-chaîne.
      if (token === word || (token.startsWith(word) && token.length - word.length === 1)) {
        matches.add(word);
      }
    }
  }

  return { clean: matches.size === 0, matches: [...matches] };
}
