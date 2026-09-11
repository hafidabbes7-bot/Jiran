# Mettre Jiran en ligne, depuis un téléphone

L'application complète — celle de `mobile/` et `server/`, avec la vérification
du numéro, le fil partagé, la modération et le SOS — tourne alors à une adresse
publique en `https://`. Vous la partagez comme n'importe quel lien : vos voisins
ouvrent, s'inscrivent, et c'est tout. **Aucun ordinateur, aucun compte Claude,
aucune installation.**

Comptez **dix minutes**, tout au navigateur.

---

## Avant de commencer : ce que vous obtenez, et ce que vous n'obtenez pas

L'hébergement gratuit convient à un essai et pas à un lancement. Deux limites
à connaître **avant** d'inviter des voisins :

- **Le service s'endort** après un quart d'heure sans visite. La visite
  suivante le réveille, et cette première page met 30 à 60 secondes à
  s'afficher. Les suivantes sont immédiates.
- **Les publications sont perdues à chaque réveil.** Le quartier repart vide.
  Pour un essai d'une soirée c'est sans importance ; pour garder les données, il
  faut une formule payante avec disque (environ 7 $/mois) ou une vraie base.

Et, comme c'est une configuration d'essai : **aucun SMS n'est envoyé**, le code
de vérification se remplit tout seul. N'importe qui ayant le lien peut donc
s'inscrire sous n'importe quel prénom. C'est voulu pour essayer sans contrat
d'agrégateur — ce n'est pas une configuration à laisser en place pour de vrai.

---

## 1. Créer le compte d'hébergement

1. Ouvrez **render.com** dans le navigateur du téléphone
2. **Get Started** → **GitHub** → connectez-vous avec le compte qui possède le
   dépôt Jiran
3. Autorisez Render à voir le dépôt (vous pouvez ne lui donner accès qu'à
   celui-là)

## 2. Déployer

1. Dans le tableau de bord : **New +** → **Blueprint**
2. Choisissez le dépôt **Jiran**
3. **Choisissez la branche `main`.** Render lit `render.yaml` et prépare tout
   seul le service, les secrets et la configuration.
4. **Apply** / **Create**

La première construction prend 3 à 5 minutes : elle installe les dépendances et
construit l'application web. Vous pouvez fermer la page, ça continue.

Quand le service passe à **Live**, son adresse s'affiche en haut, du genre
`https://jiran-essai.onrender.com`. **C'est le lien à partager.**

## 3. Vous nommer modérateur

Pour avoir accès à la file des signalements :

1. Dans le service → **Environment**
2. Modifiez `MODERATOR_PHONES` : mettez le numéro avec lequel vous vous
   inscrirez, par exemple `0555123456`
3. **Save** — le service redémarre tout seul

L'entrée « Signalements en attente » apparaîtra dans l'onglet *Quartier*, pour
vous seul.

---

## 4. Faire essayer aux voisins

Partagez le lien. Dites-leur trois choses :

- **choisissez tous le même quartier**, sinon vous ne vous verrez pas ;
- le code à 6 chiffres arrive tout seul, il n'y a pas de SMS à attendre ;
- n'importe quel numéro commençant par 05, 06 ou 07 fonctionne — inutile de
  donner le vrai.

Ce qui marchera : l'inscription, le fil partagé, les catégories, les réponses,
les « j'aime », les signalements avec masquage à trois voisins différents, la
file du modérateur, le SOS, et la bascule français / arabe.

Ce qui ne marchera pas : **les notifications**. Un SOS n'apparaît que chez un
voisin qui a la page ouverte ou qui la rouvre. C'est la seule fonctionnalité du
socle que l'hébergement ne suffit pas à activer — il lui faut les identifiants
FCM et APNs, et une application installée.

---

## Quand l'essai aura servi

Pour passer de l'essai au vrai :

| Quoi | Où |
| --- | --- |
| Envoyer de vrais SMS | `SMS_PROVIDER=http` + les identifiants de votre agrégateur, et retirer `EXPOSE_DEV_CODE` — voir [`server/README.md`](../server/README.md) |
| Garder les publications | formule avec disque, et `DATABASE_PATH` pointant dessus |
| Notifications | identifiants FCM / APNs, `PUSH_PROVIDER=expo`, et une application installée — voir [`lancer-sur-telephone.md`](lancer-sur-telephone.md) |
| Application installable | `npx eas-cli build --platform android --profile apk` avec `EXPO_PUBLIC_API_URL` pointant sur cette adresse |

Ce dernier point est le plus agréable : une fois le serveur en ligne, l'APK n'a
plus besoin d'un ordinateur allumé chez vous pour fonctionner.

---

## Si ça coince

| Ce que vous voyez | Ce que c'est |
| --- | --- |
| La construction échoue | Regardez l'onglet **Logs**. Le plus souvent : la mauvaise branche a été choisie — ce doit être `main` |
| La page met une minute à s'ouvrir | Le service dormait. C'est normal sur la formule gratuite |
| Le quartier est vide alors qu'on y avait publié | Le service a redémarré. Les données ne survivent pas sans disque |
| « Serveur injoignable » dans l'application | Le service est en train de redémarrer ou la construction a échoué |
| Pas d'entrée « Signalements en attente » | `MODERATOR_PHONES` ne contient pas le numéro avec lequel vous vous êtes inscrit |
