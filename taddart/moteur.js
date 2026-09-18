'use strict';
/**
 * TADDART — simulation du village. Aucun appel au navigateur.
 *
 * Le moteur ne sait ni dessiner ni sauvegarder : il fait avancer un village
 * saison après saison. On peut donc le faire tourner dans Node et vérifier
 * qu'un village survit, que les générations se succèdent et que les dix
 * missions sont atteignables — voir tests/verifier.mjs.
 *
 * Le temps : une saison par tour, quatre saisons par an. Tout le hasard passe
 * par un générateur à graine rangée dans la sauvegarde : reprendre une partie
 * la reprend exactement où elle était, et un test rejoue la même histoire.
 */

(function (racineGlobale) {
  'use strict';

  const JEU = typeof module !== 'undefined' && module.exports ? require('./donnees-jeu.js') : racineGlobale.JEU_TADDART;
  const { SAISONS, TERRAINS, BATIMENTS, PRENOMS, FAMILLES, FONDATEURS, METIERS, DECISIONS, MISSIONS } = JEU;

  const TERRAIN_CLES = ['montagne', 'rocher', 'foret', 'coteau', 'prairie', 'eau'];
  const LARGEUR = 16;
  const HAUTEUR = 22;

  const ADULTE = 16;
  const ANCIEN = 62;
  const EAU_PAR_HABITANT = 1.1;
  const NOURRITURE_PAR_HABITANT = 1.15;

  /* ------------------------------------------------------------ Hasard */

  /** Générateur à graine (mulberry32) : l'état tient dans un entier, donc il se sauvegarde. */
  function tirer(etat) {
    etat.rng = (etat.rng + 0x6d2b79f5) >>> 0;
    let t = etat.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  const entre = (etat, min, max) => min + Math.floor(tirer(etat) * (max - min + 1));
  const parmi = (etat, liste) => liste[Math.floor(tirer(etat) * liste.length)];

  /* ------------------------------------------------------------- Carte */

  /**
   * Relief : montagne en haut, terres cultivables en bas, un cours d'eau qui
   * descend. C'est le profil d'un village de montagne kabyle — accroché au
   * versant, ses terres en contrebas — sans copier aucun lieu réel.
   */
  function genererCarte(etat) {
    const bruit = new Float32Array(LARGEUR * HAUTEUR);
    for (let i = 0; i < bruit.length; i += 1) bruit[i] = tirer(etat);
    // Trois lissages : des massifs, pas un damier.
    for (let passe = 0; passe < 3; passe += 1) {
      const copie = Float32Array.from(bruit);
      for (let y = 0; y < HAUTEUR; y += 1) {
        for (let x = 0; x < LARGEUR; x += 1) {
          let somme = 0;
          let n = 0;
          for (let dy = -1; dy <= 1; dy += 1) {
            for (let dx = -1; dx <= 1; dx += 1) {
              const vx = x + dx;
              const vy = y + dy;
              if (vx < 0 || vy < 0 || vx >= LARGEUR || vy >= HAUTEUR) continue;
              somme += copie[vy * LARGEUR + vx];
              n += 1;
            }
          }
          bruit[y * LARGEUR + x] = somme / n;
        }
      }
    }

    const cases = new Array(LARGEUR * HAUTEUR);
    for (let y = 0; y < HAUTEUR; y += 1) {
      for (let x = 0; x < LARGEUR; x += 1) {
        const pente = 1 - y / (HAUTEUR - 1);
        const altitude = pente * 0.72 + (bruit[y * LARGEUR + x] - 0.5) * 0.7;
        let terrain = 'prairie';
        if (altitude > 0.62) terrain = 'montagne';
        else if (altitude > 0.5) terrain = 'rocher';
        else if (altitude > 0.36) terrain = 'foret';
        else if (altitude > 0.2) terrain = 'coteau';
        cases[y * LARGEUR + x] = TERRAIN_CLES.indexOf(terrain);
      }
    }

    // Le ruisseau : il naît dans la roche et descend en serpentant.
    let x = entre(etat, 2, LARGEUR - 3);
    const source = { x, y: 2 };
    for (let y = 2; y < HAUTEUR; y += 1) {
      cases[y * LARGEUR + x] = TERRAIN_CLES.indexOf('eau');
      // Les berges sont cultivables : c'est là que s'installe le village.
      for (const dx of [-1, 1]) {
        const vx = x + dx;
        if (vx > 0 && vx < LARGEUR - 1 && TERRAIN_CLES[cases[y * LARGEUR + vx]] === 'montagne') {
          cases[y * LARGEUR + vx] = TERRAIN_CLES.indexOf('coteau');
        }
      }
      if (tirer(etat) < 0.42) x = Math.max(1, Math.min(LARGEUR - 2, x + (tirer(etat) < 0.5 ? -1 : 1)));
    }

    return { largeur: LARGEUR, hauteur: HAUTEUR, cases, source };
  }

  const terrainDe = (etat, x, y) => {
    if (x < 0 || y < 0 || x >= etat.carte.largeur || y >= etat.carte.hauteur) return null;
    return TERRAIN_CLES[etat.carte.cases[y * etat.carte.largeur + x]];
  };

  const batimentEn = (etat, x, y) => etat.batiments.find((b) => b.x === x && b.y === y) || null;

  const aCoteDe = (etat, x, y, terrain) => {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (terrainDe(etat, x + dx, y + dy) === terrain) return true;
    }
    return false;
  };

  /** Dit si l'on peut bâtir ici, et sinon pourquoi — l'interface affiche la raison. */
  function peutConstruire(etat, type, x, y) {
    const modele = BATIMENTS[type];
    if (!modele) return 'bâtiment inconnu';
    const terrain = terrainDe(etat, x, y);
    if (!terrain) return 'hors de la carte';
    if (!TERRAINS[terrain].bati) return `on ne bâtit pas sur : ${TERRAINS[terrain].nom.toLowerCase()}`;
    if (!modele.terrains.includes(terrain)) return `pas sur ce terrain (${TERRAINS[terrain].nom.toLowerCase()})`;
    if (batimentEn(etat, x, y)) return 'la case est occupée';
    if (modele.unique && etat.compte(type) > 0) return 'le village n’en a qu’un';
    if (modele.pres_de && !aCoteDe(etat, x, y, modele.pres_de)) return 'à construire au bord de l’eau';
    for (const [ressource, quantite] of Object.entries(modele.cout)) {
      if (etat.ressources[ressource] < quantite) return `il manque : ${ressource}`;
    }
    return null;
  }

  function construire(etat, type, x, y) {
    const refus = peutConstruire(etat, type, x, y);
    if (refus) return refus;
    const modele = BATIMENTS[type];
    for (const [ressource, quantite] of Object.entries(modele.cout)) etat.ressources[ressource] -= quantite;

    const doyen = etat.habitantsVivants().sort((a, b) => b.age - a.age)[0];
    etat.batiments.push({
      id: etat.prochainId++,
      type,
      x,
      y,
      annee: etat.annee,
      generationDe: doyen ? doyen.prenom : null,
      travailleurs: [],
    });
    repartirLesMetiers(etat);
    noter(etat, `${modele.nom} — construite`, 'construction');
    return null;
  }

  /* -------------------------------------------------------- Habitants */

  function creerHabitant(etat, { prenom, sexe, age, metier, famille, generation = 1, parents = [] }) {
    const habitant = {
      id: etat.prochainId++,
      prenom,
      sexe,
      age,
      famille,
      generation,
      parents,
      conjoint: null,
      enfants: [],
      metier: metier || (age < ADULTE ? 'enfant' : 'sans emploi'),
      maison: null,
      argent: entre(etat, 4, 18),
      sante: entre(etat, 72, 96),
      satisfaction: 60,
      vivant: true,
      neEn: etat.annee - age,
      histoire: [],
    };
    etat.habitants.push(habitant);
    return habitant;
  }

  const raconter = (etat, habitant, texte) => habitant.histoire.push({ annee: etat.annee, texte });

  /**
   * Chaque adulte disponible prend un poste dans un bâtiment qui en manque.
   *
   * Assignation automatique : sur un téléphone, affecter cinquante villageois à
   * la main serait une corvée, pas un jeu.
   */
  function repartirLesMetiers(etat) {
    const adultes = etat.habitantsVivants().filter((h) => h.age >= ADULTE && h.age < ANCIEN);
    for (const habitant of adultes) {
      habitant.metier = 'sans emploi';
      habitant.batiment = null;
    }
    for (const habitant of etat.habitantsVivants()) {
      if (habitant.age < ADULTE) habitant.metier = 'enfant';
      else if (habitant.age >= ANCIEN) habitant.metier = 'ancien';
    }

    const libres = adultes.slice();
    const aPourvoir = etat.batiments.filter((b) => BATIMENTS[b.type].emplois > 0);
    for (const batiment of etat.batiments) batiment.travailleurs = [];

    // Un bras dans chaque atelier avant d'en remplir un seul.
    //
    // Servir les bâtiments dans l'ordre de construction condamnait les derniers
    // bâtis à ne jamais tourner : on montait un atelier et il ne produisait
    // rien, sans que rien ne l'explique. En tournant, un bâtiment à moitié
    // pourvu produit à moitié, ce qui se comprend et se corrige.
    const maxEmplois = aPourvoir.reduce((max, b) => Math.max(max, BATIMENTS[b.type].emplois), 0);
    for (let tour = 0; tour < maxEmplois && libres.length > 0; tour += 1) {
      for (const batiment of aPourvoir) {
        if (!libres.length) break;
        if (BATIMENTS[batiment.type].emplois <= tour) continue;
        const metier = Object.keys(METIERS).find((cle) => METIERS[cle].batiment === batiment.type) || 'sans emploi';
        const habitant = libres.shift();
        habitant.metier = metier;
        habitant.batiment = batiment.id;
        batiment.travailleurs.push(habitant.id);
      }
    }

    // Les jeunes sans poste apprennent auprès des autres.
    for (const habitant of libres) {
      if (habitant.age < 22) habitant.metier = 'apprenti';
    }
  }

  function loger(etat) {
    const maisons = etat.batiments.filter((b) => b.type === 'maison');
    const places = maisons.length * BATIMENTS.maison.loge;
    const vivants = etat.habitantsVivants();
    vivants.forEach((habitant, index) => {
      const maison = maisons[Math.floor(index / BATIMENTS.maison.loge)];
      habitant.maison = maison ? maison.id : null;
    });
    return { places, occupees: vivants.length };
  }

  /* ------------------------------------------------------ Production */

  function produire(etat) {
    const production = {};
    const ajouter = (ressource, quantite) => {
      production[ressource] = (production[ressource] || 0) + quantite;
    };
    const saison = SAISONS[etat.saison];

    for (const batiment of etat.batiments) {
      const modele = BATIMENTS[batiment.type];
      const ouvriers = batiment.travailleurs.length;
      if (!ouvriers && modele.emplois) continue;
      const facteurSaison = modele.saisons ? modele.saisons[saison] : 1;
      if (!facteurSaison) continue;

      if (modele.produit) {
        for (const [ressource, base] of Object.entries(modele.produit)) {
          let quantite = base * ouvriers * facteurSaison;
          if (['cereales', 'olives', 'fruits'].includes(ressource)) {
            quantite *= 1 + etat.bonus.rendementAgricole;
          }
          ajouter(ressource, quantite);
        }
      }

      if (modele.consomme) {
        for (const [ressource, base] of Object.entries(modele.consomme)) {
          ajouter(ressource, -base * ouvriers * facteurSaison);
        }
      }

      if (modele.transforme) {
        const { depuis, vers } = modele.transforme;
        // On ne transforme que ce qu'on a : un moulin sans olives ne tourne pas.
        let lots = ouvriers * facteurSaison;
        for (const [ressource, base] of Object.entries(depuis)) {
          if (base > 0) lots = Math.min(lots, etat.ressources[ressource] / base);
        }
        lots = Math.max(0, lots);
        for (const [ressource, base] of Object.entries(depuis)) ajouter(ressource, -base * lots);
        for (const [ressource, base] of Object.entries(vers)) ajouter(ressource, base * lots);
      }
    }

    // L'eau puisée au ruisseau, à la main, jarre après jarre.
    //
    // Sans cela le village est à sec en trois saisons, avant même d'avoir pu
    // bâtir sa fontaine : il mourait de soif pendant le tutoriel. Le puisage
    // à la main ne suffit jamais à un village qui grandit — c'est justement ce
    // qui pousse à capter la source.
    ajouter('eau', Math.min(18, etat.habitantsVivants().length));

    if (etat.bonus.argentParSaison) ajouter('argent', etat.bonus.argentParSaison);

    // Entretien des bâtiments publics : une école ou un marché coûte à faire
    // vivre. Les bâtiments de production, eux, se paient sur leur récolte.
    const entretien = etat.batiments.reduce((total, b) => total + (BATIMENTS[b.type].entretien || 0), 0);
    if (entretien) ajouter('argent', -entretien);

    for (const [ressource, quantite] of Object.entries(production)) {
      etat.ressources[ressource] = Math.max(0, etat.ressources[ressource] + quantite);
      if (quantite > 0) etat.cumul[ressource] = (etat.cumul[ressource] || 0) + quantite;
    }
    return production;
  }

  /**
   * Vente du surplus dans la vallée.
   *
   * Sans cela, un village sans marché n'a aucune rentrée d'argent et ne peut
   * plus rien bâtir : une impasse. Les villages descendaient vendre l'huile,
   * les figues et les poteries qui dépassaient leurs besoins. Le prix est
   * mauvais tant qu'il n'y a pas de marché au village.
   */
  function vendreSurplus(etat) {
    const bouches = Math.max(1, etat.habitantsVivants().length);
    // Le bois, la pierre et le grain en excès se vendent aussi : sans cela, un
    // village qui n'a pas encore de marché n'a aucune rentrée et reste bloqué,
    // ce qui n'est ni jouable ni vraisemblable.
    const prix = { cereales: 0.35, fruits: 0.5, olives: 0.9, huile: 3.5, artisanat: 5, animaux: 8, bois: 0.5, pierre: 0.6 };
    const garde = { cereales: bouches * 8, fruits: bouches * 3, olives: 10, huile: 6, artisanat: 5, animaux: 10, bois: 40, pierre: 30 };
    const part = etat.compte('marche') > 0 ? 0.5 : 0.25;
    let gain = 0;
    for (const [ressource, unitaire] of Object.entries(prix)) {
      const surplus = etat.ressources[ressource] - garde[ressource];
      if (surplus <= 0) continue;
      const vendu = surplus * part;
      etat.ressources[ressource] -= vendu;
      gain += vendu * unitaire;
    }
    etat.ressources.argent += gain;
    etat.cumul.argent += gain;
    return gain;
  }

  function consommer(etat) {
    const vivants = etat.habitantsVivants();
    const besoinEau = vivants.length * EAU_PAR_HABITANT;
    const besoinNourriture = vivants.length * NOURRITURE_PAR_HABITANT;

    const eauBue = Math.min(etat.ressources.eau, besoinEau);
    etat.ressources.eau -= eauBue;

    // On mange d'abord les céréales, puis les fruits : le grain se garde.
    let reste = besoinNourriture;
    const pris = {};
    for (const ressource of ['cereales', 'fruits']) {
      const part = Math.min(etat.ressources[ressource], reste);
      etat.ressources[ressource] -= part;
      pris[ressource] = part;
      reste -= part;
    }

    const manqueEau = besoinEau - eauBue;
    const manqueNourriture = reste;
    return { besoinEau, besoinNourriture, manqueEau, manqueNourriture, pris };
  }

  /* --------------------------------------------------- Satisfaction */

  function recalculerSatisfaction(etat, manques) {
    const vivants = etat.habitantsVivants();
    const { places } = loger(etat);
    // L'échelle est calibrée pour qu'un village bien tenu plafonne vers 85, pas
    // 100 : il faut de la marge au-dessus, sinon la jauge ne récompense plus
    // rien et ne signale plus rien.
    let cible = 42;

    cible += places >= vivants.length ? 8 : -18;
    cible += manques.manqueNourriture > 0 ? -26 : etat.ressources.cereales + etat.ressources.fruits > vivants.length * 4 ? 9 : 2;
    cible += manques.manqueEau > 0 ? -22 : etat.ressources.eau > vivants.length * 4 ? 7 : 2;

    // Les équipements comptent, mais à rendement décroissant : sans plafond, un
    // village bien doté reste scotché à 100 et la jauge cesse de dire quoi que
    // ce soit — ni la disette ni la soif ne s'y verraient plus.
    let apportBatiments = 0;
    for (const batiment of etat.batiments) {
      const effets = BATIMENTS[batiment.type].effets;
      if (effets && effets.satisfaction) apportBatiments += effets.satisfaction;
    }
    cible += Math.min(20, apportBatiments);
    cible += etat.bonus.satisfaction;

    const sansEmploi = vivants.filter((h) => h.metier === 'sans emploi').length;
    cible -= sansEmploi * 1.2;

    cible = Math.max(0, Math.min(100, cible));
    // On s'en approche par quarts : l'humeur d'un village ne bascule pas en un jour.
    etat.satisfaction += (cible - etat.satisfaction) * 0.25;
    for (const habitant of vivants) habitant.satisfaction = Math.round(etat.satisfaction);
    return cible;
  }

  /* ---------------------------------------------------- Générations */

  function passerUneAnnee(etat, manques) {
    const evenements = [];
    const vivants = etat.habitantsVivants();
    const soins = etat.compte('soins') > 0;
    const ecole = etat.compte('ecole') > 0;

    for (const habitant of vivants) {
      habitant.age += 1;
      if (manques.manqueNourriture > 0 || manques.manqueEau > 0) habitant.sante -= entre(etat, 4, 12);
      else habitant.sante = Math.min(100, habitant.sante + (soins ? 4 : 2));
      if (habitant.age === ADULTE) {
        raconter(etat, habitant, ecole ? 'Devenu adulte, après l’école du village.' : 'Devenu adulte.');
      }
    }

    // Décès : le grand âge et la mauvaise santé, pas le hasard pur.
    for (const habitant of vivants) {
      const age = habitant.age;
      let risque = age < 45 ? 0.005 : age < 58 ? 0.018 : age < 68 ? 0.05 : age < 78 ? 0.12 : 0.26;
      if (habitant.sante < 45) risque += 0.06;
      if (soins) risque *= 0.75;
      if (tirer(etat) < risque) {
        habitant.vivant = false;
        habitant.mortEn = etat.annee;
        raconter(etat, habitant, `Mort à ${age} ans.`);
        evenements.push(`${habitant.prenom} (${habitant.famille}) s’est éteint à ${age} ans.`);
        noter(etat, `${habitant.prenom} s’est éteint à ${age} ans`, 'deces');
        // L'héritage : la maison, le métier et la bourse passent aux enfants.
        const heritiers = habitant.enfants
          .map((id) => etat.habitants.find((h) => h.id === id))
          .filter((h) => h && h.vivant);
        if (heritiers.length) {
          const part = Math.floor(habitant.argent / heritiers.length);
          for (const heritier of heritiers) {
            heritier.argent += part;
            raconter(etat, heritier, `A hérité de ${habitant.prenom}.`);
          }
        }
        if (habitant.conjoint) {
          const conjoint = etat.habitants.find((h) => h.id === habitant.conjoint);
          if (conjoint) conjoint.conjoint = null;
        }
      }
    }

    // Mariages : deux adultes libres, sans parent commun, et un toit disponible.
    const libres = etat.habitantsVivants().filter((h) => h.age >= 17 && h.age < 55 && !h.conjoint);
    const hommes = libres.filter((h) => h.sexe === 'homme');
    const femmes = libres.filter((h) => h.sexe === 'femme');
    const { places } = loger(etat);
    for (const homme of hommes) {
      if (etat.habitantsVivants().length >= places) break;
      const compatible = femmes.find(
        (f) => !f.conjoint && !f.parents.some((p) => homme.parents.includes(p)) && Math.abs(f.age - homme.age) < 16
      );
      if (!compatible || tirer(etat) > 0.55) continue;
      homme.conjoint = compatible.id;
      compatible.conjoint = homme.id;
      raconter(etat, homme, `Marié à ${compatible.prenom}.`);
      raconter(etat, compatible, `Mariée à ${homme.prenom}.`);
      evenements.push(`${homme.prenom} et ${compatible.prenom} se sont mariés.`);
    }

    // Naissances : il faut un couple, un toit libre et de quoi manger.
    const nourritureOk = manques.manqueNourriture === 0;
    for (const mere of etat.habitantsVivants()) {
      if (mere.sexe !== 'femme' || !mere.conjoint || mere.age < 18 || mere.age > 42) continue;
      if (etat.habitantsVivants().length >= places || !nourritureOk) break;
      if (tirer(etat) > 0.34) continue;
      const pere = etat.habitants.find((h) => h.id === mere.conjoint);
      const sexe = tirer(etat) < 0.5 ? 'homme' : 'femme';
      const enfant = creerHabitant(etat, {
        prenom: parmi(etat, PRENOMS[sexe]),
        sexe,
        age: 0,
        famille: pere ? pere.famille : mere.famille,
        generation: Math.max(mere.generation, pere ? pere.generation : 1) + 1,
        parents: pere ? [mere.id, pere.id] : [mere.id],
      });
      mere.enfants.push(enfant.id);
      if (pere) pere.enfants.push(enfant.id);
      raconter(etat, enfant, `Né à Taddart, en l’an ${etat.annee}.`);
      evenements.push(`Naissance de ${enfant.prenom}, chez les ${enfant.famille}.`);
      noter(etat, `Naissance de ${enfant.prenom} (${enfant.famille})`, 'naissance');
    }

    repartirLesMetiers(etat);
    loger(etat);
    return evenements;
  }

  /* ------------------------------------------------------- Tajmaɛt */

  function proposerAssemblee(etat) {
    if (etat.decision || etat.compte('tajmaet') === 0) return;
    const dejaVues = etat.decisionsPassees || [];
    const possibles = DECISIONS.filter((d) => !dejaVues.includes(d.id));
    const choisie = possibles.length ? parmi(etat, possibles) : parmi(etat, DECISIONS);
    etat.decision = { id: choisie.id, annee: etat.annee, saison: etat.saison };
  }

  /** Applique l'option choisie. Renvoie un message, ou une raison de refus. */
  function trancher(etat, indexOption) {
    if (!etat.decision) return 'aucune assemblée en cours';
    const decision = DECISIONS.find((d) => d.id === etat.decision.id);
    const option = decision.options[indexOption];
    if (!option) return 'option inconnue';
    for (const [ressource, quantite] of Object.entries(option.cout || {})) {
      if (etat.ressources[ressource] < quantite) return `il manque : ${ressource}`;
    }
    for (const [ressource, quantite] of Object.entries(option.cout || {})) etat.ressources[ressource] -= quantite;

    const effets = option.effets || {};
    for (const [cle, valeur] of Object.entries(effets)) {
      if (cle === 'satisfaction') etat.bonus.satisfaction += valeur;
      else if (cle === 'rendementAgricole') etat.bonus.rendementAgricole += valeur;
      else if (cle === 'argentParSaison') etat.bonus.argentParSaison += valeur;
      else if (cle === 'reserveCommune') etat.bonus.reserveCommune = true;
      else if (cle === 'nouveauxHabitants') accueillirFamille(etat, valeur);
      else if (etat.ressources[cle] !== undefined) etat.ressources[cle] += valeur;
    }

    etat.assemblees += 1;
    etat.decisionsPassees = [...(etat.decisionsPassees || []), decision.id];
    etat.decision = null;
    noter(etat, option.memoire, 'assemblee');
    return null;
  }

  function accueillirFamille(etat, nombre) {
    const famille = parmi(etat, FAMILLES);
    for (let i = 0; i < nombre; i += 1) {
      const sexe = tirer(etat) < 0.5 ? 'homme' : 'femme';
      const age = i < 2 ? entre(etat, 24, 40) : entre(etat, 2, 14);
      const habitant = creerHabitant(etat, { prenom: parmi(etat, PRENOMS[sexe]), sexe, age, famille, generation: 1 });
      raconter(etat, habitant, `Arrivé à Taddart en l’an ${etat.annee}.`);
    }
    repartirLesMetiers(etat);
  }

  /* ------------------------------------------------------- Missions */

  function verifierMission(etat) {
    const mission = MISSIONS[etat.missionCourante];
    if (!mission) return null;
    const accomplie = mission.objectifs.every((objectif) => objectif.valeur(etat) >= objectif.cible);
    if (!accomplie) return null;

    etat.missionsFaites.push(mission.id);
    etat.missionCourante += 1;
    const recompense = mission.recompense || {};
    if (recompense.argent) etat.ressources.argent += recompense.argent;
    for (const id of recompense.museeIds || []) {
      if (!etat.musee.includes(id)) etat.musee.push(id);
    }
    noter(etat, `Mission accomplie : ${mission.titre}`, 'mission');
    return mission;
  }

  /* -------------------------------------------------- Mémoire du village */

  function noter(etat, texte, type) {
    etat.chronique.push({ annee: etat.annee, saison: SAISONS[etat.saison], texte, type });
    if (etat.chronique.length > 400) etat.chronique.shift();
  }

  /* ---------------------------------------------------------- Partie */

  function attacher(etat) {
    etat.compte = (type) => etat.batiments.filter((b) => b.type === type).length;
    etat.habitantsVivants = () => etat.habitants.filter((h) => h.vivant);
    etat.generationMax = () => etat.habitantsVivants().reduce((max, h) => Math.max(max, h.generation), 1);
    return etat;
  }

  function creerPartie(graine = Math.floor(Math.random() * 0xffffffff)) {
    const etat = attacher({
      version: 1,
      graine: graine >>> 0,
      rng: graine >>> 0,
      annee: 1,
      saison: 0,
      prochainId: 1,
      batiments: [],
      habitants: [],
      ressources: { eau: 60, cereales: 90, fruits: 30, olives: 0, huile: 6, bois: 40, pierre: 30, animaux: 6, artisanat: 4, argent: 180 },
      cumul: { cereales: 0, fruits: 0, olives: 0, huile: 0, bois: 0, pierre: 0, animaux: 0, artisanat: 0, argent: 0, eau: 0 },
      satisfaction: 58,
      bonus: { satisfaction: 0, rendementAgricole: 0, argentParSaison: 0, reserveCommune: false },
      missionCourante: 0,
      missionsFaites: [],
      assemblees: 0,
      decision: null,
      decisionsPassees: [],
      chronique: [],
      musee: [],
      rapport: null,
    });

    etat.carte = genererCarte(etat);
    installerLeVillage(etat);
    noter(etat, 'Taddart est fondé.', 'mission');
    return etat;
  }

  /** Pose le village de départ : place, tajmaɛt, cinq maisons, deux champs. */
  function installerLeVillage(etat) {
    const libres = [];
    for (let y = Math.floor(etat.carte.hauteur * 0.45); y < etat.carte.hauteur - 1; y += 1) {
      for (let x = 1; x < etat.carte.largeur - 1; x += 1) {
        const terrain = terrainDe(etat, x, y);
        if (terrain === 'prairie' || terrain === 'coteau') libres.push({ x, y, terrain });
      }
    }
    // On se serre autour d'un même point : l'habitat kabyle est groupé.
    const coeur = libres[Math.floor(libres.length / 2)] || { x: 3, y: etat.carte.hauteur - 4 };
    libres.sort(
      (a, b) => Math.hypot(a.x - coeur.x, a.y - coeur.y) - Math.hypot(b.x - coeur.x, b.y - coeur.y)
    );

    const poser = (type, filtre) => {
      const place = libres.find(
        (c) => !batimentEn(etat, c.x, c.y) && BATIMENTS[type].terrains.includes(c.terrain) && (!filtre || filtre(c))
      );
      if (!place) return false;
      const doyen = etat.habitants.length ? etat.habitants[0].prenom : null;
      etat.batiments.push({ id: etat.prochainId++, type, x: place.x, y: place.y, annee: 1, generationDe: doyen, travailleurs: [] });
      return true;
    };

    poser('tajmaet');
    poser('place');
    for (let i = 0; i < 5; i += 1) poser('maison');
    for (let i = 0; i < 2; i += 1) poser('champ', (c) => c.terrain === 'prairie');

    for (const fondateur of FONDATEURS) {
      const habitant = creerHabitant(etat, { ...fondateur, generation: 1 });
      raconter(etat, habitant, 'Parmi les fondateurs de Taddart.');
    }
    // Deux couples parmi les fondateurs, pour que le village ait une suite.
    const [ahmed, yamina, said, malika] = etat.habitants;
    ahmed.conjoint = yamina.id;
    yamina.conjoint = ahmed.id;
    said.conjoint = malika.id;
    malika.conjoint = said.id;

    while (etat.habitantsVivants().length < 18) {
      const sexe = tirer(etat) < 0.5 ? 'homme' : 'femme';
      const age = entre(etat, 1, 58);
      const habitant = creerHabitant(etat, {
        prenom: parmi(etat, PRENOMS[sexe]),
        sexe,
        age,
        famille: parmi(etat, FAMILLES),
        generation: 1,
      });
      raconter(etat, habitant, 'Présent à la fondation du village.');
    }

    repartirLesMetiers(etat);
    loger(etat);
  }

  /**
   * Une saison. C'est le seul point d'entrée du temps qui passe.
   */
  function avancerSaison(etat) {
    const production = produire(etat);
    const vente = vendreSurplus(etat);
    const manques = consommer(etat);
    const evenements = [];

    if (manques.manqueNourriture > 0) {
      evenements.push(`Les réserves n’ont pas suffi : il a manqué ${Math.ceil(manques.manqueNourriture)} parts de nourriture.`);
      noter(etat, 'Disette : les réserves n’ont pas suffi.', 'crise');
    }
    if (manques.manqueEau > 0) {
      evenements.push(`L’eau a manqué : ${Math.ceil(manques.manqueEau)} mesures de moins que le nécessaire.`);
      noter(etat, 'L’eau a manqué au village.', 'crise');
    }

    recalculerSatisfaction(etat, manques);
    // Le souvenir d'une bonne décision s'estompe. Sans cela les bonus
    // s'empilent, la jauge se colle à 100 et ne dit plus rien du village.
    etat.bonus.satisfaction *= 0.94;

    etat.saison += 1;
    if (etat.saison >= SAISONS.length) {
      etat.saison = 0;
      etat.annee += 1;
      evenements.push(...passerUneAnnee(etat, manques));
      proposerAssemblee(etat);
    }

    const mission = verifierMission(etat);
    if (mission) evenements.push(`Mission accomplie : ${mission.titre}.`);

    etat.rapport = { annee: etat.annee, saison: SAISONS[etat.saison], production, vente, manques, evenements };
    return etat.rapport;
  }

  /* --------------------------------------------------- Sauvegarde */

  // Les fonctions attachées ne sont pas sérialisées par JSON : rien à nettoyer.
  const serialiser = (etat) => JSON.stringify(etat);
  const deserialiser = (texte) => attacher(JSON.parse(texte));

  const MOTEUR = {
    LARGEUR,
    HAUTEUR,
    ADULTE,
    ANCIEN,
    TERRAIN_CLES,
    creerPartie,
    avancerSaison,
    construire,
    peutConstruire,
    trancher,
    proposerAssemblee,
    terrainDe,
    batimentEn,
    serialiser,
    deserialiser,
    attacher,
    noter,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = MOTEUR;
  else racineGlobale.MOTEUR_TADDART = MOTEUR;
})(typeof globalThis !== 'undefined' ? globalThis : this);
