# Jiran — serveur

Trois choses : la **vérification du numéro** à l'inscription (§7.1), le **fil de
quartier partagé** avec sa modération automatique et sa **file pour modérateurs
humains** (§7.4), et les **alertes** — sécurité et SOS — remises sur les
téléphones (§7.7).

## Pourquoi un serveur

Deux raisons, et la seconde est la plus importante.

**Un réseau de quartier ne peut pas vivre sur un téléphone.** Tant que les
publications restaient sur l'appareil, deux voisins ne voyaient pas le même fil
— chacun avait le sien. Et la règle des trois signalements de voisins
différents (§3) ne pouvait jamais se déclencher : un téléphone ne connaît qu'un
seul signalant, le sien.

**La modération doit être hors de portée du client.** Le filtre de texte tourne
aussi dans l'application, pour prévenir pendant la frappe, mais une application
modifiée l'ignore. C'est la version serveur qui refuse une publication, et
c'est le serveur qui compte les signalements.

### Pourquoi un serveur pour la vérification

La vérification ne peut pas se faire dans l'application seule. Un code tiré et
contrôlé sur le téléphone se contourne en lisant la mémoire de l'appareil, et
la clé du fournisseur SMS embarquée dans l'application serait extraite du
paquet en quelques minutes — n'importe qui pourrait alors envoyer des SMS à vos
frais. **L'application ne fabrique ni ne vérifie jamais le code : elle demande
au serveur d'en envoyer un, puis lui soumet ce qui a été saisi.**

## Démarrer

```bash
cd server
npm install
cp .env.example .env     # renseigner OTP_SECRET et SESSION_SECRET
npm run dev              # http://localhost:4000
npm test
```

Avec `SMS_PROVIDER=console` (défaut), **aucun SMS n'est envoyé** : le code
s'affiche dans la console du serveur. Cela suffit pour dérouler toute
l'inscription sans contrat d'agrégateur ni frais d'envoi.

Ajoutez `EXPOSE_DEV_CODE=true` et l'application pré-remplit le code toute
seule. Le serveur refuse ce réglage quand `NODE_ENV=production`.

## Canaux d'envoi

**Le parcours par défaut est celui de toutes les applications : le voisin tape
son numéro, reçoit un code par SMS, le saisit, et l'application s'ouvre.** Avec
seulement `SMS_PROVIDER` configuré, il n'y a aucun choix à faire et aucun écran
supplémentaire.

Les autres canaux ne s'ajoutent que si vous les configurez. L'application
interroge `GET /auth/channels` et n'affiche un choix que lorsqu'il y en a
plusieurs : proposer WhatsApp sans compte Meta reviendrait à promettre un
message qui n'arrivera jamais.

Tout passe par l'interface `MessageProvider` (`src/messaging/provider.ts`) :
ajouter un canal ou changer d'agrégateur, c'est écrire un fichier.

| Canal | Coût | Ouvert quand |
| --- | --- | --- |
| **WhatsApp gratuit** | **aucun envoi, donc rien à payer** | `WHATSAPP_BUSINESS_NUMBER`, `WHATSAPP_APP_SECRET` et `WHATSAPP_VERIFY_TOKEN` sont renseignés |
| SMS | facturé au message par l'agrégateur | `SMS_PROVIDER` vaut `console`, `http` ou `twilio` (`none` le ferme) |
| WhatsApp (modèle) | facturé au message par Meta | `WHATSAPP_PHONE_NUMBER_ID` et `WHATSAPP_ACCESS_TOKEN` sont renseignés |

### Le canal gratuit : une solution de repli, pas le parcours principal

Aucun fournisseur ne délivre de SMS gratuitement, et les modèles WhatsApp
« authentification » sont facturés au message. Ce canal inverse donc le sens du
message : **c'est le voisin qui nous écrit**, pas nous. Il est utile pour un
lancement sans budget, ou pour les voisins que le SMS n'atteint pas — mais il
sort de l'habitude, d'où sa place après le SMS dans la liste.

1. L'application demande un défi ; le serveur prépare un jeton et renvoie un
   lien `wa.me` au message pré-rempli. **Rien n'est envoyé.**
2. Le voisin touche le bouton, WhatsApp s'ouvre, il envoie le message.
3. Meta nous notifie sur `POST /webhooks/whatsapp`. Recevoir un message ne
   coûte rien — la facturation de Meta porte sur les messages que l'entreprise
   **envoie**. Jiran ne répond pas, donc la note reste à zéro.
4. L'application, qui interrogeait `POST /auth/verify-link`, reçoit la session.

La preuve est même meilleure qu'un code recopié : le numéro d'origine nous est
donné par Meta, il n'est pas saisi par l'utilisateur. Deux conditions sont
exigées avant de confirmer — le jeton doit correspondre **et** le message doit
venir du numéro déclaré. Sans le second contrôle, quelqu'un qui devinerait un
jeton ferait valider sa propre ligne à la place du voisin, dont l'application
s'ouvrirait alors sur le compte de l'inconnu.

