# Jiran — application mobile

Application Expo / React Native du socle V1 : **fil de quartier, alertes,
entraide, SOS et modération** (périmètre décidé au §5 du cahier des charges).

## Démarrer

L'inscription vérifie le numéro (WhatsApp gratuit, SMS, ou WhatsApp par
modèle) : l'**API de vérification doit tourner**
(voir [`../server`](../server/README.md)), sinon l'onboarding s'arrête à l'étape
du code. En développement, aucun SMS n'est réellement envoyé.

```bash
# terminal 1 — API de vérification
cd server && npm install && cp .env.example .env
EXPOSE_DEV_CODE=true npm run dev
# pour voir aussi le canal gratuit, ajoutez WHATSAPP_BUSINESS_NUMBER,
# WHATSAPP_APP_SECRET et WHATSAPP_VERIFY_TOKEN dans .env

# terminal 2 — application
cd mobile && npm install
EXPO_PUBLIC_API_URL=http://localhost:4000 npm start
#   puis « a » pour Android, « i » pour iOS, « w » pour le web
npm test           # logique métier (modération, blocage, géolocalisation)
npm run typecheck
```

Sur un téléphone physique, `localhost` désigne le téléphone lui-même :
remplacez-le par l'adresse de votre machine sur le réseau local
(`EXPO_PUBLIC_API_URL=http://192.168.x.x:4000`).

## Ce qui est implémenté

| Cahier des charges | État |
| --- | --- |
| §4.1 Onboarding en 5 étapes | ✅ langue, compte téléphone, quartier + géolocalisation, présentation, règles |
| §7.1 Vérification du numéro | ✅ trois canaux au choix du voisin : **WhatsApp gratuit** (c'est lui qui envoie le message), SMS, ou WhatsApp par modèle ; renvoi avec délai, essais limités — la décision appartient au serveur |
| §3 Règles obligatoires, bouton verrouillé 3 s | ✅ `useRulesCountdown` |
| §2 Vérification par géolocalisation | ✅ position réelle comparée au quartier déclaré, correction proposée si erreur |
| §2 Quartiers nommés + jumelage | ✅ fil partagé entre cités jumelées, origine affichée sur chaque publication |
| §4.2 Fil de quartier | ✅ recherche, filtres par catégorie, likes, réponses |
| §4.5 Alertes | ✅ fil dédié aux publications « Sécurité » |
| §3 Filtre de texte à la rédaction | ✅ liste évolutive + normalisation anti-contournement |
| §3 Blocage automatique par signalements | ✅ 3 voisins distincts → 3 jours ; récidive → définitif |
| §4.16 Alerte SOS | ✅ bouton flottant sur tous les écrans, choix des voisins alertés, annulation |
| Bilingue FR / AR avec RTL | ✅ bascule immédiate, sans redémarrage |

## Ce qui n'est pas encore branché

Ces points sont des **dépendances externes**, pas des oublis ; ils sont signalés
dans le code et dans l'interface là où l'utilisateur pourrait s'y tromper.

- **Pas de backend pour le contenu.** Le fil, les signalements et les voisins
  sont stockés sur l'appareil (`LocalRepository`) ; seule la vérification du
  numéro passe par un serveur. Le contrat `JiranRepository`
  (`src/data/repository.ts`) est écrit pour qu'un client HTTP/WebSocket le
  remplace sans toucher aux écrans.
- **Aucun envoi réel de SMS tant qu'un fournisseur n'est pas branché** : voir
  le README du serveur pour le choix de l'agrégateur.
- **Pas de modération d'image** (§7.3) : l'ajout de photo est annoncé comme
  indisponible plutôt que simulé — publier une image non modérée irait contre
  la règle §3.
- **Pas de notifications push** (§7.7) : l'écran SOS le dit explicitement,
  l'alerte n'est pour l'instant confirmée que localement.
- **Pas de file de modération humaine** (§7.4) : les signalements sont
  conservés et le blocage automatique s'applique, mais aucun écran modérateur
  n'existe encore.
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
  data/            quartiers réels, contenu de démarrage, stockage
  state/           session, fil, signalements (AppProvider)
  i18n/            dictionnaires fr / ar et sens de lecture
  components/      briques d'interface partagées
  screens/         écrans, dont le parcours d'inscription
  navigation/      onglets + pile, bouton SOS global
```

La logique sensible (modération, blocage, géolocalisation, téléphone) est dans
`src/domain`, sans dépendance à React : c'est elle qui est couverte par les
tests, et c'est elle qui devra être rejouée à l'identique côté serveur.

## Données de quartier

`src/data/neighborhoods.ts` contient un extrait du découpage administratif réel
(communes d'Alger, Boumerdès, Blida) avec leur code de wilaya officiel. À
remplacer par le jeu de données complet partagé avec As3ar (§7.2) — le code de
wilaya est la clé commune prévue entre les deux applications.
