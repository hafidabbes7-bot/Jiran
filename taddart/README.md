# TADDART — MÉMOIRE DE KABYLIE (V1)

> Construis ton village. Vis son histoire. Transmets sa mémoire.

Jeu de village en 2D vu du dessus. Vous dirigez **Taddart**, un village kabyle
**fictif** : cinq maisons, dix-huit habitants, deux champs, un ruisseau. Les
saisons passent, les enfants deviennent adultes, les anciens s’éteignent, et le
village se transmet sur plusieurs générations.

En parallèle, un corpus d’histoire **documenté et sourcé** se débloque au fil des
missions. Les deux ne se mélangent jamais.

---

## La règle qui commande tout le reste

Ce jeu parle d’un patrimoine réel. Il tient donc deux matières séparées, et
étiquetées partout :

| | |
| --- | --- |
| **HISTORIQUE** | Des faits documentés. Chaque fiche porte sa source, consultable en ligne. Quand les sources divergent — le jour d’une capture, le nom d’un chef — la fiche le dit au lieu de trancher. **Aucune parole n’est attribuée à un personnage historique.** |
| **FICTION DU JEU** | Votre village, ses habitants, ses dix missions. Rien de tout cela n’a existé. Les missions inspirées d’un contexte historique le déclarent explicitement. |

La distinction passe par le code (`status: 'HISTORICAL'` contre `statut: 'FICTION'`),
par la couleur des étiquettes à l’écran, et par une note de méthode affichée en
tête de l’écran Histoire. Le vérificateur automatique refuse de passer si une
fiche perd sa source ou si une mission se présente comme un fait.

---

## Structure des fichiers

```
taddart/
├── index.html              la page du jeu (à ouvrir)
├── style.css               habillage : terre, chaux, tuile, olivier
├── donnees-histoire.js     LE CORPUS HISTORIQUE — 13 fiches sourcées
├── donnees-jeu.js          bâtiments, missions, décisions, prénoms — tout est FICTION
├── moteur.js               la simulation : carte, ressources, population, générations
├── game.js                 l’interface : carte dessinée, panneaux, sauvegarde
├── taddart-autonome.html   LE JEU ENTIER EN UN SEUL FICHIER (113 ko, pour le téléphone)
├── package.json            trois commandes, aucune dépendance
├── outils/
│   ├── serveur.mjs             petit serveur local pour tester sur téléphone
│   └── construire-autonome.mjs refabrique le fichier unique
└── tests/
    └── verifier.mjs        vérifie le corpus historique ET la simulation
```

Aucune bibliothèque, aucune image, aucune police téléchargée, aucun serveur
obligatoire, aucune connexion Internet.

**Pourquoi `moteur.js` est séparé de `game.js`** : le moteur ne touche jamais à la
page. On peut donc faire tourner des villages entiers dans Node et *vérifier*
qu’ils vivent, au lieu de l’espérer.

---

## Y jouer

**Le plus simple** : double-cliquer sur `index.html`.

- **JOUER** fonde un village neuf. **CONTINUER** reprend la sauvegarde.
- Le temps avance tout seul, une saison à la fois. Le bouton `▶ ×1` fait défiler
  **pause → ×1 → ×2 → ×4**.
- **CONSTRUIRE** : choisissez un bâtiment, les cases où il peut aller
  s’encadrent d’or, touchez-en une.
- Touchez n’importe quelle case pour l’examiner. Un bâtiment vous répond par sa
  mémoire : *« Maison. Bâtie en l’an 7, sous la génération d’Ahmed. 2 sur 4
  postes tenus. »*
- **Une pastille orange sur un bâtiment** veut dire qu’il manque de bras : il ne
  produit qu’à proportion des postes tenus. Une pastille rouge : personne n’y
  travaille, il ne produit rien.

Les six panneaux : **VILLAGE** (mission en cours, ressources, mémoire du
village), **TAJMAƐT** (l’assemblée), **HISTOIRE**, **MUSÉE**, **FAMILLES**.

---

## Tester sur Android, avec Chrome

### A. Un seul fichier, envoyé au téléphone (recommandé)

1. Prenez `taddart-autonome.html` (113 ko) : il contient le jeu entier.
2. Envoyez-le sur le téléphone — WhatsApp à vous-même, e-mail, Bluetooth, ou
   câble USB vers le dossier `Download`.
