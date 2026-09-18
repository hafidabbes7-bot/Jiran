'use strict';
/**
 * TADDART — données du jeu. Tout ce fichier est de la FICTION.
 *
 * Aucun habitant, aucun village, aucune mission décrite ici n'a existé. Les
 * missions s'inspirent d'un contexte historique documenté dans
 * donnees-histoire.js, mais elles ne racontent aucun fait : ce sont des
 * situations de gestion, écrites pour être jouées.
 *
 * Les bâtiments cherchent les formes de l'habitat kabyle plutôt qu'un décor
 * générique : maisons basses de pierre à toiture de tuiles, serrées les unes
 * contre les autres ; tajmaɛt couverte et ouverte sur la place ; minaret à
 * base carrée. Le dessin reste schématique — des formes, pas une reconstitution.
 */

(function (racineGlobale) {
  'use strict';

  const SAISONS = ['printemps', 'été', 'automne', 'hiver'];

  /** Terrains de la carte. « bati » dit si l'on peut y poser un bâtiment. */
  const TERRAINS = {
    montagne: { nom: 'Montagne', couleur: '#5a5f6e', bati: false },
    rocher: { nom: 'Rocaille', couleur: '#7a7566', bati: true },
    foret: { nom: 'Forêt', couleur: '#2f5d3a', bati: true },
    coteau: { nom: 'Coteau', couleur: '#7d7a42', bati: true },
    prairie: { nom: 'Terre cultivable', couleur: '#8d9a52', bati: true },
    eau: { nom: 'Eau', couleur: '#2d6f8f', bati: false },
  };

  const RESSOURCES = [
    { id: 'eau', nom: 'Eau', icone: '💧' },
    { id: 'cereales', nom: 'Céréales', icone: '🌾' },
    { id: 'fruits', nom: 'Fruits', icone: '🍇' },
    { id: 'olives', nom: 'Olives', icone: '🫒' },
    { id: 'huile', nom: 'Huile', icone: '🏺' },
    { id: 'bois', nom: 'Bois', icone: '🪵' },
    { id: 'pierre', nom: 'Pierre', icone: '🪨' },
    { id: 'animaux', nom: 'Troupeau', icone: '🐐' },
    { id: 'artisanat', nom: 'Artisanat', icone: '🧺' },
    { id: 'argent', nom: 'Argent', icone: '🪙' },
  ];

  /**
   * Bâtiments.
   *
   * « emplois » : nombre d'habitants adultes que le bâtiment occupe.
   * « produit » : par saison et par travailleur, modulé par la saison — un
   * champ ne donne rien en hiver, une oliveraie donne à l'automne.
   */
  const BATIMENTS = {
    maison: {
      nom: 'Maison',
      description: 'Maison basse en pierre, toit de tuiles. Loge quatre personnes.',
      cout: { argent: 40, bois: 6, pierre: 4 },
      terrains: ['prairie', 'coteau', 'rocher'],
      loge: 4,
      emplois: 0,
    },
    tajmaet: {
      nom: 'Tajmaɛt',
      description: 'Lieu couvert où se tient l’assemblée du village, ouvert sur la place.',
      cout: { argent: 120, bois: 14, pierre: 18 },
      terrains: ['prairie', 'coteau', 'rocher'],
      emplois: 0,
      unique: true,
    },
    fontaine: {
      nom: 'Fontaine',
      description: 'Bassin maçonné alimenté par la source. À construire au bord de l’eau.',
      cout: { argent: 60, pierre: 12 },
      terrains: ['prairie', 'coteau', 'rocher'],
      pres_de: 'eau',
      emplois: 1,
      produit: { eau: 34 },
      saisons: { printemps: 1.2, été: 0.85, automne: 1, hiver: 1.05 },
    },
    champ: {
      nom: 'Champ de céréales',
      description: 'Orge et blé, semés à l’automne, moissonnés au début de l’été.',
      cout: { argent: 30, bois: 2 },
      terrains: ['prairie'],
      emplois: 2,
      produit: { cereales: 7 },
      consomme: { eau: 2 },
      saisons: { printemps: 0.3, été: 2.4, automne: 0.4, hiver: 0 },
    },
    oliveraie: {
      nom: 'Oliveraie',
      description: 'Oliviers de coteau. La cueillette occupe la fin de l’automne.',
      cout: { argent: 45, bois: 3 },
      terrains: ['coteau', 'prairie'],
      emplois: 2,
      produit: { olives: 6 },
      consomme: { eau: 1 },
      saisons: { printemps: 0.1, été: 0.2, automne: 2.6, hiver: 0.3 },
    },
    verger: {
      nom: 'Verger de figuiers',
      description: 'Figuiers et arbres fruitiers, au plus près des maisons.',
      cout: { argent: 40, bois: 3 },
      terrains: ['coteau', 'prairie'],
      emplois: 1,
      produit: { fruits: 6 },
      consomme: { eau: 2 },
      saisons: { printemps: 0.4, été: 1.8, automne: 1.4, hiver: 0.1 },
    },
    bergerie: {
      nom: 'Bergerie',
      description: 'Chèvres et moutons, menés aux pâtures de la montagne.',
      cout: { argent: 70, bois: 8, pierre: 4 },
      terrains: ['coteau', 'rocher', 'prairie'],
      emplois: 2,
      produit: { animaux: 1.4, fruits: 2 },
      consomme: { eau: 3 },
      saisons: { printemps: 1.3, été: 1, automne: 1, hiver: 0.6 },
    },
    cabane: {
      nom: 'Coupe de bois',
      description: 'Abri de bûcheron, en lisière de forêt.',
      cout: { argent: 35, pierre: 2 },
      terrains: ['foret'],
      emplois: 2,
      produit: { bois: 6 },
      saisons: { printemps: 1, été: 1.2, automne: 1, hiver: 0.7 },
    },
    carriere: {
      nom: 'Carrière',
      description: 'Extraction de la pierre de construction.',
      cout: { argent: 50, bois: 4 },
      terrains: ['rocher', 'montagne'],
      emplois: 2,
      produit: { pierre: 5 },
      saisons: { printemps: 1, été: 1.1, automne: 1, hiver: 0.6 },
    },
    moulin: {
      nom: 'Moulin à huile',
      description: 'Meule de pierre : les olives deviennent de l’huile.',
      cout: { argent: 90, bois: 10, pierre: 14 },
      terrains: ['prairie', 'coteau'],
      emplois: 2,
      transforme: { depuis: { olives: 6 }, vers: { huile: 3 } },
      saisons: { printemps: 0.4, été: 0.4, automne: 2, hiver: 1.4 },
    },
    atelier: {
      nom: 'Atelier',
      description: 'Poterie, tissage, vannerie — les mains du village.',
      cout: { argent: 80, bois: 10, pierre: 6 },
      terrains: ['prairie', 'coteau', 'rocher'],
      emplois: 3,
      transforme: { depuis: { bois: 2, animaux: 0.4 }, vers: { artisanat: 3 } },
      saisons: { printemps: 1, été: 1, automne: 1, hiver: 1.2 },
    },
    marche: {
      nom: 'Marché',
      description: 'Le jour de marché, l’huile et les poteries partent vers la vallée.',
      cout: { argent: 120, bois: 12, pierre: 8 },
      terrains: ['prairie', 'coteau'],
      emplois: 2,
      entretien: 3,
      transforme: { depuis: { artisanat: 2, huile: 1 }, vers: { argent: 26 } },
      saisons: { printemps: 1, été: 1.1, automne: 1.3, hiver: 0.8 },
    },
    ecole: {
      nom: 'École',
      description: 'Une salle, des bancs. Les enfants y apprennent à lire et à compter.',
      cout: { argent: 150, bois: 14, pierre: 16 },
      terrains: ['prairie', 'coteau'],
      emplois: 1,
      entretien: 5,
      unique: true,
      effets: { satisfaction: 8, instruction: 1 },
    },
    soins: {
      nom: 'Centre de soins',
      description: 'De quoi soigner les fièvres et assister les naissances.',
      cout: { argent: 180, bois: 12, pierre: 18 },
      terrains: ['prairie', 'coteau'],
      emplois: 2,
      entretien: 6,
      unique: true,
      effets: { satisfaction: 6, sante: 10 },
    },
    mosquee: {
      nom: 'Mosquée',
      description: 'Salle de prière et minaret à base carrée, comme au Maghreb.',
      cout: { argent: 160, bois: 12, pierre: 22 },
      terrains: ['prairie', 'coteau'],
      emplois: 0,
      entretien: 3,
      unique: true,
      effets: { satisfaction: 9 },
    },
    bibliotheque: {
      nom: 'Bibliothèque',
      description: 'On y garde les registres du village, et ce qui vient de Béjaïa.',
      cout: { argent: 200, bois: 16, pierre: 18 },
      terrains: ['prairie', 'coteau'],
      emplois: 1,
      entretien: 4,
      unique: true,
      effets: { satisfaction: 7 },
    },
    musee: {
      nom: 'Musée de la mémoire',
      description: 'Ce que le village a décidé de ne pas oublier.',
      cout: { argent: 300, bois: 20, pierre: 26 },
      terrains: ['prairie', 'coteau'],
      emplois: 1,
      entretien: 6,
      unique: true,
      effets: { satisfaction: 12 },
    },
    place: {
      nom: 'Place du village',
      description: 'Le terre-plein devant la tajmaɛt, où l’on se réunit et où jouent les enfants.',
      cout: { argent: 50, pierre: 8 },
      terrains: ['prairie', 'coteau', 'rocher'],
      emplois: 0,
      unique: true,
      effets: { satisfaction: 5 },
    },
    chemin: {
      nom: 'Chemin',
      description: 'Un passage empierré entre les maisons et les terres.',
      cout: { argent: 10, pierre: 2 },
      terrains: ['prairie', 'coteau', 'rocher', 'foret'],
      emplois: 0,
      effets: { satisfaction: 0.4 },
    },
  };

  /** Prénoms kabyles courants, pour les habitants engendrés par le jeu. */
  const PRENOMS = {
    homme: ['Ahmed', 'Saïd', 'Aksel', 'Mokrane', 'Idir', 'Amar', 'Slimane', 'Hocine', 'Belaïd', 'Mouloud', 'Arezki', 'Rabah', 'Boussad', 'Youcef', 'Meziane', 'Lounis', 'Smaïl', 'Tahar'],
    femme: ['Yamina', 'Malika', 'Tassadit', 'Ouardia', 'Djohra', 'Fadhma', 'Dihya', 'Zohra', 'Taous', 'Chabha', 'Ferroudja', 'Nouara', 'Lounja', 'Saliha', 'Dahbia', 'Kahina', 'Hassina', 'Kamila'],
  };

  /** Noms de familles inventés, formés sur « At » (ceux de). */
  const FAMILLES = ['At Yidir', 'At Meziane', 'At Saadi', 'At Ouali', 'At Braham', 'At Amrane', 'At Larbi', 'At Djoudi'];

  /** Les cinq fondateurs, tels que demandés. Personnages fictifs. */
  const FONDATEURS = [
    { prenom: 'Ahmed', sexe: 'homme', age: 42, metier: 'agriculteur', famille: 'At Yidir' },
    { prenom: 'Yamina', sexe: 'femme', age: 39, metier: 'artisan', famille: 'At Yidir' },
    { prenom: 'Saïd', sexe: 'homme', age: 47, metier: 'berger', famille: 'At Meziane' },
    { prenom: 'Malika', sexe: 'femme', age: 35, metier: 'commerçant', famille: 'At Saadi' },
    { prenom: 'Aksel', sexe: 'homme', age: 15, metier: 'apprenti', famille: 'At Meziane' },
  ];

  const METIERS = {
    'sans emploi': { nom: 'Sans emploi' },
    apprenti: { nom: 'Apprenti' },
    enfant: { nom: 'Enfant' },
    ancien: { nom: 'Ancien' },
    agriculteur: { nom: 'Agriculteur', batiment: 'champ' },
    oleiculteur: { nom: 'Oléiculteur', batiment: 'oliveraie' },
    arboriculteur: { nom: 'Arboriculteur', batiment: 'verger' },
    berger: { nom: 'Berger', batiment: 'bergerie' },
    bucheron: { nom: 'Bûcheron', batiment: 'cabane' },
    carrier: { nom: 'Carrier', batiment: 'carriere' },
    meunier: { nom: 'Meunier', batiment: 'moulin' },
    artisan: { nom: 'Artisan', batiment: 'atelier' },
    'commerçant': { nom: 'Commerçant', batiment: 'marche' },
    'porteur d’eau': { nom: 'Porteur d’eau', batiment: 'fontaine' },
    enseignant: { nom: 'Enseignant', batiment: 'ecole' },
    soignant: { nom: 'Soignant', batiment: 'soins' },
    bibliothecaire: { nom: 'Bibliothécaire', batiment: 'bibliotheque' },
    conservateur: { nom: 'Conservateur', batiment: 'musee' },
  };

  /**
   * Décisions de la tajmaɛt.
   *
   * Mécanique INSPIRÉE de l'organisation communautaire villageoise kabyle, et
   * non reproduction de règles historiques : l'assemblée réelle ne se réduisait
   * pas à trois boutons. Voir la fiche « La tajmaɛt » dans l'écran Histoire.
   */
  const DECISIONS = [
    {
      id: 'source',
      titre: 'La source coule mal',
      contexte: 'Le débit de la source a baissé depuis deux saisons. Les femmes descendent plus bas pour remplir les jarres.',
      options: [
        { texte: 'Réparer le captage en tiwizi', cout: { pierre: 8 }, effets: { eau: 40, satisfaction: 6 }, memoire: 'La source a été réparée par un travail collectif.' },
        { texte: 'Payer un maçon de la vallée', cout: { argent: 90 }, effets: { eau: 55, satisfaction: 2 }, memoire: 'Un maçon venu de la vallée a repris le captage de la source.' },
        { texte: 'Attendre les pluies', cout: {}, effets: { satisfaction: -6 }, memoire: 'L’assemblée a choisi d’attendre les pluies.' },
      ],
    },
    {
      id: 'chemin',
      titre: 'Le chemin des terres',
      contexte: 'Le chemin qui mène aux champs se défait à chaque hiver. Les bêtes chargées y glissent.',
      options: [
        { texte: 'Empierrer le chemin en tiwizi', cout: { pierre: 12 }, effets: { satisfaction: 7, argentParSaison: 3 }, memoire: 'Le chemin des terres a été empierré par le village entier.' },
        { texte: 'Le laisser en l’état', cout: {}, effets: { satisfaction: -4 }, memoire: 'L’assemblée a remis à plus tard la réfection du chemin.' },
      ],
    },
    {
      id: 'tiwizi-moisson',
      titre: 'La moisson d’une famille',
      contexte: 'Une famille a perdu son aîné avant la moisson. Ses champs sont mûrs et personne ne peut les couper.',
      options: [
        { texte: 'Organiser une tiwizi pour eux', cout: {}, effets: { cereales: 35, satisfaction: 10 }, memoire: 'Le village a moissonné les champs d’une famille endeuillée.' },
        { texte: 'Leur avancer de l’argent', cout: { argent: 70 }, effets: { satisfaction: 3 }, memoire: 'L’assemblée a avancé de l’argent à une famille endeuillée.' },
      ],
    },
    {
      id: 'conflit',
      titre: 'Un différend entre voisins',
      contexte: 'Deux familles se disputent la limite d’un verger. Le ton est monté sur la place.',
      options: [
        { texte: 'Arbitrer, et faire appliquer la décision', cout: {}, effets: { satisfaction: 8 }, memoire: 'L’assemblée a tranché un différend de limite entre deux familles.' },
        { texte: 'Renvoyer les familles dos à dos', cout: {}, effets: { satisfaction: -8 }, memoire: 'L’assemblée n’a pas tranché le différend des deux familles.' },
        { texte: 'Racheter la parcelle pour le village', cout: { argent: 120 }, effets: { satisfaction: 5 }, memoire: 'Le village a racheté la parcelle disputée pour en faire un bien commun.' },
      ],
    },
    {
      id: 'espace-commun',
      titre: 'Un espace pour la place',
      contexte: 'La place est trop étroite les jours d’assemblée, et les enfants n’ont nulle part où jouer.',
      options: [
        { texte: 'Élargir la place et planter un frêne', cout: { argent: 60, bois: 6 }, effets: { satisfaction: 12 }, memoire: 'La place du village a été élargie, et un frêne y a été planté.' },
        { texte: 'Garder la terre pour les cultures', cout: {}, effets: { cereales: 20, satisfaction: -3 }, memoire: 'L’assemblée a préféré garder la terre pour les cultures.' },
      ],
    },
    {
      id: 'agriculture',
      titre: 'Investir dans les terres',
      contexte: 'Les récoltes plafonnent. Certains proposent d’acheter des semences et de refaire les murets de soutènement.',
      options: [
        { texte: 'Acheter semences et refaire les murets', cout: { argent: 140, pierre: 10 }, effets: { rendementAgricole: 0.15, satisfaction: 4 }, memoire: 'Le village a investi dans ses terres : semences neuves et murets refaits.' },
        { texte: 'Garder l’argent pour l’hiver', cout: {}, effets: { satisfaction: -2 }, memoire: 'L’assemblée a gardé l’argent en réserve pour l’hiver.' },
      ],
    },
    {
      id: 'famille',
      titre: 'Une famille demande à s’installer',
      contexte: 'Une famille de quatre personnes, chassée par la sécheresse, demande une place au village.',
      options: [
        { texte: 'L’accueillir et lui attribuer une maison', cout: { cereales: 30 }, effets: { nouveauxHabitants: 4, satisfaction: 6 }, memoire: 'Le village a accueilli une famille venue de la sécheresse.' },
        { texte: 'L’aider et la laisser passer son chemin', cout: { cereales: 15 }, effets: { satisfaction: -2 }, memoire: 'L’assemblée a aidé une famille de passage sans l’installer.' },
      ],
    },
    {
      id: 'grenier',
      titre: 'Un grenier commun',
      contexte: 'Un ancien rappelle qu’un village sans réserve commune est un village à la merci d’une mauvaise année.',
      options: [
        { texte: 'Bâtir un grenier commun', cout: { argent: 100, pierre: 14, bois: 8 }, effets: { satisfaction: 9, reserveCommune: 1 }, memoire: 'Un grenier commun a été bâti pour les mauvaises années.' },
        { texte: 'Que chaque famille garde sa réserve', cout: {}, effets: { satisfaction: -1 }, memoire: 'L’assemblée a laissé chaque famille garder sa propre réserve.' },
      ],
    },
  ];

  /**
   * Les dix missions de la V1. Toutes FICTION, sans exception.
   *
   * Chaque objectif se mesure : « valeur » lit l'état, « cible » dit où aller.
   * L'interface en tire une barre de progression sans rien coder de plus.
   */
  const MISSIONS = [
    {
      numero: 1,
      id: 'fonder',
      titre: 'Fonder Taddart',
      resume: 'Cinq maisons et dix-huit personnes. Il faut de la place et de quoi manger.',
      statut: 'FICTION',
      objectifs: [
        { texte: 'Bâtir une sixième maison', cible: 6, valeur: (e) => e.compte('maison') },
        { texte: 'Ouvrir un champ de céréales', cible: 1, valeur: (e) => e.compte('champ') },
      ],
      recompense: { argent: 60 },
    },
    {
      numero: 2,
      id: 'eau',
      titre: 'L’eau d’abord',
      resume: 'Aucun village kabyle ne s’installe loin d’un point d’eau. Captez la source.',
      statut: 'FICTION',
      objectifs: [
        { texte: 'Construire une fontaine au bord de l’eau', cible: 1, valeur: (e) => e.compte('fontaine') },
        { texte: 'Tenir 80 mesures d’eau en réserve', cible: 80, valeur: (e) => Math.floor(e.ressources.eau) },
      ],
      recompense: { argent: 70 },
    },
    {
      numero: 3,
      id: 'agriculture',
      titre: 'Le pain de l’année',
      resume: 'L’orge se sème à l’automne et se moissonne au début de l’été. Trois champs valent mieux qu’un.',
      statut: 'FICTION',
      objectifs: [
        { texte: 'Cultiver trois champs', cible: 3, valeur: (e) => e.compte('champ') },
        { texte: 'Récolter 150 mesures de céréales en tout', cible: 150, valeur: (e) => Math.floor(e.cumul.cereales) },
      ],
      recompense: { argent: 80 },
    },
    {
      numero: 4,
      id: 'tajmaet',
      titre: 'Réunir la tajmaɛt',
      resume:
        'Le village ne se dirige pas tout seul. Réunissez l’assemblée et tranchez. Mécanique inspirée de l’organisation communautaire villageoise kabyle — voir la fiche dans l’écran Histoire.',
      statut: 'FICTION',
      objectifs: [
        { texte: 'Tenir deux assemblées et décider', cible: 2, valeur: (e) => e.assemblees },
      ],
      recompense: { argent: 90 },
    },
    {
      numero: 5,
      id: 'artisanat',
      titre: 'Les mains du village',
      resume: 'Poterie, tissage, vannerie : ce que la terre ne donne pas, les mains le font.',
      statut: 'FICTION',
      objectifs: [
        { texte: 'Ouvrir un atelier', cible: 1, valeur: (e) => e.compte('atelier') },
        { texte: 'Produire 40 objets artisanaux', cible: 40, valeur: (e) => Math.floor(e.cumul.artisanat) },
      ],
      recompense: { argent: 110 },
    },
    {
      numero: 6,
      id: 'commerce',
      titre: 'Le jour de marché',
      resume: 'L’huile et les poteries descendent vers la vallée, et l’argent remonte.',
      statut: 'FICTION',
      objectifs: [
        { texte: 'Construire un marché', cible: 1, valeur: (e) => e.compte('marche') },
        { texte: 'Réunir 500 pièces', cible: 500, valeur: (e) => Math.floor(e.ressources.argent) },
      ],
      recompense: { argent: 0, museeIds: ['bougie-cire'] },
    },
    {
      numero: 7,
      id: 'developpement',
      titre: 'Le village grandit',
      resume: 'Douze maisons, une école, et des gens qui restent.',
      statut: 'FICTION',
      objectifs: [
        { texte: 'Atteindre douze maisons', cible: 12, valeur: (e) => e.compte('maison') },
        { texte: 'Construire l’école', cible: 1, valeur: (e) => e.compte('ecole') },
        { texte: 'Satisfaction à 60', cible: 60, valeur: (e) => Math.floor(e.satisfaction) },
      ],
      recompense: { argent: 150 },
    },
    {
      numero: 8,
      id: 'bejaia',
      titre: 'Ce qui vient de Béjaïa',
      resume:
        'Le port de la côte n’est pas qu’un marché : c’est une bibliothèque à ciel ouvert. Bâtissez la vôtre pour en garder trace.',
      statut: 'FICTION',
      objectifs: [
        { texte: 'Construire la bibliothèque', cible: 1, valeur: (e) => e.compte('bibliotheque') },
      ],
      recompense: {
        argent: 60,
        museeIds: ['saldae-romaine', 'aqueduc-saldae', 'qalaa-beni-hammad', 'bejaia-hammadide', 'bejaia-mediterranee', 'bejaia-moderne'],
      },
    },
    {
      numero: 9,
      id: 'annees-difficiles',
      titre: 'Les années difficiles',
      resume:
        'Une période de tension et de disette. Tenez le village debout : les réserves, l’eau, les familles.',
      statut: 'FICTION',
      note:
        'SIMULATION DE GESTION inspirée du contexte des campagnes françaises en Kabylie entre 1844 et 1857. Les événements que vous vivez ici sont inventés. Les faits documentés de cette période sont présentés séparément, dans les fiches HISTORIQUE de l’écran Histoire.',
      statutHistorique: ['boubaghla', 'fadhma-nsoumer', 'campagne-1857'],
      objectifs: [
        { texte: 'Compter au moins 22 habitants', cible: 22, valeur: (e) => e.habitantsVivants().length },
        { texte: 'Constituer 200 mesures de nourriture', cible: 200, valeur: (e) => Math.floor(e.ressources.cereales + e.ressources.fruits) },
        { texte: 'Garder la satisfaction au-dessus de 45', cible: 45, valeur: (e) => Math.floor(e.satisfaction) },
      ],
      recompense: { argent: 120, museeIds: ['boubaghla', 'fadhma-nsoumer', 'campagne-1857', 'insurrection-1871'] },
    },
    {
      numero: 10,
      id: 'generations',
      titre: 'Transmettre',
      resume: 'Un village tient quand ceux qui y sont nés y restent, et bâtissent à leur tour.',
      statut: 'FICTION',
      objectifs: [
        { texte: 'Voir naître la troisième génération', cible: 3, valeur: (e) => e.generationMax() },
        { texte: 'Construire le Musée de la mémoire', cible: 1, valeur: (e) => e.compte('musee') },
      ],
      recompense: { argent: 200, museeIds: ['tajmaat-institution', 'tiwizi'] },
    },
  ];

  const JEU = { SAISONS, TERRAINS, RESSOURCES, BATIMENTS, PRENOMS, FAMILLES, FONDATEURS, METIERS, DECISIONS, MISSIONS };

  if (typeof module !== 'undefined' && module.exports) module.exports = JEU;
  else racineGlobale.JEU_TADDART = JEU;
})(typeof globalThis !== 'undefined' ? globalThis : this);
