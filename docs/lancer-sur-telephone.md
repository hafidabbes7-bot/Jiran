# Lancer Jiran sur un vrai téléphone Android

Tout a été vérifié jusqu'ici depuis un navigateur. Cette étape-ci vérifie ce
qu'un navigateur ne peut pas montrer : la vraie demande de géolocalisation, le
rendu arabe sur un écran de téléphone, les performances réelles.

Trois chemins, du plus rapide au plus complet.

| | **0. Un lien à partager** | **A. Un fichier APK** | **B. Depuis l'ordinateur** |
| --- | --- | --- | --- |
| À installer côté voisin | rien | l'APK | l'APK |
| À installer chez vous | Node.js | Node.js | + Android Studio (~1 Go) |
| Attente | 2 min | ~15 min, dans le nuage | ~20 min la 1ʳᵉ fois |
| Compte à créer | aucun | un compte Expo, gratuit | aucun |
| Ce qu'on ne peut pas essayer | les notifications | les notifications | rien |

**Pour faire essayer à deux ou trois voisins cette semaine, prenez le chemin
0** : ils ouvrent un lien dans leur navigateur, rien à installer, et tout
fonctionne — inscription, fil partagé, signalements, SOS. Seules les
notifications manquent, et elles ne sont de toute façon pas encore branchées.

Prenez le chemin A quand vous voudrez une vraie application installée sur les
téléphones, et le B quand vous voudrez modifier le code.

Dans les trois cas, **le serveur doit tourner quelque part** : l'application ne
fait rien sans lui.

---

## 0. Un lien à partager, sans rien installer

Une seule commande, à la racine du projet :

```bash
npm run install:all   # la première fois seulement
npm run essai
```

Elle construit l'application, crée les secrets du serveur, et démarre le tout.
Le serveur sert l'application **et** l'API à la même adresse : il n'y a donc
rien à configurer, ni chez vous ni chez vos voisins.

Puis, dans un **second terminal**, ouvrez un tunnel :

```bash
npx localtunnel --port 4000
```

Il affiche une adresse en `https://…`. **C'est celle-là qu'on partage** — par
WhatsApp, par exemple. Elle marche depuis n'importe où, même sur les données
mobiles.

> ⚠️ **Il faut du `https://`, pas du `http://`.** Les navigateurs refusent la
> géolocalisation sur une adresse non sécurisée : vos voisins seraient bloqués
> à l'étape « Confirmer ma position », sans comprendre pourquoi. L'adresse
> `http://192.168.…` affichée par la commande ne sert donc qu'à regarder
> depuis votre propre ordinateur.

Ce qu'il faut savoir pour l'essai :

- **Aucun SMS n'est envoyé.** Le code à 6 chiffres se remplit tout seul. Il
  s'affiche aussi dans votre terminal.
- **Chaque voisin doit choisir le même quartier**, sinon ils ne se verront pas.
- **Il faut trois voisins différents** pour qu'un signalement masque une
  publication : c'est tout l'objet de la règle.
- Le tunnel s'arrête quand vous fermez le terminal, et l'adresse change à
  chaque fois. C'est fait pour essayer, pas pour durer.

---

## A. Un fichier APK, sans installer Android Studio

Expo compile dans le nuage et vous rend un lien de téléchargement. Il faut un
compte sur expo.dev — gratuit, et le plan gratuit suffit largement.

```bash
cd Jiran/mobile
npm install
npx eas-cli@latest login      # crée le compte si besoin
npx eas-cli@latest init       # affiche un identifiant de projet
```

`eas init` affiche un identifiant du genre `1a2b3c4d-…`. Ouvrez
`mobile/app.config.js`, trouvez la ligne commentée `extra: { eas: …` vers le
milieu du fichier, décommentez-la et collez l'identifiant à la place des zéros.

Ensuite, **indiquez où joindre le serveur**. Ouvrez `mobile/eas.json` : le
profil `apk-local` contient une adresse d'exemple, remplacez-la par l'adresse
de votre ordinateur sur le Wi-Fi (voir « Trouver l'adresse de votre
ordinateur », étape 4) :

```json
"EXPO_PUBLIC_API_URL": "http://192.168.1.10:4000"
```

Puis lancez la compilation :

```bash
npx eas-cli@latest build --platform android --profile apk-local
```

Une quinzaine de minutes plus tard, la commande affiche un lien — et un
QR code. **Ouvrez ce lien depuis le téléphone** : il télécharge l'APK. Android
demandera d'autoriser l'installation depuis cette source, acceptez.

Ce même lien s'envoie par WhatsApp à qui vous voulez faire essayer.