3. Sur le téléphone : **Fichiers** → **Téléchargements** → appui sur le fichier.
4. Si Android demande avec quoi l’ouvrir, choisissez **Chrome**.
5. Menu ⋮ de Chrome → **Ajouter à l’écran d’accueil** : il aura son icône.

La progression est conservée par Chrome, même après fermeture complète.

### B. Depuis l’ordinateur, par le Wi-Fi

À faire si vous modifiez le code.

1. Ordinateur et téléphone sur **le même Wi-Fi**.
2. Dans le dossier `taddart` : `npm run servir`
3. Tapez dans Chrome l’adresse affichée pour le téléphone
   (par exemple `http://192.168.1.14:8090`).
4. Après chaque modification : rechargez la page, et `npm run construire` pour
   régénérer le fichier unique.

> Si l’adresse ne répond pas, c’est presque toujours le pare-feu de
> l’ordinateur, ou un Wi-Fi « invité » qui isole les appareils.

---

## Le corpus historique de la V1

Treize fiches, toutes sourcées. Elles se débloquent au musée au fil des missions,
et sont **toutes consultables dès l’accueil**, bouton HISTOIRE, sans rien jouer.

**Béjaïa / Saldae** — le port antique ; l’aqueduc de Toudja et le récit de
l’ingénieur Nonius Datus ; la Qal’a des Beni Hammad ; le transfert de la capitale
hammadide vers Béjaïa en 1067 ; la ville comme port et foyer de savoirs
méditerranéen ; l’origine du mot français « bougie » ; le XVIᵉ siècle.

**Organisation villageoise** — la tajmaɛt ; la tiwizi.

**Résistances, 1844-1857** — Chérif Boubaghla ; Lalla Fadhma N’Soumer ; la
campagne de 1857 dans le Djurdjura.

**1871** — l’insurrection de Grande Kabylie, El Mokrani, l’appel du cheikh
Aheddad, la répression. Fiche séparée, comme demandé.

### Les sources citées

- **UNESCO, Centre du patrimoine mondial** — Al Qal’a des Beni Hammad
  (`whc.unesco.org/fr/list/102/`)
- **Bibliothèque nationale de France** — L’insurrection de la Grande Kabylie en
  1871 (`bnf.fr`)
- **Encyclopédie berbère** (OpenEdition Journals) — notices « Béjaïa » et
  « Kabylie : l’insurrection de 1871 »
- **HAL / Université Toulouse–Jean Jaurès** — « Le Librator Nonius Datus et
  l’aqueduc de Saldae »
- **Insaniyat, revue du CRASC** — recherches sur la tajmaɛt et le village kabyle
- **CNRTL (CNRS)** — étymologie de « bougie »
- **Alain Mahé**, *Histoire de la Grande Kabylie, XIXe-XXe siècles*, Bouchène, 2001

Wikipédia n’est source d’aucune fiche — le vérificateur le contrôle.

### Ce que le corpus ne fait délibérément pas

- **Aucune citation** n’est prêtée à Boubaghla, à Fadhma N’Soumer ou à El
  Mokrani. Le jeu décrit ; il ne fait pas parler les morts.
- **Aucune scène de violence** n’est représentée. La mission inspirée de
  1844-1857 porte sur les réserves, l’eau, les familles et les décisions.
- **Les dates incertaines restent incertaines.** La capture de Fadhma N’Soumer
  est donnée au mois — les sources disent le 11 ou le 27 juillet 1857. Le
  déclenchement de 1871 est donné au mois — 15 ou 16 mars selon les sources.
- **La tajmaɛt du jeu est une mécanique inspirée**, pas une reconstitution. Le
  panneau TAJMAƐT le dit avant toute décision. Beaucoup de descriptions anciennes
  de ces institutions viennent de compilations coloniales, à lire avec recul :
  la fiche le signale.
- **Le village est fictif et sa carte n’est celle d’aucun lieu réel.**

---

## Les dix missions (toutes FICTION)

| Nº | Titre | Ce qu’elle apprend |
| --- | --- | --- |
| 1 | Fonder Taddart | bâtir, nourrir |
| 2 | L’eau d’abord | capter la source |
| 3 | Le pain de l’année | l’agriculture et les saisons |
| 4 | Réunir la tajmaɛt | décider ensemble |
| 5 | Les mains du village | l’artisanat |
| 6 | Le jour de marché | le commerce |
| 7 | Le village grandit | logement, école, satisfaction |
| 8 | Ce qui vient de Béjaïa | ouvre le chapitre historique de Béjaïa |
| 9 | Les années difficiles | simulation de gestion inspirée de 1844-1857 |
| 10 | Transmettre | la troisième génération, et le musée |

