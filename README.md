# Jiran (جيران)

Réseau social de quartier pour l'Algérie — inspiré du modèle Nextdoor, absent du
marché algérien et arabe. Objectif : formaliser l'entraide de voisinage dans un
espace dédié, vérifié et organisé par quartier.

## État du dépôt

| Chemin | Contenu |
| --- | --- |
| `mobile/` | Application Expo / React Native — socle V1 en cours de développement ([README](mobile/README.md)) |
| `server/` | Serveur : vérification du numéro et fil de quartier partagé ([README](server/README.md)) |
| `docs/cahier-des-charges.md` | Toutes les décisions de conception validées (concept, regroupement par quartier, modération, 24 écrans, périmètre V1) |
| `prototype/jiran-accueil.html` | Prototype visuel HTML autonome — 24 écrans navigables, bilingue FR/AR avec bascule RTL |
| `essai/jiran-essai.html` | Version d'essai en une page, publiée sur claude.ai : le socle fonctionne à plusieurs, sans rien installer ([README](essai/README.md)) |

## Essayer tout de suite

```bash
npm run install:all   # la première fois
npm run essai
```

Construit l'application, crée les secrets, démarre le serveur qui sert à la
fois l'API et l'application web : il n'y a plus qu'une adresse à ouvrir. Pour
la partager à des voisins, ajoutez un tunnel (`npx localtunnel --port 4000`) —
voir [`docs/lancer-sur-telephone.md`](docs/lancer-sur-telephone.md).

## Développer

```bash
# terminal 1 — serveur
cd server && npm install && cp .env.example .env && npm run dev

# terminal 2 — application
cd mobile && npm install && npm start
```

Le périmètre retenu pour la V1 est le **socle restreint** décrit au §5 du cahier
des charges : fil de quartier, alertes, entraide, SOS et modération. Les
fonctionnalités secondaires du prototype (jeux, stories, groupes d'intérêt,
objets à emprunter, services recommandés, carte, mode vacances, collecte des
déchets, messagerie privée) viendront ensuite, pour ne pas retarder le lancement
ni diluer le positionnement sécurité / entraide.

L'inscription suit le parcours habituel : le voisin tape son numéro, reçoit un
code à 6 chiffres, le saisit, et l'application s'ouvre.

Le canal retenu pour le lancement est **WhatsApp gratuit** : au lieu de lui
envoyer un code, c'est le voisin qui nous envoie un message, et WhatsApp
confirme son numéro. Rien n'est facturé, et le numéro reste prouvé. Activation
pas à pas : [`docs/verification-whatsapp.md`](docs/verification-whatsapp.md).
Le SMS reste disponible pour qui n'a pas WhatsApp, le jour où un contrat
d'agrégateur sera signé. Le choix du canal d'envoi et ce qu'il faut obtenir
auprès des opérateurs sont expliqués dans [`server/README.md`](server/README.md).

Ce qui reste à brancher côté services externes (modération d'image,
notifications push, backend pour le contenu) est listé dans
[`mobile/README.md`](mobile/README.md).

## Le prototype

Ouvrir `prototype/jiran-accueil.html` directement dans un navigateur (aucune
dépendance, aucun serveur).

C'est une **maquette de design**, pas une application : les données sont codées
en dur en JavaScript, rien ne persiste, l'authentification par SMS et les jeux
n'ont pas de logique réelle, la modération d'image est simulée. Voir §6 du
cahier des charges pour la liste exacte de ce qui est factice.

Il sert de référence visuelle et fonctionnelle pour le développement réel — il
n'est **pas destiné à être réutilisé tel quel** comme base de code.

## Mettre en ligne, sans ordinateur

L'application complète peut être déployée depuis un navigateur de téléphone :
elle tourne alors à une adresse `https://` publique, que vos voisins ouvrent
sans rien installer. Dix minutes, pas à pas :
[`docs/mettre-en-ligne.md`](docs/mettre-en-ligne.md).

## Obtenir le fichier d'installation

