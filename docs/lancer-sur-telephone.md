# Lancer Jiran sur un vrai téléphone Android

Tout a été vérifié jusqu'ici depuis un navigateur. Cette étape-ci vérifie ce
qu'un navigateur ne peut pas montrer : la vraie demande de géolocalisation, le
rendu arabe sur un écran de téléphone, les performances réelles.

Comptez **une heure la première fois**, dont une bonne partie à télécharger
Android Studio. Les fois suivantes, deux commandes suffisent.

---

## 1. À installer une seule fois

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

## 2. Préparer le téléphone

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

## 3. Récupérer le projet

```bash
git clone https://github.com/hafidabbes7-bot/Jiran.git
cd Jiran
git checkout claude/new-session-q7ijf3
```

---

## 4. Démarrer le serveur

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

## 5. Installer l'application sur le téléphone

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
