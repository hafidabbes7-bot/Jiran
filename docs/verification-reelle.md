# Brancher la vraie vérification du numéro

Aujourd'hui, sur le lien Render, **le code s'affiche à l'écran** : c'est le mode
d'essai (`TRIAL_MODE=true`). N'importe qui peut donc créer un compte avec
n'importe quel numéro. Tout le reste — le code à 6 chiffres, son expiration, les
limites d'envoi, le jeton de session — est déjà en place et fonctionne : il ne
manque **qu'un compte chez un expéditeur**.

Deux chemins. Le premier est gratuit, le second coûte quelques centimes par SMS.
Dans les deux cas, le travail est le même : créer un compte, copier trois ou
quatre valeurs, les coller dans Render. Aucune ligne de code à écrire.

Quand une de ces configurations est en place, le code **cesse tout seul** de
s'afficher à l'écran, même si `TRIAL_MODE` reste à `true` : le serveur le voit et
referme la porte.

---

## Chemin 1 — WhatsApp, gratuit (recommandé pour commencer)

Meta offre 1 000 conversations de service par mois sur l'API WhatsApp Cloud.
Pour un quartier, c'est largement au-dessus du nécessaire.

1. Aller sur **developers.facebook.com**, se connecter avec un compte Facebook,
   puis **Mes applications → Créer une application → Entreprise**.
2. Ajouter le produit **WhatsApp**. Meta fournit un **numéro de test** et un
   **jeton temporaire** (24 h) : c'est assez pour essayer le jour même.
3. Noter deux valeurs sur la page « Démarrage rapide » :
   - **Identifiant du numéro de téléphone** → `WHATSAPP_PHONE_NUMBER_ID`
   - **Jeton d'accès** → `WHATSAPP_ACCESS_TOKEN`
4. Créer le modèle de message : **WhatsApp → Gestionnaire → Modèles → Créer**.
   - Catégorie : **Authentification**
   - Nom : `jiran_verification` (ou un autre, à reporter dans
     `WHATSAPP_TEMPLATE_NAME`)
   - Langue : français (`WHATSAPP_TEMPLATE_LANGUAGE=fr`)
   - Corps : le modèle d'authentification de Meta, avec le code en variable.
   L'approbation prend de quelques minutes à quelques heures.
5. Dans **Render → le service jiran-essai → Environment → Add Environment
   Variable**, ajouter :

   | Clé | Valeur |
   | --- | --- |
   | `WHATSAPP_PHONE_NUMBER_ID` | l'identifiant de l'étape 3 |
   | `WHATSAPP_ACCESS_TOKEN` | le jeton de l'étape 3 |
   | `WHATSAPP_TEMPLATE_NAME` | `jiran_verification` |
   | `WHATSAPP_TEMPLATE_LANGUAGE` | `fr` |

6. **Save** : Render redéploie tout seul. Le canal WhatsApp apparaît à
   l'inscription, et le code part par WhatsApp.

⚠️ Le jeton temporaire expire au bout de 24 h. Pour durer, il faut créer un
**jeton permanent** (Paramètres de l'entreprise → Utilisateurs système) et
vérifier un vrai numéro d'entreprise.

---

## Chemin 2 — SMS par Twilio

Marche partout, y compris chez qui n'a pas WhatsApp. Compte d'essai offert
(environ 15 $ de crédit), puis quelques centimes par SMS vers l'Algérie.

1. Créer un compte sur **twilio.com**, vérifier son propre numéro.
2. Sur la console, relever **Account SID** et **Auth Token**.
3. Acheter un numéro capable d'envoyer des SMS, ou demander l'approbation d'un
   **Sender ID** alphanumérique (« JIRAN »). C'est ce numéro, ou ce nom, qui
   devient `TWILIO_FROM`.
4. Dans **Render → Environment** :

   | Clé | Valeur |
   | --- | --- |
   | `SMS_PROVIDER` | `twilio` |
   | `TWILIO_ACCOUNT_SID` | l'Account SID |
   | `TWILIO_AUTH_TOKEN` | l'Auth Token |
   | `TWILIO_FROM` | le numéro ou le Sender ID |

5. **Save**. Le SMS part réellement.

> Avec un compte d'essai Twilio, seuls les numéros vérifiés sur la console
> reçoivent les messages. Pour ouvrir à tous les voisins, il faut créditer le
> compte.

---

## Chemin 3 — un agrégateur algérien

Les opérateurs locaux passent par des agrégateurs qui exposent une simple
adresse HTTP. Le serveur sait déjà s'y brancher :

| Clé | Valeur |
| --- | --- |
| `SMS_PROVIDER` | `http` |
| `SMS_HTTP_URL` | l'adresse fournie par l'agrégateur |
| `SMS_HTTP_API_KEY` | la clé fournie |
| `SMS_SENDER_ID` | le nom d'expéditeur approuvé |

C'est le chemin le moins cher au volume, mais il demande un contrat et
l'approbation du nom d'expéditeur — comptez quelques jours.

---

## Vérifier que c'est bien branché

Ouvrir `https://<votre-lien>.onrender.com/health` :

- `"devCodeExposed": false` → le code ne s'affiche plus à l'écran ;
- `"verificationDecorative": false` → la vérification est réelle ;
- `channels` indique le fournisseur effectivement branché.

Tant que `verificationDecorative` vaut `true`, le numéro n'est pas vraiment
vérifié : c'est utile pour essayer entre voisins, mais ça ne doit pas durer.
