# Jiran (جيران) — Cahier des charges du projet

Document de synthèse de toutes les décisions prises pendant la phase de conception (prototype visuel en HTML : `jiran-accueil.html`). À utiliser comme référence pour le développement réel dans Claude Code.

---

## 1. Concept

Réseau social de quartier pour l'Algérie, inspiré du modèle **Nextdoor** (100M+ utilisateurs dans le monde — USA, Pays-Bas, Allemagne, UK, France) mais **absent du marché algérien et arabe**. Objectif : formaliser l'entraide de voisinage qui existe déjà de façon informelle (groupes Facebook/WhatsApp non structurés) dans un espace dédié, vérifié, et organisé par quartier.

**Nom de travail** : Jiran (جيران = "voisins"). À valider avant publication.

**Recherche de marché effectuée** : au moins 7 concurrents directs trouvés en France/Europe (Nextdoor, Smiile, Voisins Vigilants, AlloVoisins, Proxiigen, Mon Super Voisin, Urba App) — signal fort que le concept est validé à grande échelle. Aucun équivalent trouvé en Algérie ou dans le monde arabe.

---

## 2. Logique de regroupement par quartier (décision clé)

- Regroupement par **quartier nommé** (pas de découpage géométrique abstrait) — réutilise les mêmes noms de quartiers qu'As3ar pour cohérence entre les deux applis
- Vérification par **géolocalisation** (bouton "Confirmer ma position" à l'inscription), pas par courrier postal comme Nextdoor (pas adapté au système d'adresses algérien)
- Champ optionnel **"Cité / Immeuble"** pour affiner à l'intérieur d'un grand quartier
- **Jumelage automatique** des petites cités (en dessous d'un seuil, ex. 50 voisins actifs) avec une cité voisine proche géographiquement — le fil est partagé temporairement, mais l'origine exacte reste toujours affichée sur chaque publication. Détachement automatique possible une fois le seuil atteint. Jumelage décidé manuellement par l'équipe au démarrage (V1), pourra devenir automatique plus tard.
- Écran dédié **"Mon quartier"** montrant le nombre de voisins vérifiés et les cités jumelées avec leur progression vers le seuil.

---

## 3. Modération et sécurité (décisions clés)

- **Règles du quartier obligatoires à l'inscription** : 5ᵉ étape de l'onboarding, non-passable avant 3 secondes (compte à rebours visible sur le bouton) pour garantir une vraie lecture, avant que l'utilisateur puisse accéder à l'appli
- **Blocage automatique par signalements** : un contenu signalé par **3 voisins différents** est automatiquement masqué pendant **3 jours**. En cas de récidive (nouveau cycle de 3 signalements), le blocage devient **définitif**. Prototypé fonctionnellement (pas juste visuel) dans `jiran-accueil.html`.
- **Détection automatique de contenu inapproprié** :
  - Texte : liste de mots interdits vérifiée en temps réel pendant la rédaction, bouton "Publier" désactivé si détection (dans la vraie version : vrai filtre + modération IA, pas juste une liste statique)
  - Images : simulation d'une vérification avant publication (dans la vraie version : API de modération d'image comme Google Vision ou AWS Rekognition)
- **Système de signalement** : bouton "⋮" sur chaque publication → choix de raison (spam, contenu inapproprié, fausse alerte, autre)
- Écran "Signalements en attente" prévu pour les modérateurs (pas encore détaillé, à définir dans la vraie version — qui a le rôle modérateur ? validation manuelle au départ probablement)

---

## 4. Écrans et fonctionnalités (tous prototypés)

### 4.1 Onboarding (5 étapes)
1. Langue (Français / العربية)
2. Création de compte : prénom + numéro de téléphone (inscription par téléphone uniquement, pas Facebook/Google/email — décision cohérente avec As3ar)
3. Localisation : quartier + cité/immeuble optionnel + bouton de géolocalisation
4. Présentation rapide (3 points clés)
5. **Règles du quartier** (obligatoire, bouton verrouillé 3 secondes)

### 4.2 Accueil (fil de quartier)
- Barre de recherche globale (publications + voisins)
- Bandeau de **stories** du quartier (24h, format Instagram/Snapchat — concept non-protégeable, voir note juridique ci-dessous)
- Catégories filtrables : Tout, Sécurité, Entraide, Annonces, Événements, Sondages, Covoiturage, Solidarité
- Bannière d'alerte sécurité prioritaire
- Bannière d'accès rapide aux Jeux
- Carte de bienvenue pour les nouveaux arrivants du quartier
- Fil de publications avec likes fonctionnels, catégorisation par badges colorés
- Exemple de **sondage** intégré au fil (avec barres de résultats)

### 4.3 Publications
- Création avec catégories : Sécurité, Entraide, Annonce, Événement, Sondage, Covoiturage, Solidarité
- Détail d'une publication avec fil de commentaires/réponses
- Système de signalement (voir section 3)

### 4.4 Annonces
Liste des objets à donner/vendre par les voisins, avec photo, tag (À donner / À vendre + prix).

### 4.5 Alertes
Fil dédié aux alertes de sécurité, coupures officielles (eau/électricité), objets/animaux perdus.

### 4.6 Messagerie privée
Liste de conversations + écran de chat 1-à-1 entre voisins (pour échanges plus discrets que les commentaires publics — négocier une annonce, organiser un covoiturage en détail).

### 4.7 Profil
- Badge "Voisin vérifié"
- Statistiques (publications, ancienneté, voisins connectés)
- Menu complet vers toutes les fonctionnalités : Mes publications, Notifications, Mon quartier, Jeux, Services recommandés, Objets à emprunter, Groupes d'intérêt, Carte du quartier, Mode vacances, Collecte des déchets, Actions solidaires

