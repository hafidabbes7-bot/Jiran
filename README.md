# Jiran (جيران)

Réseau social de quartier pour l'Algérie — inspiré du modèle Nextdoor, absent du
marché algérien et arabe. Objectif : formaliser l'entraide de voisinage dans un
espace dédié, vérifié et organisé par quartier.

## État du dépôt

Ce dépôt contient pour l'instant **la phase de conception uniquement**. Aucun
code applicatif réel n'a encore été écrit.

| Chemin | Contenu |
| --- | --- |
| `docs/cahier-des-charges.md` | Toutes les décisions de conception validées (concept, regroupement par quartier, modération, 24 écrans, périmètre V1) |
| `prototype/jiran-accueil.html` | Prototype visuel HTML autonome — 24 écrans navigables, bilingue FR/AR avec bascule RTL |

## Le prototype

Ouvrir `prototype/jiran-accueil.html` directement dans un navigateur (aucune
dépendance, aucun serveur).

C'est une **maquette de design**, pas une application : les données sont codées
en dur en JavaScript, rien ne persiste, l'authentification par SMS et les jeux
n'ont pas de logique réelle, la modération d'image est simulée. Voir §6 du
cahier des charges pour la liste exacte de ce qui est factice.

Il sert de référence visuelle et fonctionnelle pour le développement réel — il
n'est **pas destiné à être réutilisé tel quel** comme base de code.

## Avant de démarrer le développement

Deux décisions restent ouvertes et sont notées comme telles dans le cahier des
charges :

1. **Périmètre de la V1** (§5) — le prototype couvre volontairement beaucoup de
   fonctionnalités ; une V1 lançable devrait probablement se limiter à un socle
   (fil de quartier + alertes + entraide + SOS + modération) et introduire le
   reste progressivement.
2. **Nom définitif** (§1) — « Jiran » est un nom de travail, à valider avant
   publication.

Les exigences techniques pour la vraie application (géolocalisation, données
administratives algériennes, modération IA, messagerie temps réel, notifications
push) sont détaillées en §7 du cahier des charges.
