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
code à 6 chiffres par SMS, le saisit, et l'application s'ouvre. Deux options
WhatsApp — dont une sans aucun frais d'envoi — peuvent s'ajouter si vous les
configurez ; voir [`server/README.md`](server/README.md). Le choix du canal d'envoi et ce qu'il faut obtenir
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