### 4.8 Jeux entre voisins
- **Jeux 1v1** : Échecs (échiquier visuel fonctionnel en CSS Grid), Dames, Belote, Dominos, Scrabble, Morpion
- **Quiz à thème** : Culture Algérie, Sport, Religion, Culture générale
- **Classement du quartier** mensuel avec médailles 🥇🥈🥉
- Accès via bannière sur l'accueil (volontairement pas dans la barre de navigation principale, pour ne pas diluer le positionnement sécurité/entraide de l'appli)

### 4.9 Services recommandés (annuaire)
Plombier, électricien, professeur, etc. — recommandés par de vrais voisins, avec note et nombre de recommandations. C'est la fonctionnalité qui a fait le succès de Nextdoor à l'international, pas encore répliquée dans le monde arabe.

### 4.10 Objets à emprunter
Bibliothèque d'objets prêtés entre voisins (perceuse, escabeau, tente...) avec statut Disponible / Emprunté + date de retour.

### 4.11 Groupes d'intérêt
Sous-communautés : Parents d'élèves, Jardinage, Foot du quartier, Cercle d'étude religieuse. Bouton Rejoindre/Rejoint fonctionnel.

### 4.12 Carte du quartier
Liste des points utiles : pharmacie de garde, école, mosquée, arrêt de bus, avec distance.

### 4.13 Mode vacances
Active la surveillance du logement pendant une absence, désignation de voisins de confiance individuellement.

### 4.14 Collecte des déchets
Calendrier par type de déchet (ordures, recyclable, encombrants) + rappel activable la veille.

### 4.15 Actions solidaires
Don du sang, collecte de vêtements, panier Ramadan — bouton "Je participe" fonctionnel.

### 4.16 Alerte SOS (dernier ajout)
- **Bouton flottant rouge, toujours visible** sur tous les écrans (pas caché dans un menu, vu l'urgence)
- L'utilisateur **choisit lui-même** quels voisins de confiance alerter (pas un broadcast automatique à tout le quartier)
- Confirmation visuelle du nombre de voisins alertés + option d'annulation / fausse alerte

### 4.17 Notifications
Réglages par catégorie : Sécurité, Réponses à mes publications, Nouvelles annonces, Événements à venir.

---

## 5. Idées explorées et mises de côté (pour une version future, pas la V1)

- 🆘 ~~Bouton SOS~~ → fait, voir section 4.16
- 💼 Petits boulots entre voisins (babysitting ponctuel, cours, travaux rémunérés)
- 🎊 Annonces de vie du quartier (naissances, mariages, condoléances)
- 🌦️ Alertes météo locales automatiques

**Remarque de cadrage importante** : le prototype couvre volontairement beaucoup de fonctionnalités pour explorer toutes les pistes possibles, mais une vraie V1 à lancer devrait probablement se concentrer sur un socle plus restreint (fil de quartier + alertes + entraide + SOS + modération) et introduire les fonctionnalités secondaires (jeux, stories, groupes, objets à emprunter...) progressivement, pour ne pas retarder le lancement ni diluer le positionnement principal de l'appli. À décider avec Hafid avant de lancer le développement réel.

---

## 6. Ce qui est purement visuel dans le prototype (à reconstruire en vrai)

Le fichier `jiran-accueil.html` est un **prototype de design**, pas une vraie application :
- Toutes les données (publications, voisins, messages, classement) sont statiques, codées en dur en JavaScript
- Pas de vraie base de données, pas de vrais comptes utilisateurs, pas de vraie authentification par SMS
- La détection de mots inappropriés est une liste statique de démonstration (pas un vrai système anti-contournement)
- La vérification d'image est simulée aléatoirement (pas de vraie API de modération)
- Les jeux (échecs, dames...) n'ont pas de vraie logique de règles ni de synchronisation entre joueurs — juste l'interface visuelle
- Rien ne persiste entre les sessions

---

## 7. Demandes explicites pour le développement réel (Claude Code)

1. **Vraie géolocalisation** pour la vérification de quartier à l'inscription
2. **Vraies données administratives** algériennes (quartiers/communes réels), cohérent avec ce qui sera fait pour As3ar
3. **Vrai système de modération** : liste de mots évolutive + modération IA pour le texte, API de modération d'image (Google Vision, AWS Rekognition ou équivalent) pour les photos
4. **Vraie logique de blocage automatique** (3 signalements → 3 jours → récidive → définitif) côté backend, avec file d'attente pour modérateurs humains
5. **Vraie messagerie** en temps réel (WebSocket ou équivalent) pour les conversations privées
6. **Vrais jeux fonctionnels** (au minimum morpion et quiz en V1, échecs/dames/belote/dominos demandent plus de travail — règles complètes + synchronisation 2 joueurs)
7. **Vraies notifications push** pour les alertes sécurité et SOS (priorité haute, doivent arriver même appli fermée)

---

## 8. Fichier de référence

Voir `jiran-accueil.html` (artifact créé dans cette conversation) pour :
- Le design visuel complet (palette terracotta/brique, distincte d'As3ar qui est vert émeraude)
- Le parcours utilisateur complet (24 écrans navigables)
- Le contenu bilingue français/arabe avec bascule RTL fonctionnelle
- Toutes les micro-interactions déjà codées (likes, signalement avec blocage réel, sélection de voisins pour le SOS, compte à rebours des règles, détection de mots inappropriés)

Ce fichier n'est **pas du code à réutiliser tel quel** pour l'application finale, mais sert de référence visuelle et fonctionnelle exacte de ce qui a été validé avec Hafid pendant la conception.