> **Pourquoi un profil séparé `apk-local` ?** Un APK est une version
> « release », et Android y refuse le HTTP non chiffré depuis Android 9 — à
> juste titre. Ce profil lève l'interdiction pour pouvoir joindre un serveur de
> développement sur le réseau local. Le jour où le serveur sera en ligne
> derrière du HTTPS, utilisez le profil `apk`, qui ne la lève pas.

Une fois l'APK installé, passez directement à l'étape 4 (démarrer le serveur),
puis à l'étape 6 (ce qu'il faut regarder).

---

## B. Installer depuis l'ordinateur, câble branché

Comptez **une heure la première fois**, dont une bonne partie à télécharger
Android Studio. Les fois suivantes, deux commandes suffisent.

---

### 1. À installer une seule fois

| Outil | Où | Remarque |
| --- | --- | --- |
| **Node.js 22** | nodejs.org | Prenez la version « LTS » |
| **Git** | git-scm.com | Déjà présent sur macOS |
| **Android Studio** | developer.android.com/studio | Gros téléchargement (~1 Go) |

À la première ouverture d'Android Studio, l'assistant propose une installation
« Standard » : acceptez-la. Elle installe le SDK Android et `adb`, l'outil qui
parle au téléphone. C'est tout ce qu'on lui demande — on n'écrira pas une ligne
dedans.

**Windows uniquement** : après l'installation, fermez puis rouvrez votre
terminal, pour qu'il voie les nouveaux outils.

---

### 2. Préparer le téléphone

1. **Réglages → À propos du téléphone**
2. Appuyez **7 fois de suite** sur « Numéro de build » (ou « Numéro de
   version »). Un message confirme : « Vous êtes maintenant développeur ».
3. Revenez dans **Réglages → Système → Options pour les développeurs**
4. Activez **Débogage USB**
5. Branchez le téléphone à l'ordinateur en USB
6. Une fenêtre apparaît sur le téléphone : **Autoriser le débogage USB** →
   cochez « Toujours autoriser » et acceptez

Vérifiez que l'ordinateur voit bien le téléphone :

```bash
adb devices
```

Vous devez voir une ligne avec un numéro puis `device`. Si la liste est vide,
voir « Si ça coince » plus bas.

---

### 3. Récupérer le projet

```bash
git clone https://github.com/hafidabbes7-bot/Jiran.git
cd Jiran
git checkout claude/new-session-q7ijf3
```

---

## 4. Démarrer le serveur (les deux chemins)

Le téléphone ne peut pas faire grand-chose sans lui : c'est lui qui envoie les
codes de vérification et qui porte le fil du quartier.

```bash
cd server
npm install
cp .env.example .env
```

Ouvrez `server/.env` et remplissez les deux secrets. Pour en générer un :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Lancez la commande deux fois, et collez chaque résultat :

```
OTP_SECRET=le premier résultat
SESSION_SECRET=le second résultat
EXPOSE_DEV_CODE=true
```

`EXPOSE_DEV_CODE=true` fait remplir le code automatiquement dans
l'application : aucun SMS n'est envoyé et vous n'avez rien à recopier. C'est
réservé au développement — le serveur refuse ce réglage en production.

Puis démarrez :

```bash
npm run dev
```

Laissez ce terminal ouvert. Il affichera les codes de vérification et les
alertes.

### Trouver l'adresse de votre ordinateur

Le téléphone doit joindre votre ordinateur **sur le même Wi-Fi**. Il lui faut
son adresse locale :

```bash
# Windows
ipconfig
#  → cherchez « Adresse IPv4 », du genre 192.168.1.10

# macOS / Linux
ipconfig getifaddr en0 || hostname -I
```

Notez cette adresse. Elle commence presque toujours par `192.168.` ou `10.`.

---

## 5. Installer l'application depuis l'ordinateur (chemin B seulement)

Dans un **second terminal** :

```bash
cd Jiran/mobile
npm install
cp .env.example .env
```

Ouvrez `mobile/.env` et mettez l'adresse notée à l'étape précédente :

```
EXPO_PUBLIC_API_URL=http://192.168.1.10:4000
```

⚠️ Surtout pas `localhost` : sur le téléphone, « localhost » désigne le
téléphone lui-même, pas votre ordinateur.

Puis, téléphone branché :

```bash
npx expo run:android
```

**La première fois, comptez 10 à 20 minutes** : Gradle télécharge de quoi
compiler. Les fois suivantes, c'est une à deux minutes. À la fin,
l'application s'installe et s'ouvre toute seule sur le téléphone.

