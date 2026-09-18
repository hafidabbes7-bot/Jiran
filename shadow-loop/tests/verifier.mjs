#!/usr/bin/env node
/**
 * Vérification de SHADOW LOOP, sans navigateur.
 *
 * Trois questions, auxquelles il vaut mieux répondre par une machine que par
 * une conviction :
 *   1. les cinq niveaux sont-ils bien fichus (départ, sortie, rien de muré) ?
 *   2. l'ombre reproduit-elle vraiment le cycle précédent, au tick près ?
 *   3. chaque niveau se termine-t-il pour de bon ? On le fait jouer.
 *
 * Lancer :  node shadow-loop/tests/verifier.mjs
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const dossier = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const NIVEAUX = require(path.join(dossier, 'niveaux.js'));
const M = require(path.join(dossier, 'moteur.js'));

let echecs = 0;
const ok = (message) => console.log(`  ✓ ${message}`);
const verifier = (condition, message) => {
  if (condition) return ok(message);
  echecs += 1;
  console.log(`  ✗ ${message}`);
};

/* ------------------------------------------------- Déplacement automatique */

/** Chemin de case à case. `portesOuvertes` sert à planifier au travers d'une porte fermée. */
function chemin(monde, depart, but, portesOuvertes = true) {
  const bloque = (x, y) => {
    if (x < 0 || y < 0 || x >= monde.colonnes || y >= monde.lignes) return true;
    const index = y * monde.colonnes + x;
    if (monde.mur[index] === 1) return true;
    if (monde.porteEn[index] >= 0) return !portesOuvertes;
    return false;
  };
  const file = [depart];
  const vus = new Map([[`${depart.x},${depart.y}`, null]]);
  while (file.length) {
    const actuel = file.shift();
    if (actuel.x === but.x && actuel.y === but.y) {
      const route = [];
      let noeud = actuel;
      while (noeud) {
        route.unshift(noeud);
        noeud = vus.get(`${noeud.x},${noeud.y}`);
      }
      return route;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = actuel.x + dx;
      const y = actuel.y + dy;
      if (bloque(x, y) || vus.has(`${x},${y}`)) continue;
      vus.set(`${x},${y}`, actuel);
      file.push({ x, y });
    }
  }
  return null;
}

const arrive = (corps, tuile, marge = 0.14) =>
  Math.hypot(corps.x - (tuile.x + 0.5), corps.y - (tuile.y + 0.5)) < marge;

/**
 * Commande dirigée vers une case.
 *
 * Le pilote ne triche pas : il pousse contre une porte fermée et attend qu'elle
 * s'ouvre, exactement comme un joueur le ferait avec le joystick.
 */
function versCase(partie, but) {
  const corps = partie.joueur;
  const depart = { x: Math.floor(corps.x), y: Math.floor(corps.y) };
  const route = chemin(partie.monde, depart, but);
  const suivante = route && route.length > 1 ? route[1] : but;
  const dx = suivante.x + 0.5 - corps.x;
  const dy = suivante.y + 0.5 - corps.y;
  // Manette poussée à fond : un vecteur qui s'amenuise finirait sous la zone
  // morte du joystick, et le pilote s'arrêterait juste avant sa cible.
  const longueur = Math.hypot(dx, dy) || 1;
  return { dx: dx / longueur, dy: dy / longueur, action: false };
}

const IMMOBILE = { dx: 0, dy: 0, action: false };

/** Fait tourner une partie avec un pilote, et renvoie le résultat. */
function jouer(niveau, pilote, limiteTicks = 60 * 200) {
  const partie = M.creerPartie(niveau);
  const memoire = {};
  let ticks = 0;
  while (partie.etat === 'encours' && ticks < limiteTicks) {
    M.avancerPartie(partie, pilote(partie, memoire) || IMMOBILE);
    ticks += 1;
  }
  return { partie, memoire, ticks };
}

/* ------------------------------------------------ 1. Structure des niveaux */

console.log('\nSTRUCTURE DES NIVEAUX');
for (const niveau of NIVEAUX) {
  const grille = niveau.grille.join('');
  const monde = M.creerMonde(niveau);
  const compte = (lettre) => [...grille].filter((c) => c === lettre).length;

  verifier(
    niveau.grille.every((ligne) => ligne.length === niveau.grille[0].length),
    `Niveau ${niveau.numero} « ${niveau.nom} » : grille rectangulaire`
  );
  verifier(compte('P') === 1 && compte('E') === 1, `Niveau ${niveau.numero} : un départ et une sortie`);

  const toutesOuvertes = chemin(monde, monde.depart, monde.sortie, true);
  verifier(toutesOuvertes !== null, `Niveau ${niveau.numero} : la sortie est atteignable portes ouvertes`);

  const sansPortes = chemin(monde, monde.depart, monde.sortie, false);
  if (niveau.numero === 1) {
    verifier(sansPortes !== null, 'Niveau 1 : se termine sans ombre, comme prévu');
  } else {
    verifier(sansPortes === null, `Niveau ${niveau.numero} : impossible sans ouvrir de porte — l’ombre est indispensable`);
  }

  for (const plaque of monde.plaques) {
    verifier(
      chemin(monde, monde.depart, plaque, false) !== null,
      `Niveau ${niveau.numero} : la plaque ${plaque.id} est accessible dès le premier cycle`
    );
  }
  for (const inter of monde.interrupteurs) {
    verifier(
      chemin(monde, monde.depart, inter, false) !== null,
      `Niveau ${niveau.numero} : l’interrupteur est accessible dès le premier cycle`
    );
  }
  if (monde.cle) {
    const caseCle = { x: Math.floor(monde.cle.x), y: Math.floor(monde.cle.y) };
    verifier(
      chemin(monde, monde.depart, caseCle, false) === null && chemin(monde, monde.depart, caseCle, true) !== null,
      `Niveau ${niveau.numero} : la clé est bien gardée par une porte`
    );
  }
}

