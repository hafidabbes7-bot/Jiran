# Jiran (جيران)

Réseau social de quartier pour l'Algérie — inspiré du modèle Nextdoor, absent du
marché algérien et arabe. Objectif : formaliser l'entraide de voisinage dans un
espace dédié, vérifié et organisé par quartier.

## État du dépôt

| Chemin | Contenu |
| --- | --- |
| `mobile/` | Application Expo / React Native — socle V1 en cours de développement ([README](mobile/README.md)) |
| `server/` | API de vérification du numéro par SMS ou WhatsApp ([README](server/README.md)) |
| `docs/cahier-des-charges.md` | Toutes les décisions de conception validées (concept, regroupement par quartier, modération, 24 écrans, périmètre V1) |
| `prototype/jiran-accueil.html` | Prototype visuel HTML autonome — 24 écrans navigables, bilingue FR/AR avec bascule RTL |

## L'application

```bash
# terminal 1 — API de vérification du numéro (aucun SMS envoyé en développement)
cd server && npm install && cp .env.example .env && EXPOSE_DEV_CODE=true npm run dev

# terminal 2 — application
cd mobile && npm install && EXPO_PUBLIC_API_URL=http://localhost:4000 npm start
```

Le périmètre retenu pour la V1 est le **socle restreint** décrit au §5 du cahier
des charges : fil de quartier, alertes, entraide, SOS et modération. Les
fonctionnalités secondaires du prototype (jeux, stories, groupes d'intérêt,
objets à emprunter, services recommandés, carte, mode vacances, collecte des
déchets, messagerie privée) viendront ensuite, pour ne pas retarder le lancement
ni diluer le positionnement sécurité / entraide.

L'inscription vérifie le numéro par code reçu en SMS (ou WhatsApp), comme dans
la plupart des applications. Le choix du canal d'envoi et ce qu'il faut obtenir
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

## Décision encore ouverte

**Nom définitif** (§1) — « Jiran » est un nom de travail, à valider avant
publication.

Les exigences techniques pour la vraie application (géolocalisation, données
administratives algériennes, modération IA, messagerie temps réel, notifications
push) sont détaillées en §7 du cahier des charges.
