/**
 * SHADOW LOOP — interface, commandes et rendu.
 *
 * Ce fichier ne décide rien du jeu : il lit les commandes, appelle le moteur
 * soixante fois par seconde, et dessine le résultat. Toute la logique (cycles,
 * ombres, collisions) vit dans moteur.js, ce qui permet de la tester sans
 * navigateur — voir tests/verifier.mjs.
 */

(function () {
  'use strict';

  /* global NIVEAUX_SHADOW_LOOP, Moteur */

  const NIVEAUX = NIVEAUX_SHADOW_LOOP;
  const { PAS, creerPartie, avancerPartie, actionPossible } = Moteur;

  const CLE_SAUVEGARDE = 'shadow-loop.v1';
  const COULEURS_OMBRES = ['#8b5cf6', '#f472b6'];

  const $ = (selecteur) => document.querySelector(selecteur);

  /* ------------------------------------------------------- Sauvegarde */

  /**
   * Progression et réglages, dans le navigateur.
   *
   * Tout est enveloppé de try/catch : en navigation privée, ou si le stockage est
   * refusé, le jeu doit rester jouable — il oublie, c'est tout.
   */
  const Sauvegarde = {
    donnees: {
      version: 1,
      debloques: 1,
      niveaux: {},
      reglages: { son: true, vibration: true, cote: 'gauche', tactile: 'auto' },
    },
    charger() {
      try {
        const brut = JSON.parse(localStorage.getItem(CLE_SAUVEGARDE) || 'null');
        if (!brut) return;
        this.donnees.debloques = brut.debloques || 1;
        this.donnees.niveaux = brut.niveaux || {};
        this.donnees.reglages = { ...this.donnees.reglages, ...(brut.reglages || {}) };
      } catch (erreur) {
        /* stockage indisponible : on joue sans mémoire */
      }
    },
    ecrire() {
      try {
        localStorage.setItem(CLE_SAUVEGARDE, JSON.stringify(this.donnees));
      } catch (erreur) {
        /* idem */
      }
    },
    meilleur(numero) {
      return this.donnees.niveaux[numero] || null;
    },
    /** Renvoie vrai si c'est un nouveau record, pour l'annoncer à l'écran. */
    enregistrerVictoire(numero, resultat) {
      const ancien = this.meilleur(numero);
      const record = !ancien || resultat.score > ancien.score;
      if (record) this.donnees.niveaux[numero] = resultat;
      this.donnees.debloques = Math.max(this.donnees.debloques, Math.min(numero + 1, NIVEAUX.length));
      this.ecrire();
      return record;
    },
    effacer() {
      this.donnees.debloques = 1;
      this.donnees.niveaux = {};
      this.ecrire();
    },
  };

  /* ------------------------------------------------------------ Sons */

  /** Trois bips synthétisés : aucun fichier à télécharger, donc rien à attendre. */
  const Sons = {
    contexte: null,
    jouer(frequence, duree = 0.07, volume = 0.05) {
      if (!Sauvegarde.donnees.reglages.son) return;
      try {
        const Constructeur = window.AudioContext || window.webkitAudioContext;
        if (!Constructeur) return;
        this.contexte = this.contexte || new Constructeur();
        if (this.contexte.state === 'suspended') this.contexte.resume();
        const oscillateur = this.contexte.createOscillator();
        const gain = this.contexte.createGain();
        oscillateur.type = 'triangle';
        oscillateur.frequency.value = frequence;
        gain.gain.setValueAtTime(volume, this.contexte.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.contexte.currentTime + duree);
        oscillateur.connect(gain).connect(this.contexte.destination);
        oscillateur.start();
        oscillateur.stop(this.contexte.currentTime + duree);
      } catch (erreur) {
        /* audio indisponible */
      }
    },
  };

  function vibrer(duree) {
    if (!Sauvegarde.donnees.reglages.vibration) return;
    try {
      if (navigator.vibrate) navigator.vibrate(duree);
    } catch (erreur) {
      /* sans effet */
    }
  }

  /* -------------------------------------------------------- Commandes */

  const Entrees = {
    clavier: new Set(),
    joystick: { identifiant: null, ox: 0, oy: 0, dx: 0, dy: 0 },
    actionEnAttente: false,

    /** Consommée une seule fois : un appui = une action, jamais deux ticks de suite. */
    lire() {
      let dx = 0;
      let dy = 0;
      if (this.clavier.has('gauche')) dx -= 1;
      if (this.clavier.has('droite')) dx += 1;
      if (this.clavier.has('haut')) dy -= 1;
      if (this.clavier.has('bas')) dy += 1;
      if (this.joystick.identifiant !== null) {
        dx += this.joystick.dx;
        dy += this.joystick.dy;
      }
      const action = this.actionEnAttente;
      this.actionEnAttente = false;
      return { dx, dy, action };
    },

    reinitialiser() {
      this.clavier.clear();
      this.joystick.identifiant = null;
      this.joystick.dx = 0;
      this.joystick.dy = 0;
      this.actionEnAttente = false;
      joystick.hidden = true;
    },
  };

  const TOUCHES = {
    ArrowUp: 'haut',
    ArrowDown: 'bas',
    ArrowLeft: 'gauche',
    ArrowRight: 'droite',
    // On lit le code physique : sur un clavier AZERTY, ZQSD tombe naturellement.
    KeyW: 'haut',
    KeyS: 'bas',
    KeyA: 'gauche',
    KeyD: 'droite',
  };

  window.addEventListener('keydown', (evenement) => {
    if (evenement.repeat) return;
    if (evenement.code === 'Space') {
      evenement.preventDefault();
      Entrees.actionEnAttente = true;
      return;
    }
    if (evenement.code === 'Escape' && ecranCourant === 'jeu') {
      basculerPause();
      return;
    }
    const direction = TOUCHES[evenement.code];
    if (!direction) return;
    evenement.preventDefault();
    Entrees.clavier.add(direction);
  });

  window.addEventListener('keyup', (evenement) => {
    const direction = TOUCHES[evenement.code];
    if (direction) Entrees.clavier.delete(direction);
  });

  /* ------------------------------------------------- Joystick tactile */

  const scene = $('#scene');
  const joystick = $('#joystick');
  const joystickTete = $('#joystick-tete');
  const boutonAction = $('#btn-action');
  const RAYON_JOYSTICK = 52;

  /** Le joystick naît sous le pouce : pas de cible fixe à viser en pleine partie. */
  function zoneJoystick(x, rectangle) {
    const milieu = rectangle.left + rectangle.width / 2;
    return Sauvegarde.donnees.reglages.cote === 'gauche' ? x < milieu : x > milieu;
  }

  scene.addEventListener(
    'touchstart',
    (evenement) => {
      const rectangle = scene.getBoundingClientRect();
      for (const toucher of evenement.changedTouches) {
        if (Entrees.joystick.identifiant !== null) break;
        if (!zoneJoystick(toucher.clientX, rectangle)) continue;
        Entrees.joystick.identifiant = toucher.identifier;
        Entrees.joystick.ox = toucher.clientX;
        Entrees.joystick.oy = toucher.clientY;
        Entrees.joystick.dx = 0;
        Entrees.joystick.dy = 0;
        joystick.hidden = false;
        joystick.style.left = `${toucher.clientX - rectangle.left}px`;
        joystick.style.top = `${toucher.clientY - rectangle.top}px`;
        joystickTete.style.transform = 'translate(0px, 0px)';
      }
      evenement.preventDefault();
    },
    { passive: false }
  );

  scene.addEventListener(
    'touchmove',
    (evenement) => {
      for (const toucher of evenement.changedTouches) {
        if (toucher.identifier !== Entrees.joystick.identifiant) continue;
        const dx = toucher.clientX - Entrees.joystick.ox;
        const dy = toucher.clientY - Entrees.joystick.oy;
        const longueur = Math.hypot(dx, dy) || 1;
        const borne = Math.min(longueur, RAYON_JOYSTICK);
        Entrees.joystick.dx = (dx / longueur) * (borne / RAYON_JOYSTICK);
        Entrees.joystick.dy = (dy / longueur) * (borne / RAYON_JOYSTICK);
        joystickTete.style.transform = `translate(${(dx / longueur) * borne}px, ${(dy / longueur) * borne}px)`;
      }
      evenement.preventDefault();
    },
    { passive: false }
  );

  function relacherJoystick(evenement) {
    for (const toucher of evenement.changedTouches) {
      if (toucher.identifier !== Entrees.joystick.identifiant) continue;
      Entrees.joystick.identifiant = null;
      Entrees.joystick.dx = 0;
      Entrees.joystick.dy = 0;
      joystick.hidden = true;
    }
  }

  scene.addEventListener('touchend', relacherJoystick);
  scene.addEventListener('touchcancel', relacherJoystick);

  boutonAction.addEventListener(
    'touchstart',
    (evenement) => {
      evenement.preventDefault();
      evenement.stopPropagation();
      Entrees.actionEnAttente = true;
      vibrer(10);
    },
    { passive: false }
  );

  boutonAction.addEventListener('click', () => {
    Entrees.actionEnAttente = true;
  });

  /* --------------------------------------------------------- Écrans */

  let ecranCourant = 'accueil';
  let partie = null;
  let niveauCourant = 1;
  let enPause = false;

  function montrer(nom) {
    ecranCourant = nom;
    for (const cle of ['accueil', 'niveaux', 'parametres', 'jeu']) {
      $(`#ecran-${cle}`).hidden = cle !== nom;
    }
    for (const voile of ['pause', 'victoire', 'defaite']) $(`#voile-${voile}`).hidden = true;
    if (nom !== 'jeu') Entrees.reinitialiser();
  }

  function construireListeNiveaux() {
    const liste = $('#liste-niveaux');
    liste.replaceChildren();
    for (const niveau of NIVEAUX) {
      const verrouille = niveau.numero > Sauvegarde.donnees.debloques;
      const meilleur = Sauvegarde.meilleur(niveau.numero);
      const bouton = document.createElement('button');
      bouton.className = 'niveau';
      bouton.disabled = verrouille;
      bouton.innerHTML =
        `<span class="numero">${verrouille ? '🔒' : niveau.numero}</span>` +
        `<span class="titre"><b>${niveau.nom}</b><small></small></span>`;
      bouton.querySelector('small').textContent = meilleur
        ? `Record ${meilleur.score} pts · ${meilleur.temps.toFixed(1)} s · ${meilleur.cycles} cycle(s)`
        : verrouille
          ? 'À débloquer'
          : 'Jamais terminé';
      bouton.addEventListener('click', () => lancerNiveau(niveau.numero));
      liste.append(bouton);
    }
  }

  function majReglages() {
    const reglages = Sauvegarde.donnees.reglages;
    $('#reglage-son').querySelector('b').textContent = reglages.son ? 'ACTIVÉS' : 'COUPÉS';
    $('#reglage-vibration').querySelector('b').textContent = reglages.vibration ? 'ACTIVÉE' : 'COUPÉE';
    $('#reglage-cote').querySelector('b').textContent = reglages.cote === 'gauche' ? 'À GAUCHE' : 'À DROITE';
    $('#reglage-tactile').querySelector('b').textContent =
      reglages.tactile === 'auto' ? 'AUTO' : reglages.tactile === 'toujours' ? 'TOUJOURS' : 'JAMAIS';
    appliquerTactile();
  }

  /** Les commandes tactiles gênent à la souris ; on les montre quand elles servent. */
  function appliquerTactile() {
    const mode = Sauvegarde.donnees.reglages.tactile;
    const tactile = mode === 'toujours' || (mode === 'auto' && matchMedia('(pointer: coarse)').matches);
    boutonAction.hidden = !tactile;
    if (!tactile) joystick.hidden = true;
  }

  /* ----------------------------------------------------- Déroulement */

  function lancerNiveau(numero) {
    niveauCourant = numero;
    partie = creerPartie(NIVEAUX[numero - 1]);
    enPause = false;
    Entrees.reinitialiser();
    $('#hud-aide').textContent = NIVEAUX[numero - 1].aide;
    montrer('jeu');
    redimensionner();
    majHud();
  }

  function calculerScore(donnees) {
    return Math.max(50, Math.round(1200 - (donnees.cycles - 1) * 150 - donnees.temps * 6));
  }

  function terminerVictoire() {
    const temps = partie.ticksTotal * PAS;
    const resultat = { temps: Number(temps.toFixed(1)), cycles: partie.cycle, score: 0 };
    resultat.score = calculerScore(resultat);
    const record = Sauvegarde.enregistrerVictoire(niveauCourant, resultat);

    $('#bilan-temps').textContent = `${resultat.temps.toFixed(1)} s`;
    $('#bilan-cycles').textContent = String(resultat.cycles);
    $('#bilan-score').textContent = String(resultat.score);
    $('#bilan-record').hidden = !record;
    $('#btn-suivant').hidden = niveauCourant >= NIVEAUX.length;
    $('#voile-victoire').hidden = false;
    Sons.jouer(660, 0.1);
    setTimeout(() => Sons.jouer(880, 0.16), 110);
    vibrer([20, 40, 30]);
  }

  function terminerDefaite() {
    $('#defaite-texte').textContent = `Les ${partie.niveau.cyclesMax} cycles sont épuisés.`;
    $('#voile-defaite').hidden = false;
    Sons.jouer(180, 0.25, 0.06);
    vibrer(80);
  }

  function basculerPause() {
    if (!partie || partie.etat !== 'encours') return;
    enPause = !enPause;
    $('#voile-pause').hidden = !enPause;
    if (enPause) Entrees.reinitialiser();
  }

  /* ------------------------------------------------------------ HUD */

  let dernierCycle = 0;

  function majHud() {
    if (!partie) return;
    $('#hud-niveau').textContent = String(niveauCourant);
    $('#hud-cycle').textContent = `${partie.cycle}/${partie.niveau.cyclesMax}`;
    const restant = (partie.ticksCycle - partie.tick) * PAS;
    $('#hud-chrono').textContent = restant.toFixed(1).replace('.', ',');
    const remplissage = $('#jauge-remplissage');
    remplissage.style.transform = `scaleX(${Math.max(0, restant / (partie.ticksCycle * PAS))})`;
    remplissage.classList.toggle('urgent', restant < 3);

    if (partie.cycle !== dernierCycle) {
      dernierCycle = partie.cycle;
      if (partie.cycle > 1) {
        Sons.jouer(420, 0.09);
        vibrer(25);
      }
    }

    boutonAction.classList.toggle('pret', Boolean(actionPossible(partie.monde, partie.joueur)));
  }

  /* ---------------------------------------------------------- Rendu */

  const toile = $('#toile');
  const ctx = toile.getContext('2d');
  let vue = { taille: 24, ox: 0, oy: 0, largeur: 0, hauteur: 0 };

  function redimensionner() {
    const densite = Math.min(window.devicePixelRatio || 1, 2);
    const largeur = scene.clientWidth;
    const hauteur = scene.clientHeight;
    if (largeur === 0 || hauteur === 0) return;
    toile.width = Math.round(largeur * densite);
    toile.height = Math.round(hauteur * densite);
    vue.largeur = largeur;
    vue.hauteur = hauteur;
    ctx.setTransform(densite, 0, 0, densite, 0, 0);
  }

  window.addEventListener('resize', redimensionner);
  window.addEventListener('orientationchange', () => setTimeout(redimensionner, 120));

  const versEcran = (x, y) => ({ x: vue.ox + x * vue.taille, y: vue.oy + y * vue.taille });

  function disque(x, y, rayon, couleur, alpha = 1) {
    const point = versEcran(x, y);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = couleur;
    ctx.beginPath();
    ctx.arc(point.x, point.y, rayon * vue.taille, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function dessiner() {
    ctx.clearRect(0, 0, vue.largeur, vue.hauteur);
    if (!partie) return;
    const monde = partie.monde;

    // On réserve le bas de l'écran aux commandes tactiles : sinon le bouton
    // ACTION recouvre le coin du plateau, et souvent la sortie elle-même.
    const bandeCommandes = boutonAction.hidden ? 0 : 124;
    const hauteurUtile = Math.max(160, vue.hauteur - bandeCommandes);
    vue.taille = Math.floor(Math.min(vue.largeur / monde.colonnes, hauteurUtile / monde.lignes));
    vue.ox = Math.round((vue.largeur - vue.taille * monde.colonnes) / 2);
    vue.oy = Math.round((hauteurUtile - vue.taille * monde.lignes) / 2);
    const t = vue.taille;

    // Sol et murs
    for (let y = 0; y < monde.lignes; y += 1) {
      for (let x = 0; x < monde.colonnes; x += 1) {
        const mur = monde.mur[y * monde.colonnes + x] === 1;
        const gx = vue.ox + x * t;
        const gy = vue.oy + y * t;
        ctx.fillStyle = mur ? '#2c3660' : '#0b0e18';
        ctx.fillRect(gx, gy, t - 1, t - 1);
        // Un liseré clair en haut des murs : sans lui, sol et murs se confondent
        // sur un écran de téléphone en plein soleil.
        if (mur) {
          ctx.fillStyle = '#3d4a7d';
          ctx.fillRect(gx, gy, t - 1, Math.max(2, t * 0.14));
        }
      }
    }

    // Plaques de pression
    for (const plaque of monde.plaques) {
      ctx.strokeStyle = plaque.active ? '#fbbf24' : '#4b5573';
      ctx.lineWidth = 2;
      ctx.fillStyle = plaque.active ? 'rgba(251,191,36,0.28)' : 'rgba(75,85,115,0.16)';
      const marge = t * 0.16;
      ctx.beginPath();
      ctx.rect(vue.ox + plaque.x * t + marge, vue.oy + plaque.y * t + marge, t - marge * 2, t - marge * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Interrupteurs
    for (const inter of monde.interrupteurs) {
      disque(inter.x + 0.5, inter.y + 0.5, 0.22, '#f472b6', 0.85);
    }

    // Portes — ouvertes, on garde un liseré pour qu'on les repère encore
    for (const porte of monde.portes) {
      const x = vue.ox + porte.x * t;
      const y = vue.oy + porte.y * t;
      if (porte.ouverte) {
        ctx.strokeStyle = porte.type === 'cle' ? 'rgba(251,191,36,0.45)' : 'rgba(52,211,153,0.4)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, t - 5, t - 5);
      } else {
        ctx.fillStyle = porte.type === 'cle' ? '#a16207' : '#3f4a6b';
        ctx.fillRect(x, y, t - 1, t - 1);
        ctx.fillStyle = 'rgba(232,236,248,0.22)';
        ctx.fillRect(x + t * 0.42, y + t * 0.18, t * 0.16, t * 0.64);
      }
    }

    // Sortie
    const sortie = versEcran(monde.sortie.x + 0.5, monde.sortie.y + 0.5);
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sortie.x, sortie.y, t * 0.34, 0, Math.PI * 2);
    ctx.stroke();
    disque(monde.sortie.x + 0.5, monde.sortie.y + 0.5, 0.14, '#34d399', 0.9);

    // Clé
    if (monde.cle) {
      const point = versEcran(monde.cle.x, monde.cle.y - (monde.cle.portee ? 0.42 : 0));
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(point.x, point.y - t * 0.17);
      ctx.lineTo(point.x + t * 0.15, point.y);
      ctx.lineTo(point.x, point.y + t * 0.17);
      ctx.lineTo(point.x - t * 0.15, point.y);
      ctx.closePath();
      ctx.fill();
    }

    // Ombres : translucides, cernées, numérotées par couleur
    partie.ombres.forEach((ombre, index) => {
      if (!ombre.actif) return;
      const couleur = COULEURS_OMBRES[index % COULEURS_OMBRES.length];
      disque(ombre.corps.x, ombre.corps.y, 0.34, couleur, 0.4);
      const point = versEcran(ombre.corps.x, ombre.corps.y);
      // Un halo pointillé, plus large que le joueur : l'ombre reste repérable
      // même quand le joueur passe exactement dessus.
      ctx.strokeStyle = couleur;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 2;
      ctx.setLineDash([t * 0.16, t * 0.12]);
      ctx.beginPath();
      ctx.arc(point.x, point.y, 0.46 * t, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(point.x + Math.cos(ombre.corps.dir) * t * 0.3, point.y + Math.sin(ombre.corps.dir) * t * 0.3);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    // Joueur, avec le nez tourné dans sa direction
    const joueur = partie.joueur;
    disque(joueur.x, joueur.y, 0.34, '#22d3ee');
    const centre = versEcran(joueur.x, joueur.y);
    ctx.strokeStyle = '#04222a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centre.x, centre.y);
    ctx.lineTo(centre.x + Math.cos(joueur.dir) * t * 0.3, centre.y + Math.sin(joueur.dir) * t * 0.3);
    ctx.stroke();
  }

  /* --------------------------------------------------- Boucle de jeu */

  let dernierInstant = 0;
  let accumulateur = 0;

  /**
   * Pas fixe : la simulation avance par tranches de 1/60 s, quel que soit le
   * rafraîchissement de l'écran. C'est ce qui rend le rejeu des ombres identique
   * sur un vieux téléphone et sur un ordinateur de bureau.
   */
  function boucle(instant) {
    requestAnimationFrame(boucle);
    const delta = Math.min((instant - dernierInstant) / 1000, 0.25);
    dernierInstant = instant;

    if (ecranCourant === 'jeu' && partie && partie.etat === 'encours' && !enPause) {
      accumulateur += delta;
      while (accumulateur >= PAS && partie.etat === 'encours') {
        avancerPartie(partie, Entrees.lire());
        accumulateur -= PAS;
      }
      majHud();
      if (partie.etat === 'gagne') terminerVictoire();
      else if (partie.etat === 'perdu') terminerDefaite();
    } else {
      accumulateur = 0;
    }

    if (ecranCourant === 'jeu') dessiner();
  }

  /* ------------------------------------------------------- Démarrage */

  Sauvegarde.charger();
  majReglages();
  construireListeNiveaux();

  $('#btn-jouer').addEventListener('click', () => lancerNiveau(Sauvegarde.donnees.debloques));
  $('#btn-niveaux').addEventListener('click', () => {
    construireListeNiveaux();
    montrer('niveaux');
  });
  $('#btn-parametres').addEventListener('click', () => montrer('parametres'));
  for (const bouton of document.querySelectorAll('[data-retour]')) {
    bouton.addEventListener('click', () => montrer('accueil'));
  }

  $('#btn-pause').addEventListener('click', basculerPause);
  $('#btn-reprendre').addEventListener('click', basculerPause);
  $('#btn-recommencer-pause').addEventListener('click', () => lancerNiveau(niveauCourant));
  $('#btn-menu-pause').addEventListener('click', () => montrer('accueil'));
  $('#btn-rejouer').addEventListener('click', () => lancerNiveau(niveauCourant));
  $('#btn-recommencer').addEventListener('click', () => lancerNiveau(niveauCourant));
  $('#btn-menu-victoire').addEventListener('click', () => {
    construireListeNiveaux();
    montrer('accueil');
  });
  $('#btn-menu-defaite').addEventListener('click', () => montrer('accueil'));
  $('#btn-suivant').addEventListener('click', () => lancerNiveau(Math.min(niveauCourant + 1, NIVEAUX.length)));

  $('#reglage-son').addEventListener('click', () => {
    Sauvegarde.donnees.reglages.son = !Sauvegarde.donnees.reglages.son;
    Sauvegarde.ecrire();
    majReglages();
    Sons.jouer(520);
  });
  $('#reglage-vibration').addEventListener('click', () => {
    Sauvegarde.donnees.reglages.vibration = !Sauvegarde.donnees.reglages.vibration;
    Sauvegarde.ecrire();
    majReglages();
    vibrer(20);
  });
  $('#reglage-cote').addEventListener('click', () => {
    Sauvegarde.donnees.reglages.cote = Sauvegarde.donnees.reglages.cote === 'gauche' ? 'droite' : 'gauche';
    Sauvegarde.ecrire();
    majReglages();
  });
  $('#reglage-tactile').addEventListener('click', () => {
    const suite = { auto: 'toujours', toujours: 'jamais', jamais: 'auto' };
    Sauvegarde.donnees.reglages.tactile = suite[Sauvegarde.donnees.reglages.tactile] || 'auto';
    Sauvegarde.ecrire();
    majReglages();
  });
  $('#reglage-effacer').addEventListener('click', () => {
    Sauvegarde.effacer();
    construireListeNiveaux();
    majReglages();
    $('#reglage-effacer').querySelector('span').textContent = 'Progression effacée';
    setTimeout(() => {
      $('#reglage-effacer').querySelector('span').textContent = 'Effacer la progression';
    }, 1600);
  });

  // Un téléphone qui se verrouille ne doit pas laisser tourner un cycle dans le vide.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && ecranCourant === 'jeu' && partie && partie.etat === 'encours' && !enPause) {
      basculerPause();
    }
  });

  montrer('accueil');
  redimensionner();
  requestAnimationFrame(boucle);

  // Crochet de mise au point : permet d'inspecter la partie depuis la console.
  window.ShadowLoop = {
    get partie() {
      return partie;
    },
    Sauvegarde,
    NIVEAUX,
    lancerNiveau,
  };
})();
