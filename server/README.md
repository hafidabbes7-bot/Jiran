# Jiran — API de vérification du numéro

Vérification du numéro de téléphone à l'inscription : le voisin saisit son
numéro, reçoit un code à 6 chiffres, le saisit, et son compte est validé (§7.1
du cahier des charges).

## Pourquoi un serveur

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

Le canal se choisit par la variable `SMS_PROVIDER`, sans toucher au reste du
code : tout passe par l'interface `SmsProvider` (`src/sms/provider.ts`).

| Valeur | Usage |
| --- | --- |
| `console` | Développement — affiche le code, n'envoie rien |
| `http` | Passerelle d'un agrégateur local algérien (noms des champs configurables) |
| `twilio` | Twilio |
| `whatsapp` | WhatsApp Cloud API (Meta) |

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

| Route | Effet |
| --- | --- |
| `POST /auth/request-code` `{ phone }` | Envoie un code, renvoie `challengeId` |
| `POST /auth/verify-code` `{ challengeId, code }` | Vérifie le code, renvoie `{ phone, token }` |
| `GET /auth/me` (`Authorization: Bearer …`) | Renvoie le numéro associé au jeton |
| `GET /health` | État du serveur et fournisseur SMS actif |

Codes de retour utiles : `429` avec `Retry-After` pour une limitation de débit,
`401` avec `attemptsLeft` pour un code refusé, `410` pour un code périmé ou déjà
utilisé, `502` si la passerelle a échoué.

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

## À reprendre avant la mise en production

- **Stockage en mémoire** : les défis et les compteurs vivent dans le processus.
  Correct pour une instance ; passez à Redis ou une table derrière les mêmes
  interfaces (`ChallengeStore`, `SlidingWindowLimiter`) dès qu'il y en a
  plusieurs.
- **Aucun compte utilisateur persistant** : le jeton prouve qu'un numéro a été
  vérifié, rien de plus. Les comptes, les publications et la file de modération
  (§7.4) restent à faire.
- **HTTPS obligatoire** : le code et le jeton circulent en clair sans lui.