/* -------------------------------------- 2. Enregistrement et rejeu fidèle */

console.log('\nENREGISTREMENT ET REJEU');

// Un parcours volontairement irrégulier : virages, arrêts, reprises.
function piloteIrregulier(partie) {
  const t = partie.tick;
  if (t < 90) return { dx: 1, dy: 0, action: false };
  if (t < 210) return IMMOBILE; // deux secondes pile d'immobilité
  if (t < 300) return { dx: 0, dy: 1, action: false };
  if (t < 380) return { dx: -0.7, dy: 0.7, action: false };
  if (t < 460) return { dx: 0, dy: -1, action: false };
  return IMMOBILE;
}

{
  const niveau = NIVEAUX[2];
  const partie = M.creerPartie(niveau);
  while (partie.cycle === 1) M.avancerPartie(partie, piloteIrregulier(partie));

  const bande = partie.enregistrements[0];
  verifier(bande.ticks === niveau.dureeCycle * 60, `Le cycle enregistré fait bien ${bande.ticks} ticks (${niveau.dureeCycle} s)`);

  const immobile = [...Array(120).keys()].every(
    (i) => bande.xs[90 + i] === bande.xs[90] && bande.ys[90 + i] === bande.ys[90]
  );
  verifier(immobile, 'Deux secondes d’immobilité du joueur restent deux secondes d’immobilité sur la bande');

  // Cycle 2 : l'ombre doit repasser exactement par les positions enregistrées.
  let ecartMax = 0;
  let ticksCompares = 0;
  while (partie.cycle === 2 && partie.etat === 'encours') {
    const t = partie.tick;
    M.avancerPartie(partie, IMMOBILE);
    // Au dernier tick le cycle bascule et les ombres repartent du départ :
    // on compare avant, sinon on comparerait une ombre déjà réinitialisée.
    if (partie.cycle !== 2) break;
    const ombre = partie.ombres[0];
    ecartMax = Math.max(ecartMax, Math.abs(ombre.corps.x - bande.xs[t]), Math.abs(ombre.corps.y - bande.ys[t]));
    ticksCompares += 1;
  }
  verifier(ecartMax === 0, `L’ombre repasse par les ${ticksCompares} positions du cycle 1 sans le moindre écart`);
}

{
  // « Si le joueur appuie sur ACTION à 12,4 s, l'ombre appuie à 12,4 s. »
  const niveau = NIVEAUX[1];
  const TICK_ACTION = Math.round(12.4 * 60); // 744
  const partie = M.creerPartie(niveau);
  const interrupteur = partie.monde.interrupteurs[0]; // lu dans la grille, jamais recopié à la main

  while (partie.cycle === 1) {
    const t = partie.tick;
    const surPlace = arrive(partie.joueur, interrupteur);
    const entree = surPlace ? { ...IMMOBILE } : versCase(partie, interrupteur);
    entree.action = t === TICK_ACTION;
    M.avancerPartie(partie, entree);
  }

  const bande = partie.enregistrements[0];
  const appuis = [...bande.actions].reduce((total, valeur, index) => (valeur ? [...total, index] : total), []);
  verifier(
    appuis.length === 1 && appuis[0] === TICK_ACTION,
    `ACTION enregistrée une seule fois, au tick ${TICK_ACTION} (12,400 s)`
  );

  let tickOuverture = null;
  while (partie.cycle === 2 && partie.etat === 'encours') {
    const t = partie.tick;
    M.avancerPartie(partie, IMMOBILE);
    const porte = partie.monde.portes[0];
    if (porte.ouverte && tickOuverture === null) tickOuverture = t;
  }
  verifier(
    tickOuverture === TICK_ACTION,
    `Au cycle suivant, l’ombre rouvre la porte au tick ${TICK_ACTION} — soit ${(TICK_ACTION / 60).toFixed(3)} s`
  );
}

/* ------------------------------------------ 3. Les cinq niveaux se finissent */

console.log('\nLES CINQ NIVEAUX SONT RÉELLEMENT SOLUBLES');

