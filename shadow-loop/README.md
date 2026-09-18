# SHADOW LOOP — V1

> « Ton passé est ton adversaire. »

Jeu de puzzle en 2D vu du dessus. Vous disposez d'un cycle de quelques secondes
pour agir. À la fin du cycle, tout se remet en place — sauf vous : une **ombre**
apparaît et rejoue, geste pour geste et seconde pour seconde, ce que vous venez
de faire. Les énigmes se résolvent en collaborant avec vos propres cycles
passés.

L'ombre n'a aucune intelligence. Elle ne vous cherche pas, ne vous évite pas,
ne décide de rien : elle relit une bande enregistrée.

---

## Structure des fichiers

```
shadow-loop/
├── index.html                  la page du jeu (à ouvrir)
├── style.css                   l'habillage : sombre, minimal, pensé pour le pouce
├── niveaux.js                  les 5 niveaux, décrits par des grilles de caractères
├── moteur.js                   la simulation : monde, collisions, cycles, enregistrement, rejeu
├── game.js                     l'écran : commandes, rendu sur canvas, menus, sauvegarde
├── shadow-loop-autonome.html   LE JEU ENTIER EN UN SEUL FICHIER (pour le téléphone)
├── package.json                trois commandes utilitaires, aucune dépendance
├── outils/
│   ├── serveur.mjs             petit serveur local pour tester sur téléphone
│   └── construire-autonome.mjs refabrique le fichier unique ci-dessus
└── tests/
    └── verifier.mjs            vérifie les niveaux, le rejeu et les collisions
```

Aucune bibliothèque, aucune image, aucune police téléchargée, aucun serveur
obligatoire, aucune connexion Internet. Le jeu tient en cinq fichiers texte.

**Pourquoi `moteur.js` est séparé de `game.js`** : parce que le moteur ne touche
jamais à la page. On peut donc faire tourner des parties entières hors du
navigateur et *vérifier* que l'ombre rejoue juste, au lieu de l'espérer.

---

## Y jouer

**Le plus simple** : double-cliquer sur `index.html`. Ça suffit — pas de serveur,
pas d'installation.

**Commandes, sur ordinateur**

| Touche | Effet |
| --- | --- |
| Flèches, ou WASD / ZQSD | se déplacer |
| Espace | ACTION |
| Échap | pause |

**Commandes, sur téléphone**

- Le **joystick** naît sous le pouce, n'importe où dans la moitié gauche de
  l'écran (réglable à droite dans les paramètres).
- Le gros bouton **ACTION** est à droite. Il s'allume en jaune quand un geste
  est possible : ramasser une clé, ouvrir une porte, presser un interrupteur.

---

## Tester sur Android, avec Chrome

Deux chemins. Le premier ne demande pas d'ordinateur allumé.

### A. Un seul fichier, envoyé au téléphone (recommandé)

1. Prenez le fichier `shadow-loop-autonome.html` (55 ko). Il contient le jeu
   entier — HTML, style et code.
2. Envoyez-le sur le téléphone comme vous voulez : WhatsApp (envoyez-le-vous à
   vous-même), e-mail en pièce jointe, Bluetooth, ou câble USB vers le dossier
   `Download`.
3. Sur le téléphone, ouvrez **Fichiers** (ou *Mes fichiers*), allez dans
   **Téléchargements**, et appuyez sur `shadow-loop-autonome.html`.
4. Si Android demande avec quoi l'ouvrir, choisissez **Chrome**.
5. Le jeu démarre. Pour le retrouver plus vite ensuite : menu ⋮ de Chrome →
   **Ajouter à l'écran d'accueil**. Il aura son icône, comme une application.

La progression est conservée par Chrome, même après fermeture.

### B. Depuis l'ordinateur, par le Wi-Fi

À faire si vous modifiez le code et voulez voir le résultat immédiatement.

1. Ordinateur et téléphone sur **le même Wi-Fi**.
2. Sur l'ordinateur, dans le dossier `shadow-loop` :
   ```bash
   npm run servir
   ```
3. La commande affiche deux adresses. Tapez celle du téléphone dans Chrome,
   par exemple `http://192.168.1.14:8080`.
4. Rechargez la page après chaque modification.

> Si l'adresse ne répond pas, c'est presque toujours le pare-feu de
> l'ordinateur, ou un Wi-Fi « invité » qui isole les appareils entre eux.

### Ce qu'il faut regarder en testant

- Le joystick suit-il bien le pouce, sans faire défiler la page ?
- Le bouton ACTION est-il atteignable sans changer de main ?
- Au cycle 2, l'ombre part-elle bien du départ et refait-elle votre trajet ?
- Fermez Chrome complètement, rouvrez : les niveaux débloqués sont-ils là ?

