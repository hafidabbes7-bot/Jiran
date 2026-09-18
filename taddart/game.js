'use strict';
/**
 * TADDART — interface, carte et sauvegarde.
 *
 * Ce fichier ne décide rien du village : il lit l'état produit par moteur.js,
 * le dessine, et renvoie les gestes du joueur au moteur. Toute la règle du jeu
 * est ailleurs, ce qui permet de la vérifier sans navigateur.
 *
 * Une règle d'affichage traverse tout le fichier : rien ne s'affiche sans son
 * étiquette. Une fiche d'histoire porte HISTORIQUE et sa source ; tout ce qui
 * vient du village porte FICTION DU JEU. Les deux ne se ressemblent pas, même
 * de loin, même en diagonale.
 */

/* global HISTOIRE_TADDART, JEU_TADDART, MOTEUR_TADDART */

(function () {
  'use strict';

  const HISTOIRE = HISTOIRE_TADDART;
  const JEU = JEU_TADDART;
  const M = MOTEUR_TADDART;
  const { BATIMENTS, TERRAINS, RESSOURCES, SAISONS, DECISIONS, MISSIONS, METIERS } = JEU;

  const CLE = 'taddart.v1';
  const CLE_REGLAGES = 'taddart.reglages.v1';
  const DUREE_SAISON = 11000; // millisecondes à la vitesse ×1

  const $ = (s) => document.querySelector(s);
  const echapper = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let partie = null;
  let vitesse = 1;
  let horloge = 0;
  let typeAConstruire = null;
  let caseChoisie = null;
  let reglages = { theme: 'sombre' };

  /* ======================================================= Sauvegarde */

  function lireReglages() {
    try {
      Object.assign(reglages, JSON.parse(localStorage.getItem(CLE_REGLAGES) || '{}'));
    } catch (erreur) {
      /* stockage indisponible : on joue sans mémoire des réglages */
    }
    document.documentElement.dataset.theme = reglages.theme;
  }

  function ecrireReglages() {
    try {
      localStorage.setItem(CLE_REGLAGES, JSON.stringify(reglages));
    } catch (erreur) {
      /* sans effet */
    }
  }

  function sauvegarder() {
    if (!partie) return;
    try {
      localStorage.setItem(CLE, M.serialiser(partie));
    } catch (erreur) {
      /* quota ou navigation privée : la partie continue en mémoire */
    }
  }

  function sauvegardeExiste() {
    try {
      return Boolean(localStorage.getItem(CLE));
    } catch (erreur) {
      return false;
    }
  }

  function charger() {
    try {
      const texte = localStorage.getItem(CLE);
      if (!texte) return null;
      return M.deserialiser(texte);
    } catch (erreur) {
      return null;
    }
  }

  function effacerPartie() {
    try {
      localStorage.removeItem(CLE);
    } catch (erreur) {
      /* sans effet */
    }
    partie = null;
  }

  /* ========================================================== Écrans */

  function montrer(nom) {
    $('#ecran-accueil').hidden = nom !== 'accueil';
    $('#ecran-jeu').hidden = nom !== 'jeu';
    if (nom === 'jeu') redimensionner();
  }

  function ouvrirFeuille(titre, html) {
    $('#feuille-titre').textContent = titre;
    $('#feuille-contenu').innerHTML = html;
    $('#feuille-contenu').scrollTop = 0;
    $('#feuille').hidden = false;
  }

  const fermerFeuille = () => {
    $('#feuille').hidden = true;
  };

  /* ====================================================== Rendu carte */

  const toile = $('#carte');
  const ctx = toile.getContext('2d');
  let vue = { t: 20, ox: 0, oy: 0, largeur: 0, hauteur: 0 };

  /**
   * Mesure la toile elle-même, et rien d'autre.
   *
   * Mesurer le conteneur avant que le HUD ne soit rempli donnait une hauteur
   * trop grande : la carte était dessinée décalée, et chaque toucher tombait
   * sur la mauvaise case. On mesure donc l'élément que l'on vise réellement,
   * juste avant de dessiner comme avant de convertir un toucher.
   */
  function mesurer() {
    const largeur = toile.clientWidth;
    const hauteur = toile.clientHeight;
    if (!largeur || !hauteur) return false;
    if (vue.largeur !== largeur || vue.hauteur !== hauteur) {
      const densite = Math.min(window.devicePixelRatio || 1, 2);
      toile.width = Math.round(largeur * densite);
      toile.height = Math.round(hauteur * densite);
      ctx.setTransform(densite, 0, 0, densite, 0, 0);
      vue.largeur = largeur;
      vue.hauteur = hauteur;
    }
    return true;
  }

  function redimensionner() {
    if (mesurer() && partie) dessiner();
  }

  window.addEventListener('resize', redimensionner);
  window.addEventListener('orientationchange', () => setTimeout(redimensionner, 150));
  // Le HUD grandit quand il se remplit : la toile change de taille sans que la
  // fenêtre bouge. Seul un observateur le voit.
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(redimensionner).observe(toile);
  }

  /** Voile coloré de la saison : le même village ne se regarde pas pareil en juillet. */
  const VOILE_SAISON = {
    printemps: null,
    été: 'rgba(224, 178, 74, 0.13)',
    automne: 'rgba(183, 96, 48, 0.14)',
    hiver: 'rgba(150, 175, 200, 0.16)',
  };

  function rect(x, y, l, h, couleur) {
    ctx.fillStyle = couleur;
    ctx.fillRect(x, y, l, h);
  }

  function dessinerTerrain(tx, ty, terrain) {
    const t = vue.t;
    const x = vue.ox + tx * t;
    const y = vue.oy + ty * t;
    rect(x, y, t, t, TERRAINS[terrain].couleur);

    ctx.save();
    ctx.globalAlpha = 0.28;
    if (terrain === 'montagne') {
      ctx.fillStyle = '#424653';
      ctx.beginPath();
      ctx.moveTo(x + t * 0.5, y + t * 0.15);
      ctx.lineTo(x + t * 0.9, y + t * 0.85);
      ctx.lineTo(x + t * 0.1, y + t * 0.85);
      ctx.closePath();
      ctx.fill();
    } else if (terrain === 'foret') {
      ctx.fillStyle = '#1e4226';
      for (const [dx, dy, r] of [[0.3, 0.35, 0.16], [0.68, 0.5, 0.18], [0.45, 0.72, 0.15]]) {
        ctx.beginPath();
        ctx.arc(x + t * dx, y + t * dy, t * r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (terrain === 'coteau') {
      // Les banquettes de culture : la montagne kabyle est terrassée.
      ctx.strokeStyle = '#5e5c31';
      ctx.lineWidth = 1;
      for (let i = 1; i < 3; i += 1) {
        ctx.beginPath();
        ctx.moveTo(x + 1, y + (t * i) / 3);
        ctx.lineTo(x + t - 1, y + (t * i) / 3);
        ctx.stroke();
      }
    } else if (terrain === 'rocher') {
      ctx.fillStyle = '#5f5b50';
      ctx.fillRect(x + t * 0.2, y + t * 0.22, t * 0.2, t * 0.16);
      ctx.fillRect(x + t * 0.58, y + t * 0.55, t * 0.24, t * 0.18);
    } else if (terrain === 'eau') {
      ctx.strokeStyle = '#8fc6dd';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x + t * 0.18, y + t * 0.4);
      ctx.lineTo(x + t * 0.82, y + t * 0.6);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Les bâtiments, en formes simples.
   *
   * On cherche les signes de l'habitat kabyle : corps bas en pierre, toiture de
   * tuiles à faible pente, maisons serrées, minaret à base carrée. C'est un
   * schéma lisible à vingt pixels, pas une reconstitution d'architecture.
   */
  function dessinerBatiment(batiment) {
    const t = vue.t;
    const x = vue.ox + batiment.x * t;
    const y = vue.oy + batiment.y * t;
    const type = batiment.type;
    const PIERRE = '#bfae92';
    const TUILE = '#b9662f';
    const BOIS = '#7a5533';

    // Socle d'assise : sans lui, une oliveraie posée sur de la forêt ou une
    // cabane en lisière se confondent avec le décor, et le joueur ne voit plus
    // ce qu'il a bâti.
    ctx.fillStyle = 'rgba(28, 22, 16, 0.42)';
    ctx.fillRect(x + 1, y + 1, t - 2, t - 2);

    const corps = (x0, y0, l, h, couleur = PIERRE) => rect(x + t * x0, y + t * y0, t * l, t * h, couleur);
    const toiture = (x0, x1, yBas, yHaut, couleur = TUILE) => {
      ctx.fillStyle = couleur;
      ctx.beginPath();
      ctx.moveTo(x + t * x0, y + t * yBas);
      ctx.lineTo(x + t * x1, y + t * yBas);
      ctx.lineTo(x + t * (x1 - 0.1), y + t * yHaut);
      ctx.lineTo(x + t * (x0 + 0.1), y + t * yHaut);
      ctx.closePath();
      ctx.fill();
    };
    const bosquet = (couleur, points) => {
      ctx.fillStyle = couleur;
      for (const [dx, dy, r] of points) {
        ctx.beginPath();
        ctx.arc(x + t * dx, y + t * dy, t * r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    if (type === 'maison') {
      corps(0.22, 0.48, 0.56, 0.34);
      toiture(0.14, 0.86, 0.5, 0.26);
      rect(x + t * 0.45, y + t * 0.66, t * 0.12, t * 0.16, '#5b4630');
    } else if (type === 'tajmaet') {
      corps(0.1, 0.42, 0.8, 0.44, '#cbbb9d');
      toiture(0.04, 0.96, 0.44, 0.2);
      // L'arcade ouverte sur la place.
      ctx.fillStyle = '#4a3a27';
      for (const dx of [0.22, 0.44, 0.66]) {
        ctx.beginPath();
        ctx.arc(x + t * (dx + 0.06), y + t * 0.74, t * 0.08, Math.PI, 0);
        ctx.fill();
      }
    } else if (type === 'place') {
      ctx.fillStyle = '#a89878';
      ctx.beginPath();
      ctx.arc(x + t * 0.5, y + t * 0.5, t * 0.42, 0, Math.PI * 2);
      ctx.fill();
      bosquet('#4f6b35', [[0.5, 0.42, 0.16]]);
      rect(x + t * 0.47, y + t * 0.5, t * 0.06, t * 0.2, BOIS);
    } else if (type === 'fontaine') {
      corps(0.24, 0.3, 0.52, 0.3, '#cbbb9d');
      ctx.fillStyle = '#2d6f8f';
      ctx.fillRect(x + t * 0.2, y + t * 0.62, t * 0.6, t * 0.2);
      ctx.fillStyle = '#8fc6dd';
      ctx.fillRect(x + t * 0.46, y + t * 0.42, t * 0.08, t * 0.22);
    } else if (type === 'champ') {
      const saison = SAISONS[partie.saison];
      const couleur = saison === 'été' ? '#d8b24a' : saison === 'automne' ? '#a98548' : saison === 'hiver' ? '#79764c' : '#8fa348';
      rect(x + t * 0.08, y + t * 0.12, t * 0.84, t * 0.76, couleur);
      ctx.strokeStyle = 'rgba(70,60,30,0.45)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i += 1) {
        ctx.beginPath();
        ctx.moveTo(x + t * 0.1, y + t * (0.12 + (i * 0.76) / 4));
        ctx.lineTo(x + t * 0.9, y + t * (0.12 + (i * 0.76) / 4));
        ctx.stroke();
      }
    } else if (type === 'oliveraie') {
      bosquet('#5c6b42', [[0.3, 0.38, 0.17], [0.68, 0.36, 0.15], [0.48, 0.68, 0.18]]);
    } else if (type === 'verger') {
      bosquet('#6f8f3f', [[0.32, 0.4, 0.17], [0.66, 0.62, 0.17]]);
    } else if (type === 'bergerie') {
      corps(0.16, 0.5, 0.68, 0.3, '#b0a189');
      toiture(0.1, 0.9, 0.52, 0.34, '#8a6a45');
      bosquet('#efe7d6', [[0.3, 0.86, 0.06], [0.52, 0.88, 0.06], [0.72, 0.85, 0.06]]);
    } else if (type === 'cabane') {
      toiture(0.18, 0.82, 0.8, 0.34, '#6e4e2e');
      rect(x + t * 0.44, y + t * 0.62, t * 0.12, t * 0.18, '#3f2c19');
    } else if (type === 'carriere') {
      ctx.fillStyle = '#9a9384';
      for (const [dx, dy, s] of [[0.24, 0.3, 0.22], [0.58, 0.46, 0.26], [0.34, 0.66, 0.2]]) {
        ctx.fillRect(x + t * dx, y + t * dy, t * s, t * s * 0.8);
      }
    } else if (type === 'moulin') {
      corps(0.18, 0.44, 0.64, 0.4);
      toiture(0.12, 0.88, 0.46, 0.22);
      ctx.strokeStyle = '#59493a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + t * 0.5, y + t * 0.66, t * 0.13, 0, Math.PI * 2);
      ctx.stroke();
    } else if (type === 'atelier') {
      corps(0.18, 0.44, 0.64, 0.4);
      toiture(0.12, 0.88, 0.46, 0.22);
      ctx.fillStyle = '#a8542c';
      ctx.beginPath();
      ctx.arc(x + t * 0.5, y + t * 0.68, t * 0.11, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'marche') {
      for (let i = 0; i < 3; i += 1) {
        rect(x + t * (0.12 + i * 0.27), y + t * 0.36, t * 0.22, t * 0.12, i % 2 ? '#c8763c' : '#d9c9a8');
        rect(x + t * (0.2 + i * 0.27), y + t * 0.48, t * 0.05, t * 0.3, BOIS);
      }
    } else if (type === 'ecole') {
      corps(0.12, 0.42, 0.76, 0.44, '#cbbb9d');
      toiture(0.06, 0.94, 0.44, 0.24);
      ctx.fillStyle = '#4a3a27';
      for (const dx of [0.24, 0.46, 0.68]) ctx.fillRect(x + t * dx, y + t * 0.58, t * 0.1, t * 0.12);
    } else if (type === 'soins') {
      corps(0.16, 0.42, 0.68, 0.44, '#d8d0bc');
      toiture(0.1, 0.9, 0.44, 0.24, '#9a7b52');
      rect(x + t * 0.44, y + t * 0.56, t * 0.12, t * 0.26, '#6f8f3f');
      rect(x + t * 0.36, y + t * 0.64, t * 0.28, t * 0.1, '#6f8f3f');
    } else if (type === 'mosquee') {
      corps(0.2, 0.5, 0.6, 0.36, '#d8d0bc');
      toiture(0.14, 0.86, 0.52, 0.34, '#a8865a');
      // Minaret à base carrée, comme au Maghreb.
      rect(x + t * 0.66, y + t * 0.16, t * 0.16, t * 0.44, '#d8d0bc');
      rect(x + t * 0.64, y + t * 0.12, t * 0.2, t * 0.06, '#a8865a');
    } else if (type === 'bibliotheque') {
      corps(0.14, 0.4, 0.72, 0.46, '#c9b898');
      toiture(0.08, 0.92, 0.42, 0.22);
      rect(x + t * 0.3, y + t * 0.56, t * 0.4, t * 0.08, '#6b5334');
      rect(x + t * 0.3, y + t * 0.68, t * 0.4, t * 0.08, '#6b5334');
    } else if (type === 'musee') {
      corps(0.1, 0.4, 0.8, 0.48, '#ddd3bb');
      toiture(0.04, 0.96, 0.42, 0.2, '#b9662f');
      ctx.fillStyle = '#8d7d62';
      for (const dx of [0.2, 0.38, 0.56, 0.74]) ctx.fillRect(x + t * dx, y + t * 0.54, t * 0.06, t * 0.3);
    } else if (type === 'chemin') {
      rect(x + t * 0.2, y, t * 0.6, t, '#a3906f');
    }

    // Un bâtiment à court de bras ne produit pas : il faut le voir.
    const modele = BATIMENTS[type];
    if (modele.emplois && batiment.travailleurs.length < modele.emplois) {
      ctx.fillStyle = batiment.travailleurs.length === 0 ? '#cf5c46' : '#d9a441';
      ctx.beginPath();
      ctx.arc(x + t * 0.86, y + t * 0.14, t * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function dessiner() {
    if (!partie || !mesurer()) return;
    const carte = partie.carte;
    vue.t = Math.floor(Math.min(vue.largeur / carte.largeur, vue.hauteur / carte.hauteur));
    vue.ox = Math.round((vue.largeur - vue.t * carte.largeur) / 2);
    vue.oy = Math.round((vue.hauteur - vue.t * carte.hauteur) / 2);

    ctx.clearRect(0, 0, vue.largeur, vue.hauteur);
    for (let y = 0; y < carte.hauteur; y += 1) {
      for (let x = 0; x < carte.largeur; x += 1) dessinerTerrain(x, y, M.terrainDe(partie, x, y));
    }
    for (const batiment of partie.batiments) dessinerBatiment(batiment);

    const voile = VOILE_SAISON[SAISONS[partie.saison]];
    if (voile) {
      ctx.fillStyle = voile;
      ctx.fillRect(vue.ox, vue.oy, vue.t * carte.largeur, vue.t * carte.hauteur);
    }

    // En mode construction, on éclaire les cases où l'on peut réellement poser.
    if (typeAConstruire) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      for (let y = 0; y < carte.hauteur; y += 1) {
        for (let x = 0; x < carte.largeur; x += 1) {
          if (M.peutConstruire(partie, typeAConstruire, x, y) !== null) continue;
          ctx.strokeStyle = '#d9a441';
          ctx.lineWidth = 2;
          ctx.strokeRect(vue.ox + x * vue.t + 1, vue.oy + y * vue.t + 1, vue.t - 2, vue.t - 2);
        }
      }
      ctx.restore();
    }

    if (caseChoisie) {
      ctx.strokeStyle = '#f0e6d8';
      ctx.lineWidth = 2;
      ctx.strokeRect(vue.ox + caseChoisie.x * vue.t, vue.oy + caseChoisie.y * vue.t, vue.t, vue.t);
    }
  }

  /* ================================================ Toucher la carte */

  toile.addEventListener('click', (evenement) => {
    if (!partie || !mesurer()) return;
    dessiner(); // la vue est recalculée là : le toucher vise ce qui est à l'écran
    const boite = toile.getBoundingClientRect();
    const x = Math.floor((evenement.clientX - boite.left - vue.ox) / vue.t);
    const y = Math.floor((evenement.clientY - boite.top - vue.oy) / vue.t);
    if (x < 0 || y < 0 || x >= partie.carte.largeur || y >= partie.carte.hauteur) return;

    if (typeAConstruire) {
      const refus = M.construire(partie, typeAConstruire, x, y);
      if (refus) {
        $('#info-case').textContent = `Impossible ici : ${refus}.`;
      } else {
        $('#info-case').textContent = `${BATIMENTS[typeAConstruire].nom} construite.`;
        typeAConstruire = null;
        $('#bandeau-construction').hidden = true;
        sauvegarder();
      }
      majInterface();
      return;
    }

    caseChoisie = { x, y };
    decrireCase(x, y);
    dessiner();
  });

  function decrireCase(x, y) {
    const terrain = M.terrainDe(partie, x, y);
    const batiment = M.batimentEn(partie, x, y);
    if (!batiment) {
      $('#info-case').textContent = `${TERRAINS[terrain].nom}${TERRAINS[terrain].bati ? '' : ' — on n’y bâtit pas'}.`;
      return;
    }
    const modele = BATIMENTS[batiment.type];
    const bras = modele.emplois
      ? ` ${batiment.travailleurs.length} sur ${modele.emplois} postes tenus.`
      : '';
    const memoire = batiment.generationDe
      ? ` Bâtie en l’an ${batiment.annee}, sous la génération de ${batiment.generationDe}.`
      : ` Bâtie en l’an ${batiment.annee}.`;
    $('#info-case').textContent = `${modele.nom}.${memoire}${bras}`;
  }

  /* ==================================================== HUD et temps */

  function majHud() {
    if (!partie) return;
    const vivants = partie.habitantsVivants();
    const nourriture = partie.ressources.cereales + partie.ressources.fruits;
    const stats = [
      ['POPULATION', vivants.length, false],
      ['ARGENT', Math.round(partie.ressources.argent), false],
      ['EAU', Math.round(partie.ressources.eau), partie.ressources.eau < vivants.length * 2],
      ['NOURRITURE', Math.round(nourriture), nourriture < vivants.length * 2],
      ['ANNÉE', partie.annee, false],
      ['SATISFACTION', Math.round(partie.satisfaction), partie.satisfaction < 35],
    ];
    $('#hud').innerHTML = stats
      .map(([nom, valeur, manque]) => `<div class="stat${manque ? ' manque' : ''}"><small>${nom}</small><b>${valeur}</b></div>`)
      .join('');

    $('#saison-texte').textContent = `An ${partie.annee} — ${SAISONS[partie.saison]}`;
    $('#jauge-saison').style.transform = `scaleX(${(horloge / (DUREE_SAISON / Math.max(vitesse, 1))).toFixed(3)})`;
    $('#btn-vitesse').textContent = vitesse === 0 ? '❚❚ pause' : `▶ ×${vitesse}`;

    const ongletTajmaet = document.querySelector('[data-panneau="tajmaet"]');
    ongletTajmaet.classList.toggle('alerte', Boolean(partie.decision));
  }

  function majInterface() {
    majHud();
    dessiner();
    if (caseChoisie) decrireCase(caseChoisie.x, caseChoisie.y);
  }

  let dernier = 0;
  function boucle(instant) {
    requestAnimationFrame(boucle);
    const delta = Math.min(instant - dernier, 400);
    dernier = instant;
    if (!partie || $('#ecran-jeu').hidden || vitesse === 0) return;

    horloge += delta;
    const duree = DUREE_SAISON / vitesse;
    if (horloge >= duree) {
      horloge = 0;
      const rapport = M.avancerSaison(partie);
      sauvegarder();
      if (rapport.evenements.length) {
        $('#info-case').textContent = rapport.evenements.slice(0, 2).join(' ');
      }
      majInterface();
      if ($('#feuille').hidden === false) rafraichirFeuille();
    }
    majHud();
  }

  /* ======================================================= Panneaux */

  let panneauCourant = null;

  const badge = (statut) =>
    statut === 'HISTORICAL'
      ? '<span class="badge historique">HISTORIQUE</span>'
      : '<span class="badge fiction">FICTION DU JEU</span>';

  function ficheHistorique(fiche) {
    const lien = fiche.source.url
      ? `<a href="${echapper(fiche.source.url)}" target="_blank" rel="noopener">${echapper(fiche.source.url)}</a>`
      : '';
    return `
      <article class="carte-item">
        <h3>${badge('HISTORICAL')}${echapper(fiche.title)}</h3>
        <div class="meta">${echapper(fiche.date)} · ${echapper(fiche.region)}</div>
        <p>${echapper(fiche.description)}</p>
        ${fiche.precaution ? `<div class="precaution">${echapper(fiche.precaution)}</div>` : ''}
        <div class="source">Source : ${echapper(fiche.source.nom)}${lien ? `<br />${lien}` : ''}</div>
      </article>`;
  }

  function panneauConstruire() {
    if (!partie) return '<p class="vide">Commencez une partie pour bâtir.</p>';
    const items = Object.entries(BATIMENTS)
      .filter(([cle, modele]) => !(modele.unique && partie.compte(cle) > 0))
      .map(([cle, modele]) => {
        const prix = Object.entries(modele.cout)
          .map(([r, q]) => `${q} ${r}`)
          .join(' · ');
        const abordable = Object.entries(modele.cout).every(([r, q]) => partie.ressources[r] >= q);
        const emplois = modele.emplois ? `${modele.emplois} poste(s)` : 'aucun poste';
        return `
          <button class="bouton-item" data-batir="${cle}" ${abordable ? '' : 'disabled'}>
            <span class="titre"><b>${echapper(modele.nom)}</b><small>${echapper(modele.description)}<br />${emplois}${modele.entretien ? ` · entretien ${modele.entretien}/saison` : ''}</small></span>
            <span class="prix">${echapper(prix)}</span>
          </button>`;
      })
      .join('');
    return `<p class="meta" style="margin-bottom:10px">Choisissez un bâtiment, puis touchez une case en surbrillance.</p>${items}`;
  }

  function panneauVillage() {
    if (!partie) return '<p class="vide">Aucune partie en cours.</p>';
    const mission = MISSIONS[partie.missionCourante];
    let html = '';

    if (mission) {
      const objectifs = mission.objectifs
        .map((objectif) => {
          const valeur = objectif.valeur(partie);
          const fait = valeur >= objectif.cible;
          const part = Math.min(1, valeur / objectif.cible);
          return `
            <div><span class="${fait ? 'fait' : ''}">${fait ? '✓ ' : ''}${echapper(objectif.texte)}</span><span>${Math.floor(valeur)} / ${objectif.cible}</span></div>
            <div class="barre-fond"><i style="width:${(part * 100).toFixed(0)}%"></i></div>`;
        })
        .join('');
      html += `
        <article class="carte-item">
          <h3>${badge('FICTION')}Mission ${mission.numero} — ${echapper(mission.titre)}</h3>
          <p>${echapper(mission.resume)}</p>
          ${mission.note ? `<div class="precaution">${echapper(mission.note)}</div>` : ''}
          <div class="progression">${objectifs}</div>
        </article>`;
    } else {
      html += `<article class="carte-item"><h3>${badge('FICTION')}Les dix missions sont accomplies</h3><p>Le village continue de vivre : faites-le durer, et regardez les générations passer.</p></article>`;
    }

    html += '<div class="ressources-liste">';
    for (const ressource of RESSOURCES) {
      html += `<div><span>${ressource.icone} ${echapper(ressource.nom)}</span><b>${Math.round(partie.ressources[ressource.id])}</b></div>`;
    }
    html += '</div>';

    const chronique = partie.chronique.slice(-40).reverse();
    html += `<h3 style="font-size:14px;margin:6px 0 8px">Mémoire du village</h3>`;
    html += chronique.length
      ? `<ul class="chronique">${chronique
          .map((c) => `<li><span class="an">An ${c.annee}</span>${echapper(c.texte)}</li>`)
          .join('')}</ul>`
      : '<p class="vide">Le village n’a pas encore d’histoire.</p>';
    return html;
  }

  function panneauTajmaet() {
    if (!partie) return '<p class="vide">Aucune partie en cours.</p>';
    const entete = `
      <div class="note-encadree">
        <h3>Une mécanique inspirée, pas une reconstitution</h3>
        <p>Ce système de décision s’inspire de l’organisation communautaire villageoise kabyle telle que la décrivent les travaux de recherche. Ce n’est pas une reproduction des règles historiques : les pratiques variaient d’un village à l’autre et selon les époques.</p>
        <p>La fiche HISTORIQUE « La tajmaɛt, assemblée du village » est consultable dans l’écran Histoire.</p>
      </div>`;

    if (!partie.decision) {
      return `${entete}<p class="vide">Aucune assemblée en cours.<br />La prochaine se tiendra à la fin de l’année.</p>`;
    }

    const decision = DECISIONS.find((d) => d.id === partie.decision.id);
    const options = decision.options
      .map((option, index) => {
        const prix = Object.entries(option.cout || {})
          .map(([r, q]) => `${q} ${r}`)
          .join(' · ');
        const abordable = Object.entries(option.cout || {}).every(([r, q]) => partie.ressources[r] >= q);
        return `
          <button class="bouton-item" data-trancher="${index}" ${abordable ? '' : 'disabled'}>
            <span class="titre"><b>${echapper(option.texte)}</b><small>${prix ? `Coût : ${echapper(prix)}` : 'Sans coût'}</small></span>
          </button>`;
      })
      .join('');

    return `${entete}
      <article class="carte-item">
        <h3>${badge('FICTION')}${echapper(decision.titre)}</h3>
        <p>${echapper(decision.contexte)}</p>
      </article>${options}`;
  }

  function panneauHistoire() {
    const note = HISTOIRE.NOTE_METHODE;
    const entete = `
      <div class="note-encadree">
        <h3>${echapper(note.titre)}</h3>
        ${note.paragraphes.map((p) => `<p>${echapper(p)}</p>`).join('')}
      </div>`;
    return entete + HISTOIRE.HISTORICAL_EVENTS.map(ficheHistorique).join('');
  }

  /** Fiches FICTION tirées du village lui-même : sa propre mémoire. */
  function fichesDuVillage() {
    if (!partie) return [];
    const fiches = [];
    const doyen = partie.habitants.filter((h) => h.vivant).sort((a, b) => b.age - a.age)[0];
    const plusAncien = partie.batiments.slice().sort((a, b) => a.annee - b.annee)[0];

    fiches.push({
      titre: `Taddart, an ${partie.annee}`,
      categorie: 'lieu',
      texte: `Village fictif de ${partie.habitantsVivants().length} habitants, ${partie.compte('maison')} maisons, fondé il y a ${partie.annee - 1} ans. Il ne correspond à aucun village réel.`,
    });
    if (plusAncien) {
      fiches.push({
        titre: `Le plus ancien bâtiment : ${BATIMENTS[plusAncien.type].nom}`,
        categorie: 'architecture',
        texte: `Bâti en l’an ${plusAncien.annee}${plusAncien.generationDe ? `, sous la génération de ${plusAncien.generationDe}` : ''}.`,
      });
    }
    if (doyen) {
      fiches.push({
        titre: `Le doyen : ${doyen.prenom} (${doyen.famille})`,
        categorie: 'personnage',
        texte: `${doyen.age} ans, ${METIERS[doyen.metier] ? METIERS[doyen.metier].nom.toLowerCase() : doyen.metier}. Génération ${doyen.generation}. Personnage fictif.`,
      });
    }
    for (const entree of partie.chronique.filter((c) => c.type === 'assemblee').slice(-3)) {
      fiches.push({ titre: `Décision de l’an ${entree.annee}`, categorie: 'document', texte: entree.texte });
    }
    return fiches;
  }

  function panneauMusee() {
    const debloquees = partie ? partie.musee : [];
    const fiches = HISTOIRE.HISTORICAL_EVENTS.filter((f) => debloquees.includes(f.id));
    const manquantes = HISTOIRE.HISTORICAL_EVENTS.length - fiches.length;

    let html = `
      <div class="note-encadree">
        <h3>Deux collections, jamais mélangées</h3>
        <p>Les pièces HISTORIQUE se débloquent en accomplissant les missions ; chacune porte sa source. Les pièces FICTION DU JEU viennent de votre village et n’ont aucune valeur historique.</p>
      </div>`;

    html += `<h3 style="font-size:14px;margin:4px 0 8px">Collection historique — ${fiches.length} sur ${HISTOIRE.HISTORICAL_EVENTS.length}</h3>`;
    html += fiches.length
      ? fiches.map(ficheHistorique).join('')
      : `<p class="vide">Rien encore. Avancez dans les missions : la mission 8 ouvre le chapitre de Béjaïa.</p>`;
    if (manquantes > 0) {
      html += `<p class="meta" style="margin:4px 0 14px">${manquantes} fiche(s) encore à découvrir.</p>`;
    }

    const duVillage = fichesDuVillage();
    html += `<h3 style="font-size:14px;margin:14px 0 8px">Mémoire de votre village</h3>`;
    html += duVillage.length
      ? duVillage
          .map(
            (f) => `<article class="carte-item"><h3>${badge('FICTION')}${echapper(f.titre)}</h3>
              <div class="meta">${echapper(f.categorie)}</div><p>${echapper(f.texte)}</p></article>`
          )
          .join('')
      : '<p class="vide">Commencez une partie pour remplir cette vitrine.</p>';
    return html;
  }

  function panneauFamilles() {
    if (!partie) return '<p class="vide">Aucune partie en cours.</p>';
    const parFamille = new Map();
    for (const habitant of partie.habitants) {
      if (!parFamille.has(habitant.famille)) parFamille.set(habitant.famille, []);
      parFamille.get(habitant.famille).push(habitant);
    }

    const nom = (id) => {
      const h = partie.habitants.find((p) => p.id === id);
      return h ? h.prenom : '?';
    };

    let html = `<p class="meta" style="margin-bottom:10px">${badge('FICTION')}Tous ces habitants sont inventés. Ils vieillissent, se marient, ont des enfants et disparaissent.</p>`;

    for (const [famille, membres] of [...parFamille.entries()].sort()) {
      membres.sort((a, b) => a.generation - b.generation || b.age - a.age);
      const lignes = membres
        .map((h) => {
          const metier = METIERS[h.metier] ? METIERS[h.metier].nom : h.metier;
          const parents = h.parents.length ? ` · enfant de ${h.parents.map(nom).join(' et ')}` : '';
          const conjoint = h.conjoint ? ` · marié(e) à ${nom(h.conjoint)}` : '';
          const etat = h.vivant ? `${h.age} ans` : `mort en l’an ${h.mortEn} à ${h.age} ans`;
          const dernier = h.histoire.length ? h.histoire[h.histoire.length - 1].texte : '';
          return `
            <div class="personne${h.vivant ? '' : ' disparu'}">
              <span class="gen">G${h.generation}</span><b>${echapper(h.prenom)}</b>
              <div class="detail">${echapper(etat)} · ${echapper(metier)}${echapper(parents)}${echapper(conjoint)}</div>
              ${dernier ? `<div class="detail">« ${echapper(dernier)} »</div>` : ''}
            </div>`;
        })
        .join('');
      html += `<section class="famille"><h3>${echapper(famille)} — ${membres.filter((m) => m.vivant).length} vivant(s)</h3>${lignes}</section>`;
    }
    return html;
  }

  function panneauParametres() {
    return `
      <button class="bouton-item" data-reglage="theme">
        <span class="titre"><b>Apparence</b><small>Mode sombre ou clair</small></span>
        <span class="prix">${reglages.theme === 'sombre' ? 'SOMBRE' : 'CLAIR'}</span>
      </button>
      <button class="bouton-item" data-reglage="nouvelle">
        <span class="titre"><b>Nouvelle partie</b><small>Repartir d’un village neuf. La partie en cours sera perdue.</small></span>
      </button>
      <button class="bouton-item" data-reglage="effacer">
        <span class="titre"><b>Réinitialiser</b><small>Effacer la sauvegarde et revenir à l’accueil.</small></span>
      </button>
      <div class="note-encadree" style="margin-top:12px">
        <h3>Sauvegarde</h3>
        <p>La partie est enregistrée dans ce navigateur à chaque saison. Elle survit à la fermeture du navigateur et du téléphone.</p>
        <p>${sauvegardeExiste() ? 'Une sauvegarde existe actuellement.' : 'Aucune sauvegarde pour l’instant.'}</p>
      </div>`;
  }

  const PANNEAUX = {
    construire: { titre: 'Construire', rendu: panneauConstruire },
    village: { titre: 'Village', rendu: panneauVillage },
    tajmaet: { titre: 'Tajmaɛt', rendu: panneauTajmaet },
    histoire: { titre: 'Histoire — Mémoire d’Algérie', rendu: panneauHistoire },
    musee: { titre: 'Musée de la mémoire', rendu: panneauMusee },
    familles: { titre: 'Familles', rendu: panneauFamilles },
    parametres: { titre: 'Paramètres', rendu: panneauParametres },
  };

  function ouvrirPanneau(nom) {
    panneauCourant = nom;
    ouvrirFeuille(PANNEAUX[nom].titre, PANNEAUX[nom].rendu());
  }

  function rafraichirFeuille() {
    if (!panneauCourant) return;
    const position = $('#feuille-contenu').scrollTop;
    $('#feuille-contenu').innerHTML = PANNEAUX[panneauCourant].rendu();
    $('#feuille-contenu').scrollTop = position;
  }

  /* ================================================== Branchements */

  $('#feuille-contenu').addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('button');
    if (!bouton) return;

    if (bouton.dataset.batir) {
      typeAConstruire = bouton.dataset.batir;
      $('#bandeau-construction').hidden = false;
      $('#bandeau-construction').textContent = `Touchez une case pour poser : ${BATIMENTS[typeAConstruire].nom}`;
      fermerFeuille();
      dessiner();
      return;
    }

    if (bouton.dataset.trancher !== undefined) {
      const refus = M.trancher(partie, Number(bouton.dataset.trancher));
      if (refus) {
        bouton.querySelector('small').textContent = `Impossible : ${refus}`;
        return;
      }
      sauvegarder();
      majInterface();
      rafraichirFeuille();
      return;
    }

    if (bouton.dataset.reglage === 'theme') {
      reglages.theme = reglages.theme === 'sombre' ? 'clair' : 'sombre';
      document.documentElement.dataset.theme = reglages.theme;
      ecrireReglages();
      rafraichirFeuille();
    } else if (bouton.dataset.reglage === 'nouvelle') {
      nouvellePartie();
      fermerFeuille();
    } else if (bouton.dataset.reglage === 'effacer') {
      effacerPartie();
      fermerFeuille();
      montrer('accueil');
      majBoutonContinuer();
    }
  });

  for (const onglet of document.querySelectorAll('[data-panneau]')) {
    onglet.addEventListener('click', () => ouvrirPanneau(onglet.dataset.panneau));
  }
  $('#feuille-fermer').addEventListener('click', fermerFeuille);
  $('#feuille-fond').addEventListener('click', fermerFeuille);

  $('#btn-vitesse').addEventListener('click', () => {
    vitesse = vitesse === 0 ? 1 : vitesse === 1 ? 2 : vitesse === 2 ? 4 : 0;
    majHud();
  });

  function nouvellePartie() {
    partie = M.creerPartie();
    vitesse = 1;
    horloge = 0;
    caseChoisie = null;
    typeAConstruire = null;
    $('#bandeau-construction').hidden = true;
    $('#info-case').textContent = 'Taddart est fondé. Touchez une case pour l’examiner.';
    sauvegarder();
    montrer('jeu');
    majInterface();
    majBoutonContinuer();
  }

  function majBoutonContinuer() {
    $('#btn-continuer').disabled = !sauvegardeExiste();
  }

  $('#btn-jouer').addEventListener('click', nouvellePartie);
  $('#btn-continuer').addEventListener('click', () => {
    const reprise = charger();
    if (!reprise) return;
    partie = reprise;
    vitesse = 1;
    horloge = 0;
    montrer('jeu');
    majInterface();
  });
  $('#btn-histoire-accueil').addEventListener('click', () => ouvrirPanneau('histoire'));
  $('#btn-musee-accueil').addEventListener('click', () => ouvrirPanneau('musee'));
  $('#btn-familles-accueil').addEventListener('click', () => ouvrirPanneau('familles'));
  $('#btn-parametres').addEventListener('click', () => ouvrirPanneau('parametres'));

  // Un téléphone qu'on verrouille ne doit pas faire vieillir le village dans le vide.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && vitesse !== 0) {
      vitesse = 0;
      majHud();
    }
  });

  /* ==================================================== Démarrage */

  lireReglages();
  majBoutonContinuer();
  montrer('accueil');
  requestAnimationFrame(boucle);

  // Crochet de mise au point, pour inspecter la partie depuis la console.
  window.Taddart = {
    get partie() {
      return partie;
    },
    get vue() {
      return vue;
    },
    nouvellePartie,
    ouvrirPanneau,
    M,
    JEU,
    HISTOIRE,
  };
})();
