/**
 * SHADOW LOOP — les cinq niveaux de la V1.
 *
 * Un niveau est une grille de caractères. Le moteur la lit une fois et en tire
 * les murs, les objets et les portes ; les changer ici suffit à changer le jeu,
 * sans toucher au code.
 *
 *   #  mur                     P  départ du joueur
 *   .  sol                     E  sortie
 *   K  clé                     L  porte verrouillée (s'ouvre avec la clé)
 *   1  plaque de pression nº1  A  porte pilotée (voir « portes »)
 *   2  plaque de pression nº2  T  porte temporisée
 *   S  interrupteur (ACTION)
 *
 * « portes » relie chaque lettre de porte à sa condition d'ouverture :
 *   { type: 'plaques', plaques: [1, 2] }  ouverte tant que TOUTES sont enfoncées
 *   { type: 'interrupteur', interrupteur: 'S', duree: 1.5 }  ouverte N secondes
 *   { type: 'cle' }                        ouverte définitivement avec la clé
 *
 * « ombresMax » borne le nombre d'ombres présentes : inutile d'encombrer les
 * premiers niveaux, une seule ombre y suffit et deux les rendraient confus.
 */

(function (racineGlobale) {
  'use strict';

  const NIVEAUX_SHADOW_LOOP = [
    {
      numero: 1,
      nom: 'Premiers pas',
      aide: 'Rejoins la sortie verte. Pas d’ombre ici : un seul cycle suffit.',
      dureeCycle: 20,
      cyclesMax: 6,
      ombresMax: 1,
      portes: {},
      grille: [
        '###########',
        '#P........#',
        '#.........#',
        '#.........#',
        '#.........#',
        '#..####...#',
        '#..#......#',
        '#..#.###..#',
        '#..#......#',
        '#..####...#',
        '#.........#',
        '#.........#',
        '#.........#',
        '#........E#',
        '###########',
      ],
    },
    {
      numero: 2,
      nom: 'Le déclic',
      aide:
        'L’interrupteur n’ouvre la porte qu’une seconde et demie — trop court pour y courir. Fais-le presser par ton ombre pendant que tu attends devant la porte.',
      dureeCycle: 18,
      cyclesMax: 6,
      ombresMax: 1,
      portes: { T: { type: 'interrupteur', interrupteur: 'S', duree: 1.5 } },
      grille: [
        '###########',
        '#P.......S#',
        '#.........#',
        '#.........#',
        '#.........#',
        '#.........#',
        '#.........#',
        '#.........#',
        '####T######',
        '#.........#',
        '#.........#',
        '#.........#',
        '#.........#',
        '#........E#',
        '###########',
      ],
    },
    {
      numero: 3,
      nom: 'Le poids du passé',
      aide:
        'La porte reste ouverte tant qu’un poids repose sur la plaque. Ton ombre fera ce poids : va t’y poster, et attends la fin du cycle.',
      dureeCycle: 18,
      cyclesMax: 6,
      ombresMax: 1,
      portes: { A: { type: 'plaques', plaques: [1] } },
      grille: [
        '###########',
        '#P........#',
        '#.........#',
        '#.........#',
        '#....1....#',
        '#.........#',
        '#.........#',
        '#.........#',
        '#A#########',
        '#.........#',
        '#.........#',
        '#.........#',
        '#.........#',
        '#........E#',
        '###########',
      ],
    },
    {
      numero: 4,
      nom: 'La clé',
      aide:
        'La clé dort derrière la porte à plaque. ACTION pour la prendre, ACTION encore devant la porte dorée pour l’ouvrir.',
      dureeCycle: 22,
      cyclesMax: 6,
      ombresMax: 1,
      portes: { A: { type: 'plaques', plaques: [1] }, L: { type: 'cle' } },
      grille: [
        '###########',
        '#P........#',
        '#.........#',
        '#.........#',
        '#....1....#',
        '#.........#',
        '#.........#',
        '#.........#',
        '#A##..#L###',
        '#..#..#...#',
        '#..#..#...#',
        '#K.#..#...#',
        '#..#..#...#',
        '#..#..#..E#',
        '###########',
      ],
    },
    {
      numero: 5,
      nom: 'Deux ombres',
      aide:
        'Cette porte exige les deux plaques enfoncées en même temps. Toi seul ne peux en tenir qu’une : il te faut deux cycles derrière toi.',
      dureeCycle: 20,
      cyclesMax: 8,
      ombresMax: 2,
      portes: { A: { type: 'plaques', plaques: [1, 2] } },
      grille: [
        '###########',
        '#P........#',
        '#.........#',
        '#..1...2..#',
        '#.........#',
        '#.........#',
        '#####A#####',
        '#.........#',
        '#.........#',
        '#.........#',
        '#....E....#',
        '#.........#',
        '#.........#',
        '#.........#',
        '###########',
      ],
    },
  ];

  // Un seul nom exposé : chargé comme script classique dans le navigateur,
  // et comme module ordinaire dans Node pour les vérifications.
  if (typeof module !== 'undefined' && module.exports) module.exports = NIVEAUX_SHADOW_LOOP;
  else racineGlobale.NIVEAUX_SHADOW_LOOP = NIVEAUX_SHADOW_LOOP;
})(typeof globalThis !== 'undefined' ? globalThis : this);