Limites à connaître : il faut un compte WhatsApp Business (l'accès à la
plateforme est gratuit) et une URL publique en HTTPS pour le webhook ; et cela
ne sert que les voisins qui ont WhatsApp — d'où l'intérêt de garder le SMS en
second choix.

En développement avec `SMS_PROVIDER=console`, **les deux canaux sont ouverts**
et rien n'est envoyé : le choix à l'inscription se teste sans compte WhatsApp
Business.

Les quotas (délai de renvoi, envois par heure) sont tenus **par numéro, tous
canaux confondus** : basculer sur WhatsApp ne remet pas les compteurs à zéro.

**Pour de vrais utilisateurs en Algérie, visez un agrégateur local.** Les
identifiants d'expéditeur doivent être approuvés au préalable chez Mobilis,
Djezzy et Ooredoo, et l'envoi commercial relève du régulateur ; une route
internationale non déclarée se fait filtrer. Quel que soit le fournisseur
retenu, testez sur un vrai numéro de chacun des trois opérateurs avant de vous
engager — un taux de livraison annoncé ne vaut pas un test.

WhatsApp est très répandu en Algérie et échappe à ce filtrage, mais exige un
compte WhatsApp Business vérifié et un modèle « authentification » approuvé par
Meta, et exclut les voisins qui n'utilisent pas WhatsApp. C'est un bon
complément au SMS, pas un remplacement.

## Points d'entrée

### Vérification du numéro

| Route | Effet |
| --- | --- |
| `GET /auth/channels` | Canaux proposés à l'inscription (`whatsapp_link`, `sms`, `whatsapp`) |
| `POST /auth/request-code` `{ phone, channel }` | Envoie un code par le canal demandé (SMS par défaut), renvoie `challengeId` |
| `POST /auth/verify-code` `{ challengeId, code }` | Vérifie le code, renvoie `{ phone, token }` |
| `POST /auth/verify-link` `{ challengeId }` | Relève le défi gratuit : `202` tant que le message n'est pas arrivé, sinon `{ phone, token }` |
| `GET /webhooks/whatsapp` | Validation de l'URL par Meta |
| `POST /webhooks/whatsapp` | Messages entrants — signature `X-Hub-Signature-256` vérifiée avant toute lecture |
| `GET /auth/me` (`Authorization: Bearer …`) | Renvoie le numéro associé au jeton |
| `GET /health` | État du serveur et fournisseur SMS actif |

Codes de retour utiles : `429` avec `Retry-After` pour une limitation de débit,
`401` avec `attemptsLeft` pour un code refusé, `410` pour un code périmé ou déjà
utilisé, `400` avec `channel_unavailable` pour un canal fermé, `502` si la
passerelle a échoué.

### Contenu du quartier

Toutes ces routes exigent l'en-tête `Authorization: Bearer …` obtenu à la
vérification. Le numéro vient du jeton signé, jamais du corps de la requête, et
le quartier vient du membre : un client modifié ne peut ni publier au nom d'un
autre, ni lire le fil d'un quartier où il n'habite pas.

| Route | Effet |
| --- | --- |
| `POST /profile` | Crée ou met à jour le profil du voisin vérifié (prénom, quartier, cité) |
| `GET /feed` | Fil du quartier, jumelage compris, avec verdict de modération par publication |
| `GET /neighbors` | Voisins du même fil, pour la liste de confiance du SOS |
| `POST /posts` | Publie — `422` si le texte est refusé par la modération |
| `POST /posts/:id/like` | Ajoute ou retire un « j'aime » |
| `GET` / `POST /posts/:id/comments` | Lit et ajoute les réponses |
| `POST /posts/:id/report` | Signale — `409` si ce voisin avait déjà signalé ; renvoie le verdict à jour |

### Modération humaine

| Route | Effet |
| --- | --- |
| `GET /moderation/queue` | Contenus signalés du quartier, les plus signalés d'abord |
| `POST /moderation/posts/:id/decision` | `block` ou `restore`, avec une note facultative |

Les modérateurs sont désignés par `MODERATOR_PHONES`. Le cahier des charges
laisse la question ouverte (« qui a le rôle modérateur ? validation manuelle au
départ probablement ») : une liste tenue par l'équipe est la réponse la plus
simple pour démarrer, et elle se remplace par un vrai rôle en base sans toucher
aux écrans.

**Une décision humaine prime sur le compteur.** `block` masque définitivement,
même sans avoir atteint le seuil. `restore` rétablit — et surtout, les
signalements **antérieurs** à la décision cessent de compter : sans cela, le
contenu que le modérateur vient de juger acceptable serait remasqué à la
seconde suivante. De nouveaux signalements, eux, comptent normalement.

### Alertes

| Route | Effet |
| --- | --- |
| `POST /devices` | Enregistre le jeton de notification de l'appareil |
| `DELETE /devices` | Oublie un appareil |
| `POST /sos` | Alerte les voisins choisis — `422` si aucun n'est joignable ; renvoie combien ont été prévenus |
| `POST /sos/:id/cancel` | Fausse alerte : prévient les mêmes voisins |

