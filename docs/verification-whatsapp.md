# Vérifier les numéros gratuitement, par WhatsApp

Le SMS se paie au message et demande un contrat d'agrégateur, avec un nom
d'expéditeur à faire approuver chez Mobilis, Djezzy et Ooredoo. Ce chemin-ci
évite tout cela **sans renoncer au numéro de téléphone** — ce qui distingue un
voisin vérifié d'un inconnu.

Le principe tient en une phrase : **au lieu de lui envoyer un code, c'est le
voisin qui nous envoie un message.** Il touche un bouton, WhatsApp s'ouvre avec
un message déjà écrit, il l'envoie. Meta nous prévient — et nous dit de quel
numéro le message vient.

Recevoir un message ne coûte rien : la facturation de Meta porte sur les
messages qu'une entreprise **envoie**, et Jiran n'en envoie aucun. La preuve est
même meilleure qu'un code recopié : le numéro vient de WhatsApp, il n'est pas
saisi par l'utilisateur, donc il n'y a rien à intercepter ni à se faire dicter
au téléphone par un escroc.

Tout est déjà dans le code. Il reste à obtenir un compte chez Meta.

---

## 1. Créer le compte

1. Ouvrez **business.facebook.com** et créez un compte professionnel au nom de
   Jiran (gratuit)
2. Ouvrez ensuite **developers.facebook.com** → **My Apps** → **Create App** →
   type **Business**
3. Dans l'application, ajoutez le produit **WhatsApp**
4. Meta fournit un **numéro d'essai** immédiatement. Il suffit pour commencer ;
   pour un vrai lancement, vous déclarerez votre propre numéro.

Notez deux valeurs, elles serviront à l'étape 3 :

- le **numéro** de l'expéditeur, au format international **sans le `+`** —
  par exemple `213555123456` ;
- le **App secret**, dans *Paramètres → Général* de l'application Meta.

## 2. Brancher le webhook

C'est par là que Meta nous prévient qu'un message est arrivé.

1. Dans l'application Meta : **WhatsApp → Configuration → Webhooks** → *Edit*
2. **Callback URL** : l'adresse de votre serveur suivie de
   `/webhooks/whatsapp`, par exemple
   `https://jiran-essai.onrender.com/webhooks/whatsapp`
3. **Verify token** : recopiez la valeur de `WHATSAPP_VERIFY_TOKEN` affichée
   dans le tableau de bord de votre hébergeur (elle y a été générée toute
   seule)
4. *Verify and save* — Meta appelle le serveur pour vérifier l'adresse
5. Abonnez-vous au champ **messages**

## 3. Renseigner le serveur

Dans le tableau de bord de l'hébergeur, section *Environment* :

| Variable | Valeur |
| --- | --- |
| `WHATSAPP_BUSINESS_NUMBER` | le numéro sans le `+`, ex. `213555123456` |
| `WHATSAPP_APP_SECRET` | le *App secret* de l'application Meta |
| `WHATSAPP_VERIFY_TOKEN` | déjà généré — c'est celui collé chez Meta |

Enregistrez : le service redémarre, et l'option **WhatsApp** apparaît à
l'inscription.

## 4. Se passer du SMS complètement

Tant que `SMS_PROVIDER` vaut `console`, le code s'affiche tout seul : pratique
pour essayer, à ne pas laisser pour de vrais utilisateurs.

Le jour du lancement, mettez `SMS_PROVIDER=none` et retirez `EXPOSE_DEV_CODE`.
Il ne restera que la vérification WhatsApp — gratuite, et le numéro reste
prouvé.

Si vous ajoutez un contrat SMS plus tard, remettez `SMS_PROVIDER=http` avec les
identifiants de l'agrégateur : les deux options cohabitent, et le voisin
choisit.

---

## Ce qu'il faut savoir

- **Cela ne sert que les voisins qui ont WhatsApp.** En Algérie c'est la
  quasi-totalité, mais pas tout le monde — d'où l'intérêt de garder le SMS en
  second choix le jour où le budget le permet.
- **Le numéro d'essai de Meta a des limites** (nombre de correspondants,
  durée). Pour un vrai lancement, il faut déclarer votre propre numéro et faire
  vérifier l'entreprise — c'est gratuit, mais cela prend quelques jours.
- **Les quotas sont communs aux canaux** : basculer de SMS à WhatsApp ne remet
  pas à zéro le délai entre deux demandes de code.
