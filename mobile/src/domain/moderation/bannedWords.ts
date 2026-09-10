/**
 * Liste de mots interdits — version de départ, évolutive.
 *
 * Le cahier des charges (§7.3) demande à terme un vrai système : liste
 * évolutive côté serveur + modération IA. Cette liste locale est le premier
 * filet, pas le système complet : elle est là pour arrêter l'insulte évidente
 * au moment de la rédaction, avant même l'envoi.
 *
 * Les entrées sont comparées après normalisation (voir `normalize`), il est
 * donc inutile d'y ajouter les variantes accentuées, en majuscules, espacées
 * ou écrites avec des chiffres.
 */

/** Français et argot courant. */
const FR = [
  'con',
  'connard',
  'connasse',
  'pute',
  'putain',
  'salope',
  'merde',
  'encule',
  'batard',
  'nique',
  'ntm',
  'pd',
  'tapette',
];

/** Anglais, très présent dans les commentaires en ligne. */
const EN = ['fuck', 'fucking', 'shit', 'bitch', 'asshole', 'whore', 'faggot'];

/** Arabe et darija algérienne. */
const AR = [
  'زامل',
  'قحبة',
  'كلب',
  'حمار',
  'خنزير',
  'زبي',
  'طحان',
  'حشاك',
  'nikomok',
  'zamel',
  'gahba',
  'kahba',
  'hmar',
];

export const BANNED_WORDS: readonly string[] = [...FR, ...EN, ...AR];

/**
 * Mots contenant une entrée interdite mais parfaitement légitimes. Le filtre
 * travaille par mot entier, cette liste n'est donc qu'une sécurité
 * supplémentaire pour les cas où la normalisation rapproche deux mots
 * distincts (« con » / « côn »).
 */
export const ALLOWED_WORDS: readonly string[] = [
  'concert',
  'conseil',
  'concierge',
  'construction',
  'contact',
  'content',
  'confiance',
  'connexion',
  'connaissance',
  'controle',
  'convocation',
  'econome',
  'balcon',
  'flacon',
  'batardeau',
  // Après normalisation, ces mots se rapprochent de « con » : on les protège
  // explicitement.
  'cone',
  'cône',
  'conte',
  'connu',
  'connue',
  'conso',
];