Un joueur automatique les boucle en **50 ans de jeu**. Le vérificateur le refait
à chaque exécution : si un réglage rend une mission inatteignable, il le dit.

---

## Comment marche la simulation

- **Le temps** : une saison par tour, quatre saisons par an. Un champ ne donne
  rien en hiver ; une oliveraie donne à l’automne.
- **Les bras** : chaque bâtiment a des postes. Ils sont pourvus **en tournant** —
  un bras dans chaque atelier avant d’en remplir un seul — pour qu’un bâtiment
  récent ne reste jamais à l’arrêt.
- **L’eau** : on puise au ruisseau à la main, ce qui ne suffit jamais à un
  village qui grandit. Il faut capter la source, puis en capter d’autres.
- **L’argent** : le surplus se vend dans la vallée, à mauvais prix tant qu’il n’y
  a pas de marché au village.
- **Les générations** : les habitants vieillissent, se marient, ont des enfants,
  héritent et meurent. Chacun garde son histoire personnelle, visible dans
  FAMILLES.
- **Le hasard** est à graine : la sauvegarde contient l’état du tirage, donc
  reprendre une partie la reprend exactement où elle était.

---

## Vérifier que tout tient

```bash
npm run verifier
```

Ce n’est pas un test symbolique. Le script contrôle notamment :

- que les treize fiches portent leurs sept champs, leur statut et leur source ;
- qu’aucune ne s’appuie sur Wikipédia, et qu’aucune ne contient de citation
  attribuée ;
- qu’aucune mission ne se présente comme un fait historique ;
- que toute fiche promise en récompense existe réellement ;
- qu’on ne bâtit pas sur l’eau ni sur la montagne, et qu’une fontaine loin de
  l’eau est refusée ;
- qu’un village vit cinquante ans sans erreur, que naissances et décès
  s’enregistrent, et qu’une disette fait bien chuter la satisfaction ;
- qu’une partie sauvegardée puis reprise ne diverge **pas d’un cheveu** de la
  partie continue ;
- **que les dix missions sont réellement atteignables**, en faisant jouer un
  village par un joueur automatique.

---

## Ce que la V1 ne fait pas

Dit franchement, pour que vous sachiez où vous en êtes :

- **L’argent s’accumule en fin de partie.** Seuls les bâtiments publics coûtent
  un entretien ; passé la trentaine d’années, un village bien tenu devient riche
  sans savoir quoi en faire. Il manque un vrai puits de dépenses.
- **L’énergie n’est pas modélisée**, alors qu’elle figurait dans votre liste.
- **L’arbre familial est une liste par famille**, avec générations, parents et
  conjoints — pas un arbre dessiné.
- **La catégorie « cartes » du musée est vide** : je n’ai pas voulu dessiner une
  carte historique de la Kabylie sans source cartographique fiable. Mieux vaut
  un manque qu’une carte inventée.
- **1871 est une fiche, pas un chapitre jouable.** C’est ce que vous aviez
  demandé (« utiliser une fiche historique séparée »), mais il n’y a donc pas de
  mission correspondante.
- **Les métiers sont attribués automatiquement.** Affecter cinquante villageois à
  la main sur un téléphone serait une corvée.
- **Pas de son, pas d’éditeur de niveaux, pas de relations entre habitants**
  au-delà du mariage et de la filiation.
- **Le palier « petite ville »** (100 maisons) est atteignable en place sur la
  carte, mais la population plafonne bien avant : le modèle démographique
  s’équilibre autour de quelques dizaines d’habitants.

## Ajouter du contenu

- **Une fiche historique** : ajoutez une entrée dans `HISTORICAL_EVENTS`
  (`donnees-histoire.js`) avec ses sept champs et une source réelle. Le
  vérificateur refusera une fiche incomplète.
- **Un bâtiment** : une entrée dans `BATIMENTS` (`donnees-jeu.js`) — coût,
  terrains, postes, production par saison. Le dessin se rajoute dans
  `dessinerBatiment` de `game.js`.
- **Une mission** : une entrée dans `MISSIONS`, avec des objectifs qui se
  mesurent (`valeur` lit l’état, `cible` dit où aller). La barre de progression
  s’affiche toute seule.
- **Une décision de tajmaɛt** : une entrée dans `DECISIONS`.
