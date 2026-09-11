# Jiran — application mobile

Application Expo / React Native du socle V1 : **fil de quartier, alertes,
entraide, SOS et modération** (périmètre décidé au §5 du cahier des charges).

## Démarrer

L'inscription vérifie le numéro par un code reçu par SMS :
l'**API de vérification doit tourner**
(voir [`../server`](../server/README.md)), sinon l'onboarding s'arrête à l'étape
du code. En développement, aucun SMS n'est réellement envoyé.

```bash
# terminal 1 — API de vérification
cd server && npm install && cp .env.example .env
EXPOSE_DEV_CODE=true npm run dev
# les canaux WhatsApp ne s'ajoutent que si vous les configurez (voir .env.example)

# terminal 2 — application
cd mobile && npm install
EXPO_PUBLIC_API_URL=http://localhost:4000 npm start
#   puis « a » pour Android, « i » pour iOS, « w » pour le web
npm test           # logique métier (filtre de texte, géolocalisation, téléphone)
npm run typecheck
npm run build:check    # prouve que l'application se construit vraiment
npm run prebuild:check # régénère les projets Android et iOS
```

Sur un téléphone physique, `localhost` désigne le téléphone lui-même :
remplacez-le par l'adresse de votre machine sur le réseau local
(`EXPO_PUBLIC_API_URL=http://192.168.x.x:4000`).

## Ce qui est implémenté

| Cahier des charges | État |
| --- | --- |
| §4.1 Onboarding en 5 étapes | ✅ langue, compte téléphone, quartier + géolocalisation, présentation, règles |
| §7.1 Vérification du numéro | ✅ parcours habituel — numéro, code à 6 chiffres par SMS, saisie, ouverture ; renvoi avec délai et essais limités. WhatsApp (payant ou gratuit) s'ajoute en option si vous le configurez |
| §3 Règles obligatoires, bouton verrouillé 3 s | ✅ `useRulesCountdown` |
| §2 Vérification par géolocalisation | ✅ position réelle comparée au quartier déclaré, correction proposée si erreur |
| §2 Quartiers nommés + jumelage | ✅ fil partagé entre cités jumelées, origine affichée sur chaque publication |
| §4.2 Fil de quartier | ✅ recherche, filtres par catégorie, likes, réponses |
| §4.5 Alertes | ✅ fil dédié aux publications « Sécurité » |
| §3 Filtre de texte | ✅ dans l'application pendant la frappe, et **appliqué par le serveur** qui refuse la publication |
| §3 Blocage automatique par signalements | ✅ tenu par le serveur : 3 voisins **réellement distincts** → 3 jours ; récidive → définitif |
| §7.4 Fil partagé entre voisins | ✅ publications, réponses et « j'aime » sur le serveur — deux voisins voient le même quartier |
| §7.4 File des signalements | ✅ écran modérateur : motifs invoqués, décision `bloquer` / `rétablir` avec note |
| §4.16 Alerte SOS | ✅ bouton flottant sur tous les écrans, choix des voisins alertés, position jointe, annulation qui les prévient |
| §7.7 Notifications d'alerte | ✅ appareil enregistré au serveur ; SOS et alertes sécurité poussés en priorité haute — reste à brancher un service d'envoi |
| Bilingue FR / AR avec RTL | ✅ bascule immédiate, sans redémarrage |

## Projets natifs

`npm run prebuild:check` régénère `android/` et `ios/` à partir de `app.json`.
Ces dossiers ne sont pas versionnés : ils se reconstruisent, et les modifier à
la main serait perdu au prebuild suivant. Tout passe par `app.json`.

Ce qui y est réglé, et vérifié dans les fichiers produits :

- **Identifiant de paquet** `dz.jiran.app`, sur les deux plateformes. ⚠️ Il
  devient **définitif à la première publication** sur les stores et ne peut
  plus changer ensuite — à trancher en même temps que le nom (§1), tant que
  c'est encore gratuit.
- **Une seule autorisation demandée** : la position pendant l'utilisation. Pas
  de position en arrière-plan, pas de capteurs de mouvement — l'application
  n'en a pas besoin, et réclamer plus inquiète les voisins pour rien.
- **Textes des autorisations en français**, traduits en arabe dans `locales/`.
  Par défaut, iOS affichait des phrases anglaises génériques.
- **Sauvegardes Android désactivées** : le jeton de session ne doit pas partir
  dans une sauvegarde cloud, d'où il pourrait être restauré sur un autre
  appareil.
- **Canal de notification `alertes`**, celui que le serveur vise pour les SOS
  et les alertes de sécurité.

## Ce qui n'est pas encore branché

Ces points sont des **dépendances externes**, pas des oublis ; ils sont signalés
dans le code et dans l'interface là où l'utilisateur pourrait s'y tromper.

- **Aucun envoi réel de SMS tant qu'un fournisseur n'est pas branché** : voir
  le README du serveur pour le choix de l'agrégateur.
- **Pas de temps réel** (§7.5) : le fil se recharge à l'ouverture et au
  tirer-pour-rafraîchir, il n'arrive pas tout seul.
- **Pas de modération d'image** (§7.3) : l'ajout de photo est annoncé comme
  indisponible plutôt que simulé — publier une image non modérée irait contre
  la règle §3.
- **Notifications pas encore remises** : le circuit complet existe, mais tant
  que le serveur tourne avec `PUSH_PROVIDER=console`, aucun téléphone ne sonne
  — et l'écran SOS le dit, plutôt que d'afficher une confirmation trompeuse.
  Sur Android, les notifications distantes demandent un *development build* :
  elles ne fonctionnent plus dans Expo Go depuis le SDK 53.
- **Rien n'a encore tourné sur un vrai téléphone.** Les parcours ont été
  vérifiés via l'export web, et les projets natifs sont générés et relus, mais
  la géolocalisation, les notifications et le rendu réel restent à confirmer
  sur un appareil : c'est la prochaine étape de vérification, avant toute
  nouvelle fonctionnalité.
- **Modération de texte locale seulement** : la liste de mots est un premier
  filet contre l'insulte évidente, elle ne remplace pas la modération IA
  côté serveur demandée au §7.3.

## Organisation du code

```
src/
  domain/          règles métier pures, testables sans React
    moderation/    filtre de texte + blocage automatique par signalements
    location.ts    vérification de quartier par géolocalisation
    phone.ts       numéros algériens
  data/            quartiers réels, client HTTP du serveur, session locale
  state/           session, fil, signalements (AppProvider)
  i18n/            dictionnaires fr / ar et sens de lecture
  components/      briques d'interface partagées
  screens/         écrans, dont le parcours d'inscription
  navigation/      onglets + pile, bouton SOS global
```

La logique sensible côté application (filtre de texte, géolocalisation,
téléphone) est dans `src/domain`, sans dépendance à React.

Ce qui décide — refuser un texte, compter les signalements, masquer un contenu —
vit sur le serveur. L'application affiche le verdict, elle ne le recalcule pas :
elle ne voit que ses propres signalements, alors que la règle en compte trois de
voisins différents.

## Données de quartier

`src/data/neighborhoods.ts` contient un extrait du découpage administratif réel
(communes d'Alger, Boumerdès, Blida) avec leur code de wilaya officiel. À
remplacer par le jeu de données complet partagé avec As3ar (§7.2) — le code de
wilaya est la clé commune prévue entre les deux applications.