const pilotes = {
  1: (partie) => versCase(partie, partie.monde.sortie),

  2: (partie, memoire) => {
    if (partie.cycle === 1) {
      const inter = partie.monde.interrupteurs[0];
      if (arrive(partie.joueur, inter)) {
        if (!memoire.appuye) {
          memoire.appuye = true;
          return { ...IMMOBILE, action: true };
        }
        return IMMOBILE;
      }
      return versCase(partie, inter);
    }
    return versCase(partie, partie.monde.sortie);
  },

  3: (partie) => {
    if (partie.cycle === 1) {
      const plaque = partie.monde.plaques[0];
      return arrive(partie.joueur, plaque) ? IMMOBILE : versCase(partie, plaque);
    }
    return versCase(partie, partie.monde.sortie);
  },

  4: (partie, memoire) => {
    if (partie.cycle === 1) {
      const plaque = partie.monde.plaques[0];
      return arrive(partie.joueur, plaque) ? IMMOBILE : versCase(partie, plaque);
    }
    // Cycle 2 : l'ombre tient la plaque, on va chercher la clé puis la porte dorée.
    if (!memoire.cleEnMain) {
      const caseCle = { x: 1, y: 11 };
      if (arrive(partie.joueur, caseCle, 0.3)) {
        memoire.cleEnMain = true;
        return { ...IMMOBILE, action: true };
      }
      return versCase(partie, caseCle);
    }
    if (!memoire.porteOuverte) {
      const devantPorte = { x: 7, y: 7 }; // juste au-dessus de la porte dorée
      if (arrive(partie.joueur, devantPorte, 0.3)) {
        memoire.porteOuverte = true;
        return { ...IMMOBILE, action: true };
      }
      return versCase(partie, devantPorte);
    }
    return versCase(partie, partie.monde.sortie);
  },

  5: (partie) => {
    if (partie.cycle <= 2) {
      const plaque = partie.monde.plaques[partie.cycle - 1];
      return arrive(partie.joueur, plaque) ? IMMOBILE : versCase(partie, plaque);
    }
    return versCase(partie, partie.monde.sortie);
  },
};

for (const niveau of NIVEAUX) {
  const { partie } = jouer(niveau, pilotes[niveau.numero]);
  const secondes = (partie.ticksTotal / 60).toFixed(1);
  verifier(
    partie.etat === 'gagne',
    `Niveau ${niveau.numero} « ${niveau.nom} » : terminé en ${partie.cycle} cycle(s), ${secondes} s` +
      (partie.etat === 'gagne' ? '' : ` — ÉCHEC (état : ${partie.etat})`)
  );
}

/* ------------------------------------------------------ 4. Cas limites */

console.log('\nCAS LIMITES');

{
  // Une partie neuve ne doit garder aucune trace de la précédente.
  const premiere = jouer(NIVEAUX[2], pilotes[3]).partie;
  const seconde = M.creerPartie(NIVEAUX[2]);
  verifier(
    seconde.cycle === 1 && seconde.enregistrements.length === 0 && seconde.ombres.length === 0 && seconde.ticksTotal === 0,
    'Une nouvelle partie repart à zéro : cycle 1, aucune ombre, aucun enregistrement'
  );
  verifier(premiere.enregistrements.length > 0, 'La partie précédente avait bien enregistré des cycles');
}

{
  // Le nombre d'ombres suit le cycle, sans jamais dépasser la limite du niveau.
  const niveau = NIVEAUX[4];
  const partie = M.creerPartie(niveau);
  const vus = [];
  while (partie.cycle <= 4 && partie.etat === 'encours') {
    const cycleAvant = partie.cycle;
    M.avancerPartie(partie, IMMOBILE);
    if (partie.cycle !== cycleAvant) vus.push(partie.ombres.length);
  }
  verifier(
    vus.slice(0, 3).join(',') === '1,2,2',
    `Niveau 5 : 1 ombre au cycle 2, 2 au cycle 3, et jamais plus de ${niveau.ombresMax} (relevé : ${vus.slice(0, 3).join(', ')})`
  );
}

{
  // On perd quand les cycles sont épuisés, pas avant.
  const niveau = NIVEAUX[0];
  const partie = M.creerPartie(niveau);
  while (partie.etat === 'encours') M.avancerPartie(partie, IMMOBILE);
  verifier(partie.etat === 'perdu' && partie.cycle === niveau.cyclesMax, `Sans rien faire, la partie est perdue au cycle ${niveau.cyclesMax}`);
}

{
  // Les murs tiennent : on pousse dans un coin pendant 3 secondes.
  const partie = M.creerPartie(NIVEAUX[0]);
  for (let i = 0; i < 180; i += 1) M.avancerPartie(partie, { dx: -1, dy: -1, action: false });
  const dedans = partie.joueur.x > 1 && partie.joueur.y > 1 && partie.joueur.x < 2 && partie.joueur.y < 2;
  verifier(dedans, `Les collisions tiennent : le joueur reste dans le coin (${partie.joueur.x.toFixed(2)} ; ${partie.joueur.y.toFixed(2)})`);
}

console.log(
  echecs === 0 ? '\nTOUT EST VERT — le prototype est cohérent.\n' : `\n${echecs} VÉRIFICATION(S) EN ÉCHEC.\n`
);
process.exit(echecs === 0 ? 0 : 1);
