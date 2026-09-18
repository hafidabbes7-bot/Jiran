# Se créer un compte sur Jiran

Deux chemins mènent au même endroit : un compte qui vit **sur le serveur**, pas
dans le téléphone. Changer d'appareil, réinstaller l'application, casser son
téléphone — le quartier, les publications et les conversations sont retrouvés.

---

## Les deux chemins

| | Code à usage unique | Adresse + mot de passe |
| --- | --- | --- |
| Ce qu'on donne | un numéro **ou** une adresse | une adresse |
| Ce qu'on reçoit | un code à 6 chiffres | un lien de confirmation |
| Pour revenir | redemander un code | son mot de passe |
| Rien à retenir | ✅ | ❌ |
| Marche sans réseau mobile | ❌ (sauf par e-mail) | ✅ |

Le premier existait déjà. Le second est nouveau, et c'est celui qu'attendent
les gens habitués aux applications ordinaires.

---

## Ce que le serveur garde, et ce qu'il ne garde pas

**Le mot de passe n'est jamais enregistré.** Ce qui est gardé est une empreinte
calculée par **scrypt** — une fonction volontairement lente et gourmande en
mémoire. Un simple SHA-256, même salé, se casse à des milliards d'essais par
seconde sur une carte graphique ; scrypt rend cette attaque sans intérêt.

**Le jeton du lien non plus.** Le lien envoyé dans la boîte contient 32 octets
tirés au hasard ; la base n'en garde que l'empreinte. Une fuite de la base ne
permet donc ni de confirmer un compte, ni d'en changer le mot de passe.

---

## Ce qui protège les comptes

- **Un mot de passe bon sur une adresse non confirmée n'ouvre pas la porte.**
  Sans ça, le lien de confirmation ne servirait à rien.
- **Six essais ratés sur un compte**, puis un quart d'heure de silence. C'est
  ce qui arrête quelqu'un qui cherche un mot de passe.
- **Le serveur ne dit jamais si une adresse a un compte.** Se réinscrire sur
  une adresse existante répond exactement comme une inscription neuve, sans
  rien envoyer ni rien changer. Demander un lien pour une adresse inconnue
  répond « c'est parti » sans que rien parte. Sinon, essayer des adresses
  jusqu'à voir la réponse changer dirait qui habite le quartier.
- **Un lien ne sert qu'une fois**, et il n'y en a qu'un valide à la fois :
  en redemander un invalide le précédent.
- **60 requêtes d'authentification par minute et par adresse IP**
  (`AUTH_RATE_LIMIT_PER_MINUTE`). Ce plafond n'est qu'un garde-fou contre le
  déluge : en Algérie, les opérateurs mobiles partagent une adresse publique
  entre des milliers d'abonnés, donc un plafond serré ne punirait pas un
  attaquant, il fermerait la porte à tout un quartier au même moment.

---

## Pour que les e-mails partent vraiment

Sans fournisseur d'e-mail configuré, **aucun lien ne part** : le compte est
créé, mais personne ne peut le confirmer. L'application le dit clairement à
l'écran au lieu d'afficher « regarde ta boîte » devant une boîte vide, et
`/health` l'annonce :

```json
"emailAccounts": { "enabled": true, "canSendLinks": false }
```

Deux façons gratuites de passer `canSendLinks` à `true`, décrites dans
[`verification-reelle.md`](verification-reelle.md) :

| | À poser dans Render |
| --- | --- |
| Boîte Gmail existante | `EMAIL_PROVIDER=smtp`, `EMAIL_SMTP_HOST=smtp.gmail.com`, `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASS` (un **mot de passe d'application**, pas celui du compte), `EMAIL_FROM` |
| Resend (3 000 messages/mois) | `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM` |

Posez aussi `PUBLIC_URL` (par exemple `https://jiran-essai.onrender.com`) : c'est
l'adresse qui sert à fabriquer les liens. Sans elle, le serveur la déduit de la
requête reçue, ce qui est juste dans presque tous les cas.

---

## Pourquoi pas Firebase ou Supabase Auth

La question s'est posée sérieusement. Trois raisons de ne pas les ajouter :

1. **Ils ne règlent pas le problème de l'envoi.** L'expéditeur intégré de
   Supabase est limité à [2 messages par heure](https://supabase.com/docs/guides/auth/rate-limits)
   et documenté comme non destiné à la production : il faut de toute façon
   brancher Gmail ou Resend — exactement ce que Jiran fait déjà.
2. **Ils ne règlent pas le téléphone non plus.** L'authentification par SMS y
   passe par Twilio, qui est payant. Le parcours WhatsApp gratuit de Jiran —
   c'est le voisin qui envoie le message — n'a pas d'équivalent.
3. **Ils créeraient une deuxième source de vérité sur « qui ».** Le quartier,
   les signalements, les rôles de modérateur et l'historique sont tous
   rattachés à `identifier`. Deux systèmes d'identité à tenir d'accord, c'est
   la porte ouverte aux comptes fantômes.

Ce qu'ils apportent — hachage sérieux, liens de confirmation, blocage après
échecs, non-divulgation des adresses — est ici, écrit, testé et sans
dépendance.

Si le besoin change (connexion par Google, par exemple), Supabase Auth
redeviendra le bon choix : `credentials` est une table à part, précisément pour
pouvoir être remplacée sans toucher au reste.