Une publication de catégorie `securite` déclenche en plus une notification à
tout le fil, sauf à son auteur.

### Notifications

`PUSH_PROVIDER=expo` passe par le service d'Expo, qui relaie vers FCM et APNs.
Il faut avoir déposé les identifiants FCM et APNs dans le projet Expo : sans
eux, les jetons sont acceptés mais rien n'arrive sur les téléphones.

`PUSH_PROVIDER=console` n'envoie rien et l'annonce : la réponse du SOS porte
`delivered: false`, et l'application affiche alors qu'aucun téléphone ne
sonnera. C'est volontaire — sur un bouton d'urgence, une confirmation
trompeuse serait pire que pas de bouton du tout. Le serveur refuse ce réglage
en production.

### Stockage

**PostgreSQL**, désigné par `DATABASE_URL` — chez Supabase en ligne, en local
sur une base ordinaire. Les photos vont dans **Supabase Storage** ; la base ne
garde que leur chemin et leur adresse. Détails, création du projet et variables
à poser : [`docs/base-de-donnees.md`](../docs/base-de-donnees.md).

Le schéma se pose avec `npm run migrate`, jamais au démarrage du serveur : une
base de production ne doit pas changer de forme parce qu'un processus
redémarre.

La table `reports` a pour clé primaire `(post_id, reporter_id)` : la règle « un
voisin ne compte qu'une fois » est tenue par la base elle-même, pas seulement
par le code. Même idée partout ailleurs — `ON DELETE CASCADE` sur toutes les
liaisons, pour qu'une suppression ne puisse pas laisser d'orphelin.

### Ménage quotidien

Les publications s'effacent d'elles-mêmes au bout de 10 à 45 jours selon
l'intérêt qu'elles ont suscité, pour tenir dans les 500 Mo gratuits. Les
comptes, les conversations, les messages et les traces de modération ne sont
jamais touchés. `npm run cleanup` en donne l'aperçu ;
[`docs/base-de-donnees.md`](../docs/base-de-donnees.md) explique les paliers.

## Ce qui protège le système

Sans ces garde-fous, l'API sert de machine à envoyer des SMS aux frais du
projet, et un code à 6 chiffres se devine en quelques milliers d'essais.

- Le code est **haché avant stockage** (HMAC-SHA256, salé par l'identifiant du
  défi) : une fuite de la base ne permet pas de valider des numéros.
- **5 essais** par code, puis il est brûlé — même le bon code ne passe plus.
- **Validité 5 minutes**, usage **unique** : un code validé ne se rejoue pas.
- **60 secondes** entre deux envois, **5 envois par heure et par numéro**, et
  une limite par adresse IP par-dessus.
- Un échec de la passerelle **ne consomme pas** le quota du voisin.
- Comparaison à **temps constant**, codes tirés avec `crypto.randomInt`.
- Les journaux ne contiennent **jamais le numéro entier** ni le code.
- Le jeton de session est signé (HMAC-SHA256), avec un seul algorithme accepté.
- Les webhooks entrants sont **rejetés sans signature Meta valide** : sans ce
  contrôle, quiconque connaît l'URL déclarerait n'importe quel numéro vérifié.
- Le jeton du canal gratuit fait 12 caractères tirés au hasard : il voyage dans
  un message imitable et n'est pas protégé par un compteur d'essais, il doit
  donc être hors de portée d'une recherche exhaustive.

## Le mode essai

Les hébergeurs déclarent tous `NODE_ENV=production`, ce qui fait refuser au
serveur les fournisseurs qui n'envoient rien — un garde-fou voulu. Pour un
essai en ligne sans contrat d'agrégateur, `TRIAL_MODE=true` ouvre
explicitement cette porte : les fournisseurs `console` sont acceptés et le code
de vérification est rendu à l'application.

Elle ne s'ouvre que sur la valeur exacte `true`, le serveur l'annonce dans un
encadré à chaque démarrage, et `/health` la signale. **À retirer avant
d'ouvrir à de vrais voisins** : tant qu'elle est là, n'importe qui peut
s'inscrire sous n'importe quel numéro.

## À reprendre avant la mise en production

- **Stockage en mémoire** : les défis et les compteurs vivent dans le processus.
  Correct pour une instance ; passez à Redis ou une table derrière les mêmes
  interfaces (`ChallengeStore`, `SlidingWindowLimiter`) dès qu'il y en a
  plusieurs.
- **Pas de temps réel** (§7.5) : l'application recharge le fil à l'ouverture et
  au tirer-pour-rafraîchir ; les notifications préviennent des alertes, mais le
  fil lui-même n'arrive pas tout seul.
- **Notifications à brancher** : `PUSH_PROVIDER=expo` et les identifiants FCM /
  APNs dans le projet Expo.
- **Pas de photos** : la modération d'image (§7.3) n'est pas branchée.
- **HTTPS obligatoire** : le code et le jeton circulent en clair sans lui.
