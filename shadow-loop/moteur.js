/**
 * SHADOW LOOP — la simulation, sans écran ni navigateur.
 *
 * Tout ce qui décide du jeu est ici : le monde, les collisions, les cycles,
 * l'enregistrement du joueur et le rejeu des ombres. Aucun appel au DOM, ce qui
 * permet de faire tourner une partie entière dans Node pour vérifier que
 * l'ombre reproduit bien ce que le joueur a fait (voir tests/verifier.mjs).
 *
 * LE POINT CRITIQUE : LE DÉTERMINISME
 * -----------------------------------
 * La simulation avance par pas fixes de 1/60 s, jamais au rythme de l'écran.
 * Le tick nº t est donc toujours l'instant t/60 s, sur un téléphone lent comme
 * sur un ordinateur rapide. À chaque tick on note la position exacte du joueur
 * et s'il a appuyé sur ACTION. Au cycle suivant, l'ombre ne « rejoue » pas une
 * intention : on lui réimpose la position enregistrée au même numéro de tick.
 * Il n'y a donc aucune dérive possible — deux secondes d'immobilité restent
 * deux secondes d'immobilité, et une ACTION à 12,4 s retombe à 12,4 s.
 *
 * L'ombre n'a strictement aucune intelligence : elle ne décide rien, ne
 * contourne rien, ne vise rien. Elle relit un tableau.
 */