---

## Les cinq niveaux

| Nº | Nom | Ce qu'il apprend |
| --- | --- | --- |
| 1 | Premiers pas | se déplacer, atteindre la sortie — aucun ombre nécessaire |
| 2 | Le déclic | ACTION, et le fait que l'ombre rejoue vos appuis **à la seconde près** |
| 3 | Le poids du passé | une ombre immobile sur une plaque tient une porte ouverte |
| 4 | La clé | ramasser un objet, ouvrir une porte verrouillée |
| 5 | Deux ombres | une porte qui exige deux plaques : il faut deux cycles derrière soi |

<details>
<summary>Solutions (à n'ouvrir qu'en cas de blocage)</summary>

1. **Premiers pas** — descendez, puis allez à droite jusqu'à l'anneau vert.
2. **Le déclic** — cycle 1 : allez sur l'interrupteur rose et appuyez sur
   ACTION. Cycle 2 : postez-vous contre la porte et attendez ; votre ombre
   appuiera à la même seconde, la porte s'ouvre une seconde et demie, passez.
3. **Le poids du passé** — cycle 1 : allez sur la plaque et **ne bougez plus**
   jusqu'à la fin du cycle. Cycle 2 : l'ombre tient la plaque, la porte reste
   ouverte, filez à la sortie.
4. **La clé** — cycle 1 : sur la plaque, immobile. Cycle 2 : passez la porte
   ouverte, ACTION sur la clé, revenez à la porte dorée, ACTION, sortez.
5. **Deux ombres** — cycle 1 : plaque de gauche, immobile. Cycle 2 : plaque de
   droite, immobile. Cycle 3 : les deux ombres tiennent les deux plaques, la
   porte s'ouvre, allez à la sortie.

</details>

Un niveau est **échoué** quand ses cycles sont épuisés (6 à 8 selon le niveau).
On recommence alors du premier cycle, sans rien perdre d'autre.

---

## Comment marche l'enregistrement

C'est le point sur lequel tout repose, alors il est traité de façon stricte.

La simulation n'avance **jamais** au rythme de l'écran : elle avance par pas
fixes de **1/60 de seconde**. Le pas nº 744 est donc toujours l'instant
12,400 s, sur un téléphone poussif comme sur un ordinateur rapide.

À chaque pas, on note dans des tableaux typés :

| Donnée | Usage |
| --- | --- |
| position X, position Y | la position exacte, rejouée telle quelle |
| numéro du pas | l'instant — pas besoin de l'écrire, c'est l'indice du tableau |
| direction | l'orientation du personnage, pour le dessin |
| état des boutons | haut/bas/gauche/droite/action, conservé |
| ACTION | 1 si le joueur a appuyé à ce pas précis |

Au cycle suivant, l'ombre ne « refait pas le trajet » : on lui **réimpose** la
position enregistrée au même numéro de pas, et on rejoue son ACTION au même
numéro de pas. Il ne peut donc y avoir aucune dérive, aucun décalage qui
s'accumule. Deux secondes d'immobilité restent exactement deux secondes
d'immobilité.

Le monde, lui, est **reconstruit de zéro** à chaque cycle : une porte laissée
ouverte ou une clé ramassée ne peut pas déteindre sur le cycle suivant, ce qui
rendrait le rejeu faux.

---

## Vérifier que tout tient

```bash
npm run verifier
```

Ce n'est pas un test symbolique. Le script fait réellement jouer les cinq
niveaux par un pilote automatique et contrôle notamment :

- que chaque niveau **se termine pour de bon** (et en combien de cycles) ;
- que les niveaux 2 à 5 sont **impossibles sans ombre** — sinon l'énigme
  n'en est pas une ;
- que l'ombre repasse par les **1079 positions** du cycle précédent sans le
  moindre écart ;
- qu'une ACTION à 12,400 s est rejouée à 12,400 s, pas à 12,39 ni 12,41 ;
- que les murs arrêtent le joueur ;
- qu'une nouvelle partie repart bien à zéro : cycle 1, aucune ombre.

Après toute modification du code, refaites aussi le fichier unique :

```bash
npm run construire
```

---

## Ce que la V1 ne fait pas

Volontairement, pour livrer un prototype jouable et stable :

- pas de publicité, pas d'achat, pas de publication sur le Play Store ;
- pas d'images ni de sons enregistrés — des formes géométriques et trois bips
  synthétisés ;
- les ombres ne bloquent pas le joueur (elles se traversent) : c'est ce qui
  garantit qu'aucun niveau ne peut se retrouver coincé ;
- pas d'éditeur de niveaux — mais en ajouter un se fait dans `niveaux.js`,
  en dessinant une grille.