Onglet **Actions** du dépôt → **Fabriquer l'APK** → *Run workflow*, en donnant
l'adresse du serveur. GitHub compile et dépose le fichier dans les
« Releases », d'où il s'installe directement depuis un téléphone. Rien à
installer, aucun compte supplémentaire.

## Essayer sur un vrai téléphone

Tout a été vérifié depuis un navigateur ; la géolocalisation réelle, le rendu
arabe et les notifications demandent un appareil. La marche à suivre, pas à pas :
[`docs/lancer-sur-telephone.md`](docs/lancer-sur-telephone.md).

## Tests

Les deux paquets se vérifient séparément, et l'intégration continue
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) les rejoue à chaque
poussée : types, tests, et construction réelle du paquet mobile.

```bash
cd server && npm test        # vérification, fil, modération, alertes
cd mobile && npm test        # filtre de texte, géolocalisation, téléphone
```

## Ce qui est construit, et ce qui ne l'est pas

Au-delà du socle V1 (fil, alertes, entraide, SOS, modération) : l'onglet
**Profil** (§4.7) et les **jeux entre voisins** (§4.8), avec un morpion
réellement jouable à deux — le plateau, le tour et le verdict vivent sur le
serveur, pas sur le téléphone (§7.6).

Puis toute la vie de quartier, accessible depuis le profil : messagerie privée
(§4.6), services recommandés (§4.9), objets à emprunter (§4.10), groupes
d'intérêt (§4.11), carte du quartier (§4.12), mode vacances (§4.13), collecte
des déchets (§4.14) et actions solidaires (§4.15).

Trois choix assumés dans ce lot :
 — la carte est une liste triée par distance qui ouvre l'itinéraire dans
   l'application de cartes du téléphone, plutôt qu'une carte dessinée qui
   imposerait une clé d'API et une dépendance native ;
 — le calendrier des déchets est rempli par les voisins, faute de source
   publique exploitable, et le rappel de la veille reste sur le téléphone ;
 — une absence n'est visible que des voisins nommément désignés : l'annoncer au
   quartier reviendrait à donner l'adresse d'un logement vide.

Toujours à faire : les autres jeux (échecs, dames, belote, dominos), le
classement mensuel du quartier, et les réglages de notifications par catégorie
(§4.17).

## Couverture du territoire

Les 97 quartiers de `mobile/src/data/neighborhoods.ts` couvrent les 69 wilayas —
les 58 d'avant, plus les 11 créées par la loi n° 26-06 du 4 avril 2026 (Aflou,
Barika, El Kantara, Bir El Ater, El Aricha, Ksar Chellala, Aïn Oussara, Messaad,
Ksar El Boukhari, Bou Saâda, El Abiodh Sidi Cheikh). Les communes d'Alger et de
Béjaïa y figurent au quartier près, le chef-lieu partout ailleurs. C'est volontairement grossier hors de ces deux wilayas — un chef-lieu
se découpera en quartiers quand il y aura assez de voisins pour que ça ait un
sens. Personne ne doit rester sans entrée : un voisin absent de la liste ne peut
pas s'inscrire. Quand sa commune manque quand même, l'inscription reste possible
sans vérification de position, et le compte est alors marqué « non vérifié ».

Ajouter une commune, c'est ajouter la même entrée dans les deux copies —
`mobile/src/data/neighborhoods.ts` et `server/src/content/neighborhoods.ts` — et
dans la page d'essai `essai/jiran-essai.html`.

Trois fichiers existent en double entre les deux paquets — le découpage des
quartiers, la liste de mots interdits et le filtre de texte. L'application en a
besoin hors ligne, le serveur en a besoin comme autorité. Un test du serveur
compare les deux copies et échoue à la première divergence.

## Décision encore ouverte

**Nom définitif** (§1) — « Jiran » est un nom de travail, à valider avant
publication.

Les exigences techniques pour la vraie application (géolocalisation, données
administratives algériennes, modération IA, messagerie temps réel, notifications
push) sont détaillées en §7 du cahier des charges.