Vous pouvez ensuite débrancher le téléphone : l'application reste installée.
Mais elle aura besoin du serveur (donc du Wi-Fi et de l'ordinateur allumé)
pour fonctionner.

> **Pour l'essayer ailleurs que chez vous** — sur les données mobiles, ou pour
> faire essayer à quelqu'un d'autre — il faut que le serveur soit joignable
> depuis Internet, en HTTPS. Le plus rapide est un tunnel temporaire :
> `npx localtunnel --port 4000` affiche une adresse `https://…` à mettre dans
> `EXPO_PUBLIC_API_URL`. Avec du HTTPS, le profil `apk` suffit et l'exception
> pour le HTTP en clair devient inutile.

---

## 6. Ce qu'il faut regarder, une fois dessus

C'est le but de l'exercice — voici ce qu'un navigateur ne pouvait pas montrer :

- [ ] **L'inscription** : le code à 6 chiffres se remplit tout seul (grâce à
      `EXPOSE_DEV_CODE`). Il apparaît aussi dans le terminal du serveur.
- [ ] **« Confirmer ma position »** : Android doit afficher sa vraie demande
      d'autorisation, **en français**, avec le texte de Jiran. Vérifiez que la
      position est acceptée si vous êtes dans un des quartiers de la liste — et
      qu'elle propose le bon quartier si vous en choisissez un autre.
- [ ] **Les règles du quartier** : le bouton reste bien verrouillé 3 secondes.
- [ ] **La bascule en arabe** (bouton ع en haut) : toute l'interface doit
      passer de droite à gauche, y compris les puces de catégories et la barre
      du bas.
- [ ] **Publier**, puis écrire un mot grossier : le bouton doit se désactiver
      pendant la frappe.
- [ ] **Le bouton SOS** : il doit rester visible sur tous les écrans, et
      l'écran de confirmation doit dire franchement qu'aucun téléphone ne
      sonnera tant que les notifications ne sont pas branchées (voir §7).
- [ ] **Le confort général** : lenteurs, textes coupés, zones trop petites pour
      le pouce. C'est ce qui se voit seulement sur un vrai écran.

Pour tester à plusieurs, refaites l'étape 5 sur un second téléphone : les deux
verront le même fil, et il faut **trois voisins différents** pour déclencher un
masquage automatique.

---

## 7. Les notifications (à faire plus tard)

Les alertes de sécurité et les SOS ne feront sonner aucun téléphone tant que
cette étape n'est pas faite. Elle est indépendante du reste — l'application
fonctionne sans.

Il faut, dans l'ordre :

1. Un **compte Expo** (expo.dev) et `npx eas init` dans `mobile/`, qui inscrit
   un identifiant de projet dans `app.json`.
2. Un **projet Firebase** (console.firebase.google.com), avec une application
   Android déclarée sous le nom de paquet `dz.jiran.app`. Téléchargez le
   `google-services.json` qu'il propose.
3. Déposer la clé FCM dans le projet Expo : `npx eas credentials`, plateforme
   Android, « Push Notifications ».
4. Côté serveur, passer `PUSH_PROVIDER=expo` dans `server/.env`.

Pour iOS, il faut en plus un **compte développeur Apple payant** (99 $/an) :
sans lui, aucune notification n'est possible sur iPhone.

---

## Si ça coince

| Ce que vous voyez | Ce que c'est |
| --- | --- |
| `adb devices` ne montre rien | Câble qui ne transmet que le courant (essayez-en un autre), ou autorisation refusée sur le téléphone : débranchez, rebranchez, acceptez la fenêtre |
| `SDK location not found` | Android Studio n'a pas fini son installation, ou le terminal n'a pas été rouvert depuis |
| L'application s'ouvre mais affiche « Serveur injoignable » | L'adresse dans `mobile/.env` est fausse, le téléphone n'est pas sur le même Wi-Fi, ou le pare-feu de Windows bloque le port 4000 — autorisez Node.js quand Windows le demande |
| Le code de vérification n'arrive pas | Normal : aucun SMS n'est envoyé en développement. Le code est dans le terminal du serveur, et rempli automatiquement si `EXPOSE_DEV_CODE=true` |
| « Numéro algérien invalide » | Le numéro doit commencer par 05, 06 ou 07 et faire 10 chiffres |
| La position est refusée | Vous n'êtes pas dans un des quartiers de la liste. L'application propose alors le plus proche : acceptez sa proposition |
| Gradle échoue sur un manque de mémoire | Fermez Android Studio pendant la compilation ; il n'a pas besoin d'être ouvert |

---

## Les fois suivantes

Une fois tout installé, il ne reste que deux commandes, dans deux terminaux :

```bash
cd Jiran/server && npm run dev
cd Jiran/mobile && npx expo run:android
```
