# La base de données de Jiran

Avant, Jiran gardait tout dans un fichier posé à côté du serveur. Sur
l'hébergement gratuit de Render, ce fichier disparaît à chaque redéploiement et
à chaque réveil du service endormi. C'est ce qui expliquait le « des fois quand
je rentre à l'app tout mon contenu disparaît ».

Maintenant : **PostgreSQL chez Supabase** pour les données, **Supabase Storage**
pour les photos. Les deux sont gratuits, et surtout ils survivent au serveur.

---

## 1. Créer la base chez Supabase

1. Allez sur [supabase.com](https://supabase.com) → **Start your project** →
   connectez-vous avec GitHub.
2. **New project**. Nommez-le `jiran`, choisissez la région **Frankfurt** (la
   plus proche de l'Algérie parmi les gratuites), et **choisissez un mot de
   passe de base de données**. Notez-le : il n'est plus affiché ensuite.
3. Attendez deux minutes que le projet soit prêt.

### L'adresse de connexion — attention, il y en a deux

**Project Settings → Database → Connection string.** Supabase en propose
plusieurs, et **celle qui s'affiche en premier ne marche pas sur Render** :

| Onglet | Adresse | Sur Render |
| --- | --- | --- |
| Direct connection | `db.abcdefgh.supabase.co` | ❌ **n'existe qu'en IPv6**, que Render ne sait pas joindre |
| **Session pooler** | `aws-0-eu-central-1.pooler.supabase.com` | ✅ **celle-ci** |
| Transaction pooler | même hôte, port 6543 | fonctionne aussi |

Prenez donc le **Session pooler**, de cette forme :

```
postgresql://postgres.abcdefgh:LE_MOT_DE_PASSE@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
```

Remplacez `LE_MOT_DE_PASSE` (affiché `[YOUR-PASSWORD]`) par celui choisi à la
création du projet. S'il contient `@`, `/`, `:` ou `#`, changez-le pour quelque
chose de simple : ces caractères ont un sens dans une adresse et la coupent en
deux.

`npm run migrate` prévient tout seul si vous avez pris la mauvaise adresse ou
laissé `[YOUR-PASSWORD]` en place — ça évite un déploiement raté pour rien.

C'est la valeur de `DATABASE_URL`. Elle contient le mot de passe de la base :
elle ne doit **jamais** être écrite dans le code, ni dans un fichier du dépôt,
ni envoyée dans une conversation. Elle se colle directement dans l'onglet
**Environment** de Render, et nulle part ailleurs.

### Le stockage des photos

1. **Storage → New bucket**, nom `jiran-photos`, cochez **Public bucket**.
2. **Project Settings → API** : copiez `Project URL` (→ `SUPABASE_URL`) et la
   clé **`service_role`** (→ `SUPABASE_SERVICE_KEY`).

La clé `service_role` donne tous les droits sur le stockage. Elle reste côté
serveur ; l'application sur le téléphone ne la voit jamais, et ne reçoit que des
adresses de photos.

---

## 2. Les variables à mettre dans Render

Onglet **Environment** du service, bouton **Add Environment Variable** :

| Variable | Valeur | Obligatoire |
| --- | --- | --- |
| `DATABASE_URL` | l'URI Supabase ci-dessus | oui |
| `SUPABASE_URL` | `https://xxxx.supabase.co` | pour les photos |
| `SUPABASE_SERVICE_KEY` | la clé `service_role` | pour les photos |
| `SUPABASE_BUCKET` | `jiran-photos` | non (valeur par défaut) |
| `CLEANUP_ENABLED` | `false` pour couper le ménage automatique | non |

Sans `SUPABASE_URL` et `SUPABASE_SERVICE_KEY`, l'application continue de
fonctionner : les photos sont alors rangées dans la base elle-même. C'est un
repli, pas un but — 400 Ko par photo rempliraient les 500 Mo offerts en
quelques centaines de publications.

---

## 3. Poser les tables

```bash
npm run migrate
```

Cette commande est **séparée du démarrage du serveur**, volontairement. Une base
de production ne doit pas changer de forme parce qu'un processus redémarre, et
un serveur qui recrée sa base au démarrage est un serveur qui, un jour, l'efface.
Sur Render, elle tourne à la construction : `buildCommand` se termine par
`npm run migrate`, avant que le service ne démarre.

La commande n'applique que les migrations qui manquent, chacune dans sa propre
transaction, et refuse une migration déjà jouée dont le contenu aurait changé.
Elle ne contient ni `DROP DATABASE`, ni `DROP SCHEMA`, ni aucune remise à zéro.

---

## 4. Ce que contient la base

28 tables. Les principales :

| Table | Ce qu'elle garde |
| --- | --- |
| `members` | le compte, rattaché à un identifiant vérifié (numéro **ou** e-mail) |
| `posts`, `comments`, `likes` | le fil du quartier |
| `photos` | le chemin et l'adresse de la photo chez Supabase — jamais le fichier lui-même quand le stockage est configuré |
| `reports`, `moderation_decisions` | les signalements et les décisions des modérateurs |
| `conversations`, `messages` | les messages privés : participants, contenu, date, date de lecture |
| `notifications` | le journal des notifications de chaque voisin |
| `devices`, `sos_alerts`, `sos_targets` | le SOS et les appareils à joindre |
| `stories`, `games` | les stories de 24 h, les parties entre voisins |
| `services`, `items`, `groups`, `places`, `vacations`, `waste_slots`, `solidarity_actions` | la vie de quartier |

Les quartiers ne sont **pas** en base : les 1 554 communes sont dans le code,
parce que l'application doit pouvoir les proposer avant même d'avoir un compte,
et hors connexion.

Toutes les liaisons sont posées avec `ON DELETE CASCADE`. Supprimer une
publication emporte ses j'aime, ses réponses et ses signalements — la base s'en
charge, pas le code, donc il ne peut pas rester d'orphelin.

---

## 5. Le ménage automatique

L'offre gratuite de Supabase donne 500 Mo. Une publication de quartier ne sert
plus à grand-chose passé quelques semaines. Le ménage garde donc plus longtemps
ce que le quartier a réellement lu :

| Interactions (j'aime + réponses) | Conservée |
| --- | --- |
| 0 | 10 jours |
| 1 à 4 | 20 jours |
| 5 à 19 | 30 jours |
| 20 et plus | 45 jours |

Le décompte part de la **date de publication**, jamais de la dernière
interaction : sinon une publication animée ne s'effacerait jamais, et la place
ne serait jamais rendue.

Quand une publication part, partent avec elle ses j'aime, ses réponses, ses
signalements, et sa photo — d'abord retirée du stockage Supabase, puis de la
base. Dans cet ordre : si le stockage refuse, la publication reste et le
passage suivant réessaiera. L'inverse laisserait un fichier que plus rien ne
désigne, c'est-à-dire de la place perdue pour toujours.

**Ce que le ménage ne touche jamais** : les comptes, les quartiers, les
conversations, les messages, les signalements traités et les décisions de
modération. Un message privé qui disparaîtrait tout seul serait une perte sèche
pour le voisin ; une trace de modération effacée, une perte pour la sécurité du
quartier.

### Le lancer à la main

```bash
npm run cleanup                 # aperçu : dit ce qui partirait, ne supprime rien
npm run cleanup -- --appliquer  # supprime pour de vrai
```

L'aperçu est le défaut. Une commande qui efface des publications ne doit pas
être ce qui se produit quand on la lance pour voir ce qu'elle fait.

### Automatiquement

Le serveur le lance une fois par jour tout seul (les tâches planifiées de Render
sont payantes ; un minuteur dans le processus est ce qui reste). `CLEANUP_ENABLED=false`
le coupe.

Une limite à connaître : sur la formule gratuite, le service s'endort après
quinze minutes sans visite, et un minuteur endormi ne se déclenche pas. Le
premier passage a donc lieu peu après chaque démarrage, ce qui rattrape le
retard dès que quelqu'un ouvre l'application.

---

## 6. Vérifier que tout tient

Après un redémarrage ou un redéploiement :

1. `https://votre-service.onrender.com/health` doit répondre
   `"database": {"configured": true}` et `"photos": {"storage": "supabase"}`.
2. Rouvrez l'application : le fil, les messages et le profil doivent être là.
3. Dans Supabase, **Table Editor → posts** montre les mêmes publications.

Si `/health` dit `"configured": false`, `DATABASE_URL` n'est pas arrivée
jusqu'au service — le serveur refuse alors de démarrer, et le journal de Render
le dit en toutes lettres.

---

## 7. En développement

```bash
# une base PostgreSQL locale suffit
createdb jiran
DATABASE_URL=postgresql://localhost/jiran npm run migrate --prefix server
DATABASE_URL=postgresql://localhost/jiran npm start
```

Pour les tests, copiez `server/.env.test.example` en `server/.env.test` et
adaptez l'adresse. Les tests parlent à une vraie base PostgreSQL — chacun dans
son propre schéma, pour pouvoir tourner en parallèle — et non à une imitation :
les contraintes et les erreurs de PostgreSQL ne sont pas celles d'un autre
moteur, et une suite verte doit prouver quelque chose de ce qui tourne en ligne.

> La base de test est vidée et ses schémas supprimés à chaque exécution. Ne
> mettez jamais dans `TEST_DATABASE_URL` l'adresse d'une base qui contient de
> vraies données.