(function (racineGlobale) {
  'use strict';

  const PAS = 1 / 60; // durée d'un tick de simulation, en secondes
  const VITESSE = 4.6; // tuiles par seconde
  const RAYON = 0.32; // demi-largeur du corps, en tuiles
  const PORTEE_ACTION = 1.15; // distance à laquelle on peut ouvrir une porte
  const MARGE = 0.0005; // pour ne pas rester collé dans un mur à cause des arrondis

  /* ------------------------------------------------------------------ Monde */

  /** Construit le monde à partir de la grille du niveau. Appelé à chaque cycle. */
  function creerMonde(niveau) {
    const lignes = niveau.grille.length;
    const colonnes = niveau.grille[0].length;
    const monde = {
      niveau,
      lignes,
      colonnes,
      mur: new Uint8Array(lignes * colonnes),
      porteEn: new Int16Array(lignes * colonnes).fill(-1),
      plaques: [],
      portes: [],
      interrupteurs: [],
      cle: null,
      depart: { x: 1, y: 1 },
      sortie: { x: 1, y: 1 },
    };

    const definitions = niveau.portes || {};
    for (let y = 0; y < lignes; y += 1) {
      for (let x = 0; x < colonnes; x += 1) {
        const signe = niveau.grille[y][x];
        const index = y * colonnes + x;
        if (signe === '#') {
          monde.mur[index] = 1;
        } else if (signe === 'P') {
          monde.depart = { x, y };
        } else if (signe === 'E') {
          monde.sortie = { x, y };
        } else if (signe === 'K') {
          monde.cle = { x: x + 0.5, y: y + 0.5, portee: false };
        } else if (signe >= '1' && signe <= '9') {
          monde.plaques.push({ id: Number(signe), x, y, active: false });
        } else if (signe === 'S') {
          monde.interrupteurs.push({ id: signe, x, y });
        } else if (definitions[signe]) {
          monde.porteEn[index] = monde.portes.length;
          monde.portes.push({
            id: signe,
            x,
            y,
            type: definitions[signe].type,
            plaques: definitions[signe].plaques || [],
            interrupteur: definitions[signe].interrupteur || null,
            duree: definitions[signe].duree || 0,
            minuteur: 0,
            ouverte: false,
          });
        }
      }
    }
    return monde;
  }

  /** Une case bloque si elle est hors plateau, murée, ou occupée par une porte fermée. */
  function estSolide(monde, tx, ty) {
    if (tx < 0 || ty < 0 || tx >= monde.colonnes || ty >= monde.lignes) return true;
    const index = ty * monde.colonnes + tx;
    if (monde.mur[index] === 1) return true;
    const porte = monde.porteEn[index];
    return porte >= 0 && !monde.portes[porte].ouverte;
  }

  function creerCorps(depart) {
    return { x: depart.x + 0.5, y: depart.y + 0.5, dir: 0, porteCle: false };
  }

  /* ------------------------------------------------------- Déplacement */

  /**
   * Cases que le corps chevauche à l'instant présent.
   *
   * On les épargne lors de la résolution : si une porte se referme sur le joueur,
   * il doit pouvoir en sortir au lieu d'être projeté au hasard ou bloqué à vie.
   */
  function casesOccupees(monde, corps) {
    const cases = new Set();
    const x0 = Math.floor(corps.x - RAYON);
    const x1 = Math.floor(corps.x + RAYON);
    const y0 = Math.floor(corps.y - RAYON);
    const y1 = Math.floor(corps.y + RAYON);
    for (let ty = y0; ty <= y1; ty += 1) {
      for (let tx = x0; tx <= x1; tx += 1) cases.add(ty * monde.colonnes + tx);
    }
    return cases;
  }

  /** Recale le corps sur un seul axe après l'avoir déplacé : simple, et suffisant. */
  function resoudreAxe(monde, corps, axe, delta, epargnees) {
    if (delta === 0) return;
    const x0 = Math.floor(corps.x - RAYON);
    const x1 = Math.floor(corps.x + RAYON);
    const y0 = Math.floor(corps.y - RAYON);
    const y1 = Math.floor(corps.y + RAYON);
    for (let ty = y0; ty <= y1; ty += 1) {
      for (let tx = x0; tx <= x1; tx += 1) {
        if (epargnees.has(ty * monde.colonnes + tx)) continue;
        if (!estSolide(monde, tx, ty)) continue;
        if (axe === 'x') corps.x = delta > 0 ? tx - RAYON - MARGE : tx + 1 + RAYON + MARGE;
        else corps.y = delta > 0 ? ty - RAYON - MARGE : ty + 1 + RAYON + MARGE;
        return; // le corps est plus petit qu'une case : un seul recalage suffit
      }
    }
  }

  /** Déplace un corps d'un tick, axe par axe — la méthode qui glisse le long des murs. */
  function deplacerCorps(monde, corps, vx, vy) {
    const dx = vx * PAS;
    const dy = vy * PAS;
    const epargnees = casesOccupees(monde, corps);
    corps.x += dx;
    resoudreAxe(monde, corps, 'x', dx, epargnees);
    corps.y += dy;
    resoudreAxe(monde, corps, 'y', dy, epargnees);
  }

  function normaliser(dx, dy) {
    const longueur = Math.hypot(dx, dy);
    if (longueur < 0.15) return { x: 0, y: 0 }; // zone morte du joystick
    const facteur = Math.min(longueur, 1) / longueur;
    return { x: dx * facteur, y: dy * facteur };
  }

  /* ----------------------------------------------------------- Actions */

  const surLaCase = (corps, objet) => Math.floor(corps.x) === objet.x && Math.floor(corps.y) === objet.y;
  const distanceCase = (corps, objet) => Math.hypot(corps.x - (objet.x + 0.5), corps.y - (objet.y + 0.5));

  /**
   * Ce que ferait ACTION ici et maintenant, ou null.
   *
   * L'interface s'en sert pour allumer le bouton ACTION : sur un téléphone,
   * deviner quand appuyer est le meilleur moyen d'abandonner un jeu de réflexion.
   */
  function actionPossible(monde, corps) {
    if (monde.interrupteurs.some((inter) => surLaCase(corps, inter))) return 'interrupteur';
    if (corps.porteCle) {
      const verrou = monde.portes.find(
        (porte) => porte.type === 'cle' && !porte.ouverte && distanceCase(corps, porte) <= PORTEE_ACTION
      );
      if (verrou) return 'ouvrir';
    }
    if (!corps.porteCle && monde.cle && !monde.cle.portee && surLaCase(corps, {
      x: Math.floor(monde.cle.x),
      y: Math.floor(monde.cle.y),
    })) {
      return 'prendre';
    }
    if (corps.porteCle) return 'poser';
    return null;
  }

  /**
   * Exécute ACTION. Les ombres passent par exactement la même fonction que le
   * joueur : c'est la garantie qu'un geste rejoué produit le même effet.
   */
  function executerAction(monde, corps) {
    const quoi = actionPossible(monde, corps);
    if (quoi === 'interrupteur') {
      const inter = monde.interrupteurs.find((element) => surLaCase(corps, element));
      for (const porte of monde.portes) {
        if (porte.type === 'interrupteur' && porte.interrupteur === inter.id) porte.minuteur = porte.duree;
      }
      return 'interrupteur';
    }
    if (quoi === 'ouvrir') {
      const verrou = monde.portes.find(
        (porte) => porte.type === 'cle' && !porte.ouverte && distanceCase(corps, porte) <= PORTEE_ACTION
      );
      verrou.ouverte = true; // la clé est consommée : la porte reste ouverte pour ce cycle
      corps.porteCle = false;
      monde.cle = null;
      return 'ouvrir';
    }
    if (quoi === 'prendre') {
      monde.cle.portee = true;
      corps.porteCle = true;
      return 'prendre';
    }
    if (quoi === 'poser') {
      corps.porteCle = false;
      if (monde.cle) {
        monde.cle.portee = false;
        monde.cle.x = Math.floor(corps.x) + 0.5;
        monde.cle.y = Math.floor(corps.y) + 0.5;
      }
      return 'poser';
    }
    return null;
  }

  /** Plaques, minuteries et portes, recalculés à chaque tick. */
  function majMonde(monde, corpsPresents) {
    for (const plaque of monde.plaques) {
      plaque.active = corpsPresents.some((corps) => surLaCase(corps, plaque));
    }
    for (const porte of monde.portes) {
      if (porte.type === 'plaques') {
        porte.ouverte = porte.plaques.every(
          (id) => monde.plaques.find((plaque) => plaque.id === id)?.active
        );
      } else if (porte.type === 'interrupteur') {
        if (porte.minuteur > 0) porte.minuteur = Math.max(0, porte.minuteur - PAS);
        porte.ouverte = porte.minuteur > 0;
      }
      // Les portes à clé gardent l'état que l'action leur a donné.
    }
    if (monde.cle && monde.cle.portee) {
      const porteur = corpsPresents.find((corps) => corps.porteCle);
      if (porteur) {
        monde.cle.x = porteur.x;
        monde.cle.y = porteur.y;
      }
    }
  }

  /* ----------------------------------------------- Enregistrer, rejouer */

  /**
   * La bande enregistrée d'un cycle : une valeur par tick, dans des tableaux
   * typés — 20 secondes de jeu tiennent en une dizaine de kilo-octets.
   *
   * `boutons` conserve l'état brut des commandes (haut/bas/gauche/droite/action)
   * demandé au cahier des charges ; le rejeu, lui, s'appuie sur les positions,
   * seule façon d'être exact au pixel près.
   */
  function creerEnregistrement(ticks) {
    return {
      ticks,
      xs: new Float32Array(ticks),
      ys: new Float32Array(ticks),
      dirs: new Uint8Array(ticks),
      actions: new Uint8Array(ticks),
      boutons: new Uint8Array(ticks),
    };
  }

  function codeBoutons(entree) {
    let code = 0;
    if (entree.dy < -0.15) code |= 1;
    if (entree.dy > 0.15) code |= 2;
    if (entree.dx < -0.15) code |= 4;
    if (entree.dx > 0.15) code |= 8;
    if (entree.action) code |= 16;
    return code;
  }

  const angleVersOctet = (angle) => Math.round(((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2) * 255) & 255;
  const octetVersAngle = (octet) => (octet / 255) * Math.PI * 2;

  /* ------------------------------------------------------------ Partie */

  function creerPartie(niveau) {
    const partie = {
      niveau,
      ticksCycle: Math.round(niveau.dureeCycle / PAS),
      cycle: 1,
      enregistrements: [],
      etat: 'encours', // 'encours' | 'gagne' | 'perdu'
      ticksTotal: 0,
      tick: 0,
      monde: null,
      joueur: null,
      ombres: [],
      enregistrement: null,
    };
    preparerCycle(partie);
    return partie;
  }

  /**
   * Remet le niveau à zéro et réveille les ombres des cycles précédents.
   *
   * Le monde est reconstruit à partir de la grille, jamais rafistolé : une porte
   * restée ouverte ou une clé ramassée au cycle d'avant ne peut pas déteindre sur
   * le suivant, ce qui rendrait le rejeu faux.
   */
  function preparerCycle(partie) {
    partie.monde = creerMonde(partie.niveau);
    partie.joueur = creerCorps(partie.monde.depart);
    const gardees = partie.enregistrements.slice(-(partie.niveau.ombresMax || 1));
    partie.ombres = gardees.map((enregistrement, index) => ({
      enregistrement,
      corps: creerCorps(partie.monde.depart),
      actif: true,
      rang: partie.enregistrements.length - gardees.length + index,
    }));
    partie.enregistrement = creerEnregistrement(partie.ticksCycle);
    partie.tick = 0;
  }

  const aAtteintSortie = (monde, corps) =>
    Math.hypot(corps.x - (monde.sortie.x + 0.5), corps.y - (monde.sortie.y + 0.5)) < 0.45;

  /**
   * Avance la partie d'un tick exactement.
   *
   * Ordre volontaire : les ombres d'abord, le joueur ensuite, le monde après. Il
   * est le même à tous les cycles, donc les mêmes gestes donnent les mêmes
   * effets — c'est ce qui rend les énigmes solubles de façon fiable.
   */
  function avancerPartie(partie, entree) {
    if (partie.etat !== 'encours') return partie.etat;
    const t = partie.tick;
    const monde = partie.monde;

    // 1. Les ombres reprennent la position enregistrée à ce numéro de tick.
    for (const ombre of partie.ombres) {
      const bande = ombre.enregistrement;
      ombre.actif = t < bande.ticks;
      if (!ombre.actif) continue;
      ombre.corps.x = bande.xs[t];
      ombre.corps.y = bande.ys[t];
      ombre.corps.dir = octetVersAngle(bande.dirs[t]);
    }

    // 2. Leurs ACTION retombent au même tick qu'à l'enregistrement.
    for (const ombre of partie.ombres) {
      if (ombre.actif && ombre.enregistrement.actions[t] === 1) executerAction(monde, ombre.corps);
    }

    // 3. Le joueur, lui, est simulé.
    const direction = normaliser(entree.dx, entree.dy);
    deplacerCorps(monde, partie.joueur, direction.x * VITESSE, direction.y * VITESSE);
    if (direction.x !== 0 || direction.y !== 0) {
      partie.joueur.dir = Math.atan2(direction.y, direction.x);
    }
    if (entree.action) executerAction(monde, partie.joueur);

    // 4. Le monde réagit à tout le monde à la fois.
    const presents = [partie.joueur, ...partie.ombres.filter((o) => o.actif).map((o) => o.corps)];
    majMonde(monde, presents);

    // 5. On garde la trace de ce tick — y compris l'appui refusé, pour rester fidèle.
    const bande = partie.enregistrement;
    bande.xs[t] = partie.joueur.x;
    bande.ys[t] = partie.joueur.y;
    bande.dirs[t] = angleVersOctet(partie.joueur.dir);
    bande.actions[t] = entree.action ? 1 : 0;
    bande.boutons[t] = codeBoutons(entree);

    partie.tick = t + 1;
    partie.ticksTotal += 1;

    // 6. Fin du tick : sortie atteinte, ou cycle épuisé.
    if (aAtteintSortie(monde, partie.joueur)) {
      partie.etat = 'gagne';
      return partie.etat;
    }
    if (partie.tick >= partie.ticksCycle) {
      partie.enregistrements.push(partie.enregistrement);
      if (partie.cycle >= partie.niveau.cyclesMax) {
        partie.etat = 'perdu';
        return partie.etat;
      }
      partie.cycle += 1;
      preparerCycle(partie);
    }
    return partie.etat;
  }

  const Moteur = {
    PAS,
    VITESSE,
    RAYON,
    creerMonde,
    creerCorps,
    creerPartie,
    avancerPartie,
    preparerCycle,
    executerAction,
    actionPossible,
    deplacerCorps,
    estSolide,
    normaliser,
    aAtteintSortie,
    octetVersAngle,
  };

  // Un seul nom exposé : chargé comme script classique dans le navigateur,
  // et comme module ordinaire dans Node pour les vérifications.
  if (typeof module !== 'undefined' && module.exports) module.exports = Moteur;
  else racineGlobale.Moteur = Moteur;
})(typeof globalThis !== 'undefined' ? globalThis : this);
