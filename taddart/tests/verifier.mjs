#!/usr/bin/env node
/**
 * Vérification de TADDART, sans navigateur.
 *
 * Deux exigences, de nature très différente :
 *   1. l'intégrité du corpus historique — c'est la promesse la plus sérieuse
 *      du jeu, et la seule qu'on ne puisse pas rattraper après coup ;
 *   2. la simulation — un village doit pouvoir vivre, grandir sur plusieurs
 *      générations, et les dix missions doivent être réellement atteignables.
 *
 * Lancer :  node taddart/tests/verifier.mjs
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const dossier = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const HISTOIRE = require(path.join(dossier, 'donnees-histoire.js'));
const JEU = require(path.join(dossier, 'donnees-jeu.js'));
const M = require(path.join(dossier, 'moteur.js'));

let echecs = 0;
const verifier = (bon, message) => {
  console.log(`  ${bon ? '✓' : '✗'} ${message}`);
  if (!bon) echecs += 1;
};

/* ============================== 1. Corpus historique ============================== */

console.log('\nINTÉGRITÉ DU CORPUS HISTORIQUE');

const CHAMPS = ['id', 'title', 'date', 'region', 'description', 'status', 'source'];
const fiches = HISTOIRE.HISTORICAL_EVENTS;

verifier(
  fiches.every((f) => CHAMPS.every((c) => f[c])),
  `Les ${fiches.length} fiches portent les sept champs imposés (id, title, date, region, description, status, source)`
);
verifier(fiches.every((f) => f.status === 'HISTORICAL'), 'Toutes portent le statut HISTORICAL, aucune exception');
verifier(new Set(fiches.map((f) => f.id)).size === fiches.length, 'Aucun identifiant en double');
verifier(
  fiches.every((f) => f.source && f.source.nom && f.source.nom.length > 10),
  'Chaque fiche nomme sa source'
);
verifier(
  fiches.filter((f) => f.source.url).every((f) => /^https:\/\//.test(f.source.url)),
  'Les sources en ligne pointent vers une adresse consultable'
);

// Aucune source ne doit s'appuyer sur Wikipédia : la consigne était explicite.
const wiki = fiches.filter((f) => /wikip/i.test(f.source.nom) || /wikip/i.test(f.source.url || ''));
verifier(wiki.length === 0, 'Aucune fiche ne s’appuie sur Wikipédia');

// Institutions réellement présentes dans le corpus.
const institutions = ['unesco', 'bnf.fr', 'openedition', 'hal.science', 'cnrtl'];
const couvertes = institutions.filter((i) => fiches.some((f) => (f.source.url || '').includes(i)));
verifier(
  couvertes.length >= 4,
  `Sources institutionnelles effectivement citées : ${couvertes.join(', ')}`
);

// Pas de guillemets attribués : le jeu ne fait parler personne.
const suspectes = fiches.filter((f) => /[«"]\s*\w[^»"]{15,}[»"]/.test(f.description));
verifier(suspectes.length === 0, 'Aucune citation attribuée à un personnage historique');

const avecPrecaution = fiches.filter((f) => f.precaution).length;
verifier(avecPrecaution >= 6, `${avecPrecaution} fiches signalent explicitement une incertitude ou une limite`);

console.log('\nSÉPARATION HISTOIRE / FICTION');

verifier(JEU.MISSIONS.every((m) => m.statut === 'FICTION'), 'Les 10 missions portent toutes le statut FICTION');
verifier(
  JEU.MISSIONS.every((m) => m.statut !== 'HISTORICAL'),
  'Aucune mission ne se présente comme un fait historique'
);

const mission9 = JEU.MISSIONS.find((m) => m.id === 'annees-difficiles');
verifier(
  mission9 && /SIMULATION/i.test(mission9.note || ''),
  'La mission inspirée de 1844-1857 se déclare explicitement comme une simulation'
);

// Toute fiche promise en récompense doit exister dans le corpus.
const promises = JEU.MISSIONS.flatMap((m) => (m.recompense && m.recompense.museeIds) || []);
const inconnues = promises.filter((id) => !fiches.some((f) => f.id === id));
verifier(inconnues.length === 0, `Les ${promises.length} fiches débloquées par les missions existent toutes${inconnues.length ? ' — manquantes : ' + inconnues.join(', ') : ''}`);

verifier(
  HISTOIRE.NOTE_METHODE.paragraphes.length >= 4 && /tajma/i.test(HISTOIRE.NOTE_METHODE.paragraphes.join(' ')),
  'La note de méthode existe et précise le statut de la mécanique de la tajmaɛt'
);

/* ============================== 2. Règles de construction ============================== */

console.log('\nRÈGLES DE CONSTRUCTION');

{
  const partie = M.creerPartie(7);
  const carte = partie.carte;
  const trouver = (terrain) => {
    for (let y = 0; y < carte.hauteur; y += 1) {
      for (let x = 0; x < carte.largeur; x += 1) {
        if (M.terrainDe(partie, x, y) === terrain && !M.batimentEn(partie, x, y)) return { x, y };
      }
    }
    return null;
  };

  const eau = trouver('eau');
  verifier(eau !== null && M.construire(partie, 'maison', eau.x, eau.y) !== null, 'On ne bâtit pas sur l’eau');
  const montagne = trouver('montagne');
  verifier(
    montagne !== null && M.construire(partie, 'maison', montagne.x, montagne.y) !== null,
    'On ne bâtit pas de maison sur la montagne'
  );

  const loin = trouver('prairie');
  const refusFontaine = M.construire(partie, 'fontaine', loin.x, loin.y);
  verifier(
    typeof refusFontaine === 'string' && /eau/.test(refusFontaine),
    `Une fontaine loin de l’eau est refusée (« ${refusFontaine} »)`
  );

  const bord = (() => {
    for (let y = 0; y < carte.hauteur; y += 1) {
      for (let x = 0; x < carte.largeur; x += 1) {
        const t = M.terrainDe(partie, x, y);
        if (t !== 'prairie' && t !== 'coteau') continue;
        if (M.batimentEn(partie, x, y)) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (M.terrainDe(partie, x + dx, y + dy) === 'eau') return { x, y };
        }
      }
    }
    return null;
  })();
  verifier(bord !== null && M.construire(partie, 'fontaine', bord.x, bord.y) === null, 'Une fontaine au bord de l’eau est acceptée');
  verifier(M.construire(partie, 'tajmaet', loin.x, loin.y) !== null, 'Le village n’a qu’une seule tajmaɛt');

  const avant = partie.ressources.argent;
  const place = trouver('prairie');
  M.construire(partie, 'maison', place.x, place.y);
  verifier(partie.ressources.argent === avant - JEU.BATIMENTS.maison.cout.argent, 'Construire prélève bien le coût sur les réserves');
}

/* ============================== 3. Vie du village ============================== */

console.log('\nVIE DU VILLAGE');

{
  const partie = M.creerPartie(2026);
  verifier(partie.habitantsVivants().length === 18, `Le village démarre à 18 habitants`);
  verifier(partie.compte('maison') === 5, 'Cinq maisons au départ');
  verifier(partie.compte('tajmaet') === 1 && partie.compte('place') === 1, 'Une tajmaɛt et une place au départ');
  verifier(partie.compte('champ') === 2, 'Quelques terres agricoles au départ');
  verifier(partie.ressources.argent === 180 && partie.ressources.animaux === 6, 'Un petit capital et quelques animaux');
  const fondateurs = partie.habitants.slice(0, 5).map((h) => h.prenom).join(', ');
  verifier(fondateurs === 'Ahmed, Yamina, Saïd, Malika, Aksel', `Les cinq fondateurs sont là : ${fondateurs}`);
}

{
  // Sans rien faire, le village doit décliner sans jamais planter.
  const partie = M.creerPartie(11);
  for (let i = 0; i < 200; i += 1) M.avancerSaison(partie);
  verifier(partie.annee === 51, `Cinquante ans passent sans erreur (an ${partie.annee})`);
  verifier(
    partie.chronique.some((c) => c.type === 'naissance') && partie.chronique.some((c) => c.type === 'deces'),
    'La chronique enregistre naissances et décès'
  );
  const nes = partie.habitants.filter((h) => h.generation > 1).length;
  verifier(nes > 0, `${nes} habitants sont nés au village`);
}

{
  // Famine : plus rien à manger, la population souffre mais le jeu tient.
  const partie = M.creerPartie(5);
  partie.ressources.cereales = 0;
  partie.ressources.fruits = 0;
  partie.batiments = partie.batiments.filter((b) => b.type !== 'champ');
  for (let i = 0; i < 12; i += 1) M.avancerSaison(partie);
  verifier(partie.satisfaction < 40, `La disette fait chuter la satisfaction (${Math.round(partie.satisfaction)})`);
  verifier(partie.chronique.some((c) => c.type === 'crise'), 'La disette est inscrite dans la mémoire du village');
  verifier(partie.habitantsVivants().length > 0, 'Le village survit à la boucle sans erreur');
}

/* ============================== 4. Sauvegarde ============================== */

console.log('\nSAUVEGARDE ET REPRISE');

{
  const original = M.creerPartie(99);
  for (let i = 0; i < 24; i += 1) M.avancerSaison(original);
  const texte = M.serialiser(original);
  const repris = M.deserialiser(texte);

  verifier(texte.length > 1000 && texte.startsWith('{'), `La partie se sérialise en JSON (${(texte.length / 1024).toFixed(0)} ko)`);
  verifier(
    repris.annee === original.annee && repris.habitantsVivants().length === original.habitantsVivants().length,
    'La partie reprise a la même année et la même population'
  );

  for (let i = 0; i < 20; i += 1) M.avancerSaison(original);
  for (let i = 0; i < 20; i += 1) M.avancerSaison(repris);
  verifier(
    repris.annee === original.annee &&
      repris.habitantsVivants().length === original.habitantsVivants().length &&
      Math.round(repris.ressources.cereales) === Math.round(original.ressources.cereales),
    'Reprise et partie continue divergent pas d’un cheveu après 20 saisons de plus'
  );
}

/* ============================== 5. Les dix missions ============================== */

console.log('\nLES DIX MISSIONS SONT ATTEIGNABLES');

/** Un joueur automatique très simple : il bâtit ce qui manque, et il tranche. */
function joueurAutomatique(partie) {
  const objectif = [
    ['fontaine', 1], ['champ', 3], ['cabane', 2], ['carriere', 2], ['maison', 7],
    ['oliveraie', 2], ['verger', 2], ['bergerie', 1], ['moulin', 1], ['atelier', 1],
    ['maison', 9], ['marche', 1], ['ecole', 1], ['maison', 12], ['mosquee', 1],
    ['soins', 1], ['bibliotheque', 1], ['verger', 3], ['champ', 4], ['maison', 16],
    ['musee', 1], ['maison', 20], ['atelier', 2], ['marche', 2], ['maison', 26],
  ];

  const essayer = (type) => {
    for (let y = 0; y < partie.carte.hauteur; y += 1) {
      for (let x = 0; x < partie.carte.largeur; x += 1) {
        if (M.peutConstruire(partie, type, x, y) === null) return M.construire(partie, type, x, y) === null;
      }
    }
    return false;
  };

  for (const [type, cible] of objectif) {
    if (partie.compte(type) >= cible) continue;
    // Un chantier réussi par saison : si celui-ci est impossible, on tente le suivant.
    if (essayer(type)) break;
  }

  if (partie.decision) {
    // On prend la première option abordable, en préférant celles qui font du bien.
    const decision = JEU.DECISIONS.find((d) => d.id === partie.decision.id);
    const ordre = decision.options
      .map((option, index) => ({ index, gain: (option.effets && option.effets.satisfaction) || 0 }))
      .sort((a, b) => b.gain - a.gain);
    for (const { index } of ordre) {
      if (M.trancher(partie, index) === null) break;
    }
  }
}

{
  const partie = M.creerPartie(2026);
  const accomplies = [];
  let saisons = 0;
  const LIMITE = 4 * 120; // cent vingt ans de jeu, large

  let pic = 0;
  while (partie.missionCourante < JEU.MISSIONS.length && saisons < LIMITE) {
    const avant = partie.missionCourante;
    joueurAutomatique(partie);
    M.avancerSaison(partie);
    saisons += 1;
    pic = Math.max(pic, partie.habitantsVivants().length);
    if (partie.missionCourante > avant) {
      accomplies.push({ mission: JEU.MISSIONS[avant], annee: partie.annee });
    }
  }

  for (const mission of JEU.MISSIONS) {
    const faite = accomplies.find((a) => a.mission.id === mission.id);
    verifier(Boolean(faite), `Mission ${mission.numero} « ${mission.titre} »${faite ? ` — accomplie en l’an ${faite.annee}` : ' — JAMAIS ACCOMPLIE'}`);
  }

  console.log('');
  verifier(
    partie.missionCourante === JEU.MISSIONS.length,
    `Les dix missions sont bouclées en ${saisons} saisons (${Math.round(saisons / 4)} ans de jeu)`
  );
  verifier(partie.generationMax() >= 3, `Le village atteint la génération ${partie.generationMax()}`);
  verifier(partie.musee.length >= 9, `${partie.musee.length} fiches débloquées au musée`);
  verifier(pic >= 25, `Le village a compté jusqu’à ${pic} habitants (${partie.habitantsVivants().length} à la fin)`);
  verifier(partie.habitantsVivants().length > 0, 'Le village n’a jamais disparu');
  verifier(partie.assemblees >= 2, `${partie.assemblees} assemblées de la tajmaɛt se sont tenues`);

  const memoire = partie.chronique.filter((c) => c.type === 'assemblee');
  verifier(memoire.length > 0, `La mémoire du village garde trace des décisions (ex. « ${memoire[0].texte} », an ${memoire[0].annee})`);
}

console.log(echecs === 0 ? '\nTOUT EST VERT.\n' : `\n${echecs} VÉRIFICATION(S) EN ÉCHEC.\n`);
process.exit(echecs === 0 ? 0 : 1);
