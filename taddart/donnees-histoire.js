'use strict';
/**
 * TADDART — corpus historique.
 *
 * RÈGLE ABSOLUE DE CE FICHIER : rien de ce qui porte le statut « HISTORICAL »
 * n'est inventé. Chaque fiche porte une source consultable. Aucune citation
 * n'est attribuée à un personnage historique — le jeu décrit, il ne fait pas
 * parler les morts.
 *
 * Là où les sources divergent (le jour exact d'une capture, le nom réel d'un
 * chef), la fiche le dit au lieu de trancher : c'est le champ « precaution ».
 *
 * Tout ce qui relève du village du joueur — ses habitants, ses décisions, ses
 * missions — vit dans donnees-jeu.js et porte le statut « FICTION ». Les deux
 * ne se mélangent jamais, ni dans les données, ni à l'écran.
 */

(function (racineGlobale) {
  'use strict';

  /** Sources institutionnelles et universitaires, citées par les fiches. */
  const SOURCES = {
    unesco102: {
      nom: 'UNESCO, Centre du patrimoine mondial — « Al Qal’a des Beni Hammad »',
      url: 'https://whc.unesco.org/fr/list/102/',
    },
    encyclopedieBejaia: {
      nom: 'Encyclopédie berbère, notice « Béjaïa » (OpenEdition Journals)',
      url: 'https://journals.openedition.org/encyclopedieberbere/1507',
    },
    encyclopedie1871: {
      nom: 'Encyclopédie berbère, notice « Kabylie : l’insurrection de 1871 » (OpenEdition Journals)',
      url: 'https://journals.openedition.org/encyclopedieberbere/1410',
    },
    bnf1871: {
      nom: 'Bibliothèque nationale de France — « L’insurrection de la Grande Kabylie en 1871 »',
      url: 'https://www.bnf.fr/fr/mediatheque/linsurrection-de-la-grande-kabylie-en-1871',
    },
    halSaldae: {
      nom: 'S. Djermoune, « Le Librator Nonius Datus et l’aqueduc de Saldae », HAL, Université Toulouse–Jean Jaurès',
      url: 'https://univ-tlse2.hal.science/hal-01325522',
    },
    insaniyat: {
      nom: 'Insaniyat, revue du CRASC — recherches sur la tajmaɛt et le village kabyle',
      url: 'https://journals.openedition.org/insaniyat/',
    },
    mahe: {
      nom: 'Alain Mahé, « Histoire de la Grande Kabylie, XIXe-XXe siècles. Anthropologie historique du lien social dans les communautés villageoises », Bouchène, 2001',
      url: '',
    },
    cnrtlBougie: {
      nom: 'CNRTL (CNRS) — étymologie du mot « bougie »',
      url: 'https://www.cnrtl.fr/etymologie/bougie',
    },
  };

  /**
   * Faits documentés. Champs imposés : id, title, date, region, description,
   * status, source. « status » vaut toujours HISTORICAL ici.
   */
  const HISTORICAL_EVENTS = [
    {
      id: 'saldae-romaine',
      title: 'Saldae, port de l’Afrique romaine',
      date: 'Ier siècle av. J.-C. – IIIe siècle',
      region: 'Béjaïa (Saldae)',
      categorie: 'lieu',
      description:
        'Le site de l’actuelle Béjaïa porte à l’époque romaine le nom de Saldae. C’est un port de l’Afrique romaine, relié à l’intérieur des terres et intégré au réseau des cités de la côte. Le nom antique est resté attaché à la ville dans la documentation savante.',
      precaution:
        'Le jeu ne reconstitue pas la ville antique : il signale seulement que le site est occupé et nommé depuis l’Antiquité.',
      status: 'HISTORICAL',
      source: SOURCES.encyclopedieBejaia,
    },
    {
      id: 'aqueduc-saldae',
      title: 'L’aqueduc de Saldae et le récit de Nonius Datus',
      date: 'IIe siècle (chantier vers 147-152)',
      region: 'De Toudja à Béjaïa',
      categorie: 'document',
      description:
        'Un aqueduc conduisait l’eau des sources de Toudja jusqu’à Saldae. Son tracé comportait un tunnel percé sous la montagne. Une inscription retrouvée à Lambèse en 1866 conserve le récit de l’ingénieur (librator) Nonius Datus : les deux équipes creusant l’une vers l’autre s’étaient manquées sous la roche, et il fallut relier les deux galeries. C’est l’un des rares témoignages techniques directs d’un chantier romain.',
      precaution:
        'Le texte de l’inscription n’est pas reproduit ici : le jeu en résume le contenu, sans en donner de traduction prêtée à l’auteur.',
      status: 'HISTORICAL',
      source: SOURCES.halSaldae,
    },
    {
      id: 'qalaa-beni-hammad',
      title: 'La Qal’a des Beni Hammad',
      date: 'Fondée en 1007 — site ruiné au XIIe siècle',
      region: 'Monts du Hodna, wilaya de M’Sila',
      categorie: 'patrimoine',
      description:
        'Première capitale de la dynastie hammadide, cité fortifiée dont subsistent l’enceinte, des ensembles résidentiels, un palais et le minaret de la grande mosquée. Le site est inscrit sur la Liste du patrimoine mondial de l’UNESCO depuis 1980.',
      precaution: 'Le site n’est pas en Kabylie : il est cité parce que l’histoire de Béjaïa en découle directement.',
      status: 'HISTORICAL',
      source: SOURCES.unesco102,
    },
    {
      id: 'bejaia-hammadide',
      title: 'Béjaïa, capitale hammadide',
      date: 'À partir de 1067',
      region: 'Béjaïa',
      categorie: 'evenement',
      description:
        'L’émir hammadide an-Nasir fait entreprendre des travaux sur le site de l’ancienne Saldae et lui donne le nom d’an-Nasiriya. Le transfert de la capitale depuis la Qal’a des Beni Hammad s’achève sous son successeur. La pression des nomades sur le Hodna et l’essor des échanges maritimes comptent parmi les raisons avancées par les historiens.',
      status: 'HISTORICAL',
      source: SOURCES.encyclopedieBejaia,
    },
    {
      id: 'bejaia-mediterranee',
      title: 'Béjaïa, port et foyer de savoirs en Méditerranée',
      date: 'XIe – XIVe siècle',
      region: 'Béjaïa',
      categorie: 'evenement',
      description:
        'Devenue capitale, la ville est l’un des grands ports du Maghreb médiéval, en relation avec les ports italiens et catalans. On y échange notamment la cire, les cuirs et les produits agricoles de l’arrière-pays. C’est aussi un centre d’enseignement fréquenté par des lettrés venus de tout le bassin méditerranéen.',
      status: 'HISTORICAL',
      source: SOURCES.encyclopedieBejaia,
    },
    {
      id: 'bougie-cire',
      title: 'Le mot « bougie » vient du nom de la ville',
      date: 'Attesté en français médiéval',
      region: 'Béjaïa / Bougie',
      categorie: 'objet',
      description:
        'Le français « bougie » — la chandelle — tire son nom de Bougie, forme française du nom de Béjaïa, en raison du commerce de cire dont la ville était un point d’exportation. C’est une trace linguistique durable de l’activité marchande du port.',
      status: 'HISTORICAL',
      source: SOURCES.cnrtlBougie,
    },
    {
      id: 'tajmaat-institution',
      title: 'La tajmaɛt, assemblée du village',
      date: 'Documentée aux XIXe et XXe siècles',
      region: 'Kabylie',
      categorie: 'patrimoine',
      description:
        'Dans les villages kabyles, la tajmaɛt désigne à la fois l’assemblée des hommes adultes du village et le lieu couvert où elle se tient. Les travaux d’anthropologie et d’histoire lui reconnaissent trois fonctions récurrentes : édicter un règlement local (qanun), organiser les travaux collectifs, et arbitrer les différends entre habitants.',
      precaution:
        'Les formes concrètes varient d’un village à l’autre et selon les époques. Beaucoup de descriptions anciennes proviennent de compilations coloniales, à lire avec recul. Le jeu s’en inspire ; il ne les reproduit pas.',
      status: 'HISTORICAL',
      source: SOURCES.insaniyat,
    },
    {
      id: 'tiwizi',
      title: 'La tiwizi, entraide et travail collectif',
      date: 'Documentée aux XIXe et XXe siècles',
      region: 'Kabylie',
      categorie: 'patrimoine',
      description:
        'La tiwizi désigne le travail fourni collectivement et gratuitement par les villageois, pour un chantier d’intérêt commun ou au profit d’une famille : moisson, construction, réfection d’un chemin ou d’un point d’eau. Elle est décrite dans la littérature ethnographique comme l’un des ressorts de la vie villageoise.',
      status: 'HISTORICAL',
      source: SOURCES.insaniyat,
    },
    {
      id: 'boubaghla',
      title: 'Chérif Boubaghla',
      date: 'Vers 1851 – décembre 1854',
      region: 'Kabylie (région d’Akbou, vallée du Sebaou)',
      categorie: 'personnage',
      description:
        'Chef de la résistance à la conquête française apparu en Kabylie au début des années 1850. Il conduit des attaques contre les postes et les relais de l’administration coloniale et rallie plusieurs tribus. Il est tué en décembre 1854.',
      precaution:
        'Les sources divergent sur son nom réel, sur son origine et sur le jour exact de sa mort. Le jeu retient seulement ce qui est concordant. Aucune parole ne lui est prêtée.',
      status: 'HISTORICAL',
      source: SOURCES.mahe,
    },
    {
      id: 'fadhma-nsoumer',
      title: 'Lalla Fadhma N’Soumer',
      date: 'Vers 1830 – 1863',
      region: 'Djurdjura (région de Soumeur / Ouerdja)',
      categorie: 'personnage',
      description:
        'Figure de la résistance kabyle, liée au milieu religieux de la confrérie Rahmaniyya. Elle est associée aux combats menés aux côtés de Chérif Boubaghla, puis à la résistance opposée aux campagnes françaises de 1856-1857. Capturée en juillet 1857, elle est placée en résidence surveillée et meurt en 1863.',
      precaution:
        'Les sources donnent des dates différentes pour le jour de sa capture (11 ou 27 juillet 1857) : le jeu s’en tient au mois. Aucune citation ne lui est attribuée.',
      status: 'HISTORICAL',
      source: SOURCES.mahe,
    },
    {
      id: 'campagne-1857',
      title: 'La campagne de 1857 en Kabylie',
      date: 'Mai – juillet 1857',
      region: 'Djurdjura, pays des Aït Iraten',
      categorie: 'evenement',
      description:
        'Campagne militaire française conduite dans le massif du Djurdjura contre les confédérations villageoises encore indépendantes. Elle comporte de durs combats, dont celui d’Icheriden en juin 1857, et s’achève par la soumission des Aït Iraten et l’édification d’un fort au cœur du pays — Fort-Napoléon, plus tard Fort-National, aujourd’hui Larbaâ Nath Irathen.',
      precaution:
        'Le jeu ne met en scène aucun combat. Il place le joueur du côté de la vie quotidienne d’un village : les réserves, l’eau, les familles, les déplacements.',
      status: 'HISTORICAL',
      source: SOURCES.mahe,
    },
    {
      id: 'insurrection-1871',
      title: 'L’insurrection de 1871 en Grande Kabylie',
      date: 'Mars 1871 – janvier 1872',
      region: 'Grande Kabylie et au-delà',
      categorie: 'evenement',
      description:
        'Soulèvement déclenché en mars 1871 par le bachagha Mohamed El Mokrani. Le 8 avril 1871, le cheikh Aheddad, chef de la confrérie Rahmaniyya, appelle au soulèvement depuis Seddouk, ce qui étend considérablement le mouvement. El Mokrani est tué le 5 mai 1871 ; la lutte se poursuit sous la conduite de son frère Boumezrag jusqu’au début de 1872. La répression se traduit par des séquestres de terres, de lourdes contributions de guerre et des déportations.',
      precaution:
        'Les sources donnent le 15 ou le 16 mars pour le déclenchement : le jeu s’en tient au mois. Aucun dialogue n’est prêté à El Mokrani ni au cheikh Aheddad.',
      status: 'HISTORICAL',
      source: SOURCES.bnf1871,
    },
    {
      id: 'bejaia-moderne',
      title: 'Béjaïa aux XVIe siècle et après',
      date: 'XVIe siècle',
      region: 'Béjaïa',
      categorie: 'lieu',
      description:
        'La ville est prise par les Espagnols en 1510 et occupée plusieurs décennies, avant de passer sous autorité ottomane au milieu du XVIe siècle. Ces épisodes marquent la fin de son rôle de capitale régionale, mais la ville reste un port actif.',
      status: 'HISTORICAL',
      source: SOURCES.encyclopedieBejaia,
    },
  ];

  /** Texte affiché dans l’écran « Histoire », avant toute fiche. */
  const NOTE_METHODE = {
    titre: 'Ce que ce jeu affirme, et ce qu’il invente',
    paragraphes: [
      'Taddart mélange deux matières qui ne doivent jamais être confondues, et qui sont donc étiquetées partout dans le jeu.',
      'Les fiches marquées HISTORIQUE reposent sur des sources institutionnelles ou universitaires, indiquées sur chaque fiche. Quand les sources divergent — un jour de capture, un nom — la fiche le signale plutôt que de choisir. Aucune parole n’est attribuée à un personnage historique.',
      'Tout le reste — votre village, ses habitants, ses décisions, ses dix missions — est marqué FICTION DU JEU. Ces habitants n’ont jamais existé, et les situations que vous traversez sont des simulations inspirées d’un contexte, pas des faits.',
      'La mécanique de la tajmaɛt est inspirée de l’organisation communautaire villageoise kabyle telle que la décrivent les travaux de recherche. Ce n’est pas une reproduction des règles historiques : un jeu simplifie, et la réalité variait d’un village à l’autre.',
      'Enfin, le village que vous bâtissez est fictif. Il n’est la reconstitution d’aucun village réel, et sa carte n’est celle d’aucun lieu existant.',
    ],
  };

  const HISTOIRE = { SOURCES, HISTORICAL_EVENTS, NOTE_METHODE };

  if (typeof module !== 'undefined' && module.exports) module.exports = HISTOIRE;
  else racineGlobale.HISTOIRE_TADDART = HISTOIRE;
})(typeof globalThis !== 'undefined' ? globalThis : this);
