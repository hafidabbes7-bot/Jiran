# Jiran (جيران)

Réseau social de quartier pour l'Algérie — inspiré du modèle Nextdoor, absent du
marché algérien et arabe. Objectif : formaliser l'entraide de voisinage dans un
espace dédié, vérifié et organisé par quartier.

## État du dépôt

| Chemin | Contenu |
| --- | --- |
| `mobile/` | Application Expo / React Native — socle V1 en cours de développement ([README](mobile/README.md)) |
| `server/` | Serveur : vérification du numéro et fil de quartier partagé ([README](server/README.md)) |
| `docs/cahier-des-charges.md` | Toutes les décisions de conception validées (concept, regroupement par quartier, modération, 24 écrans, périmètre V1) |
| `prototype/jiran-accueil.html` | Prototype visuel HTML autonome — 24 écrans navigables, bilingue FR/AR avec bascule RTL |
| `essai/jiran-essai.html` | Version d'essai en une page, publiée sur claude.ai : le socle fonctionne à plusieurs, sans rien installer ([README](essai/README.md)) |

## Essayer tout de suite

```bash
npm run install:all   # la première fois
npm run essai
```

Construit l'application, crée les secrets, démarre le serveur qui sert à la
fois l'API et l'application web : il n'y a plus qu'une adresse à ouvrir. Pour
la partager à des voisins, ajoutez un tunnel (`npx localtunnel --port 4000`) —
voir [`docs/lancer-sur-telephone.md`](docs/lancer-sur-telephone.md).

## Développer

```bash
# terminal 1 — serveur
cd server && npm install && cp .env.example .env && npm run dev

# terminal 2 — application
cd mobile && npm install && npm start
```

Le périmètre retenu pour la V1 est le **socle restreint** décrit au §5 du cahier
des charges : fil de quartier, alertes, entraide, SOS et modération. Les
fonctionnalités secondaires du prototype (jeux, stories, groupes d'intérêt,
objets à emprunter, services recommandés, carte, mode vacances, collecte des
déchets, messagerie privée) viendront ensuite, pour ne pas retarder le lancement
ni diluer le positionnement sécurité / entraide.

L'inscription suit le parcours habituel : le voisin tape son numéro, reçoit un
code à 6 chiffres, le saisit, et l'application s'ouvre.

Le canal retenu pour le lancement est **WhatsApp gratuit** : au lieu de lui
envoyer un code, c'est le voisin qui nous envoie un message, et WhatsApp
confirme son numéro. Rien n'est facturé, et le numéro reste prouvé. Activation
pas à pas : [`docs/verification-whatsapp.md`](docs/verification-whatsapp.md).
Le SMS reste disponible pour qui n'a pas WhatsApp, le jour où un contrat
d'agrégateur sera signé. Le choix du canal d'envoi et ce qu'il faut obtenir
auprès des opérateurs sont expliqués dans [`server/README.md`](server/README.md).

Ce qui reste à brancher côté services externes (modération d'image,
notifications push, backend pour le contenu) est listé dans
[`mobile/README.md`](mobile/README.md).

## Le prototype

Ouvrir `prototype/jiran-accueil.html` directement dans un navigateur (aucune
dépendance, aucun serveur).

C'est une **maquette de design**, pas une application : les données sont codées
en dur en JavaScript, rien ne persiste, l'authentification par SMS et les jeux
n'ont pas de logique réelle, la modération d'image est simulée. Voir §6 du
cahier des charges pour la liste exacte de ce qui est factice.

Il sert de référence visuelle et fonctionnelle pour le développement réel — il
n'est **pas destiné à être réutilisé tel quel** comme base de code.

## Mettre en ligne, sans ordinateur

L'application complète peut être déployée depuis un navigateur de téléphone :
elle tourne alors à une adresse `https://` publique, que vos voisins ouvrent
sans rien installer. Dix minutes, pas à pas :
[`docs/mettre-en-ligne.md`](docs/mettre-en-ligne.md).

## Obtenir le fichier d'installation

Onglet **Actions** du dépôt → **Fabriquer l'APK** → *Run workflow*, en donnant
l'adresse du serveur. GitHub compile et dépose le fichier dans les
« Releases », d'où il s'installe directement depuis un téléphone. Rien à
installer, aucun compte supplémentaire.

## Essayer sur un vrai téléphone

Tout a été vérifié depuis un navigateur ; la géolocalisation réelle, le rendu
arabe et les notifications demandent un appareil. La marche à suivre, pas à pas :
[`docs/lancer-sur-telephone.md`](docs/lancer-sur-telephone.md).

## Tests

Les deux paquets se vérifient séparément, et l'intégration continue
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) les rejoue à chaque
poussée : types, tests, et construction réelle du paquet mobile.

```bash
cd server && npm test        # vérification, fil, modération, alertes
cd mobile && npm test        # filtre de texte, géolocalisation, téléphone
```

## Ce qui est construit, et ce qui ne l'est pas

Au-delà du socle V1 (fil, alertes, entraide, SOS, modération) : l'onglet
**Profil** (§4.7) et les **jeux entre voisins** (§4.8), avec un morpion
réellement jouable à deux — le plateau, le tour et le verdict vivent sur le
serveur, pas sur le téléphone (§7.6).

Puis toute la vie de quartier, accessible depuis le profil : messagerie privée
(§4.6), services recommandés (§4.9), objets à emprunter (§4.10), groupes
d'intérêt (§4.11), carte du quartier (§4.12), mode vacances (§4.13), collecte
des déchets (§4.14) et actions solidaires (§4.15).

Déménagement et voyage, deux cas qu'on confond souvent :

Un voyage ne change rien. La position n'est vérifiée qu'à l'inscription et au
déménagement ; le quartier est attaché au compte, pas à l'endroit où le
téléphone se trouve. On suit donc sa rue depuis l'étranger — et le mode vacances
sert à prévenir les voisins choisis.

Un déménagement se déclare : « J'ai déménagé » dans le profil, avec la même
confirmation par géolocalisation qu'à l'inscription, mais sans SMS ni
réinscription — le serveur reconnaît le voisin à son numéro et met son profil à
jour au lieu d'en créer un second. Les publications ne suivent pas leur auteur :
elles appartiennent au fil où elles ont été écrites. Les conversations privées
déjà entamées, elles, restent ouvertes des deux côtés — ce qui a été échangé
appartient aux deux personnes, pas au quartier. Une conversation *nouvelle*
exige toujours d'être voisins.

Trois choix assumés dans ce lot :
 — la carte est une liste triée par distance qui ouvre l'itinéraire dans
   l'application de cartes du téléphone, plutôt qu'une carte dessinée qui
   imposerait une clé d'API et une dépendance native ;
 — le calendrier des déchets est rempli par les voisins, faute de source
   publique exploitable, et le rappel de la veille reste sur le téléphone ;
 — une absence n'est visible que des voisins nommément désignés : l'annoncer au
   quartier reviendrait à donner l'adresse d'un logement vide.

## Ce qui reste comme limite de l'hébergement gratuit

**Les données ne disparaissent plus.** Elles vivaient dans un fichier posé à
côté du serveur, et ce fichier repartait vide à chaque redéploiement et à
chaque réveil du service endormi. Elles sont maintenant dans une base
**PostgreSQL** qui n'appartient plus au serveur, donc elles survivent à son
redémarrage. `render.yaml` la fait créer par Render sans rien à configurer —
avec une réserve : une base gratuite Render est supprimée au bout de 30 jours.
Pour garder les données au-delà, Supabase est gratuit et sans date de fin.
Les deux chemins sont dans [docs/base-de-donnees.md](docs/base-de-donnees.md).

En échange, les 500 Mo gratuits imposent une règle : une publication s'efface
d'elle-même au bout de 10 jours si personne n'a réagi, 20, 30 ou 45 jours selon
l'intérêt qu'elle a suscité. Les comptes, les conversations et les messages,
eux, ne s'effacent jamais tout seuls.

**La vérification est décorative tant qu'aucun canal n'envoie vraiment.** `TRIAL_MODE=true` affiche le code
à l'écran : n'importe qui peut s'inscrire avec n'importe quel numéro ou
adresse. Tout le reste du mécanisme existe et fonctionne — il ne manque qu'un
compte chez un expéditeur, et **l'e-mail est gratuit** : une boîte Gmail avec un
mot de passe d'application, ou l'offre gratuite de Resend, suffisent. Voir [docs/verification-reelle.md](docs/verification-reelle.md) : le
serveur referme cette porte tout seul dès que des identifiants réels sont posés,
même si `TRIAL_MODE` reste à `true`, et `/health` dit lequel des deux états est
en cours (`verificationDecorative`).

## Idées gardées de côté

Rien de ce qui suit n'est oublié : c'est mis de côté, volontairement, pour ne
pas retarder les premiers essais entre vrais voisins.

Dans l'application, à construire quand le quartier le demandera :
 — les autres jeux (échecs, dames, belote, dominos, Scrabble) et les quiz à
   thème, puis le classement mensuel du quartier (§4.8) ;
 — les petits boulots entre voisins — babysitting, cours, travaux (§5) ;
 — les annonces de vie du quartier : naissances, mariages, condoléances (§5) ;
 — les alertes météo locales automatiques (§5).

Hors de l'application, chacune demandant un compte, un contrat ou une facture —
donc une décision de Hafid, pas une ligne de code :
 — les vraies notifications push, application fermée : compte Firebase pour
   Android, compte développeur Apple pour iOS (§7.7) ;
 — les vrais SMS de vérification : contrat avec un agrégateur algérien et
   approbation du nom d'expéditeur ;
 — le canal WhatsApp gratuit : compte WhatsApp Business ;
 — la modération automatique des images : Google Vision, AWS Rekognition ou
   équivalent (§7.3) ;
 — la messagerie en temps réel par WebSocket, là où l'application redemande
   aujourd'hui toutes les 4 secondes (§7.5) ;
 — un hébergement payant, pour que les données survivent à un redémarrage.

Et une décision qui n'attend que vous : le nom. « Jiran » est un nom de travail
(§1), à valider avant toute publication sur un magasin d'applications.

## Un compte appartient à un identifiant vérifié

Numéro de téléphone **ou** adresse e-mail : c'est cet identifiant qui possède
l'historique — publications, messages, parties — pas l'appareil. Se reconnecter
avec le même identifiant retrouve tout ; l'application, elle, ne fait que garder
la session pour ne pas redemander le code à chaque ouverture.

L'e-mail existe parce qu'il est le seul canal gratuit à l'envoi : un quartier
peut donc vérifier vraiment ses comptes sans attendre un contrat d'agrégateur
SMS. Les quatre canaux — SMS, e-mail, WhatsApp par modèle, WhatsApp entrant —
partagent le même mécanisme : code à six chiffres haché, expiration, quotas par
identifiant, jeton de session signé.

## Photos et stories

Une publication peut porter une photo, et une story — une photo, un mot, ou les
deux — vit 24 heures avant de disparaître. Trois choix à connaître :

 — la photo est réduite à 1280 px et ré-encodée **sur le téléphone** avant
   l'envoi : faire monter plusieurs méga-octets sur un réseau algérien pour les
   jeter ensuite, ce serait payer deux fois ;
 — les octets sont stockés dans la base, comme le reste. Un disque local ne
   survivrait pas au redémarrage de l'hébergement, et un stockage externe
   demanderait un compte et une facture avant le premier essai ;
 — les images ne sont pas relues automatiquement (§7.3). Elles ne sortent pas du
   quartier, se signalent comme une publication, et la règle des trois
   signalements les masque de la même façon. L'écran le dit.

## Notifications

Le profil ouvre la liste de ce qui est arrivé — alerte du quartier, réponse à
une publication, message privé, SOS — avec le nombre de non-lus, et les
réglages par catégorie (§4.17).

Deux choses valent d'être dites. La liste est tenue par le **serveur** : elle
reste juste même quand aucune notification n'arrive sur le téléphone, ce qui est
le cas tant qu'aucun service de remise n'est branché. Et la notification qui
fait sonner l'appareil est **locale** : l'application, qui se rafraîchit toutes
les 12 secondes, la déclenche elle-même dès qu'elle voit du nouveau. Ce n'est
pas un remplacement des notifications distantes — application fermée, rien ne
sonne — mais c'est ce qui marche aujourd'hui, sans compte Firebase ni Apple.

Le SOS d'un voisin qui vous a choisi n'est pas réglable : une demande d'aide
n'est pas une préférence d'affichage.

## Ce qui arrive sans qu'on touche à l'écran

Le fil, les alertes et les SOS se rafraîchissent toutes les 12 secondes tant que
l'application est à l'écran, et tout de suite au retour au premier plan. Les
notifications ne suffisent pas : tant qu'aucun service de remise n'est branché —
et même après, pour qui les a coupées — l'application est la seule à pouvoir
prévenir. Un SOS s'affiche donc en bandeau rouge en tête du fil et des alertes,
chez les voisins choisis comme chez son auteur, qui peut l'annuler de là.

## Couverture du territoire

Jiran couvre deux pays. `mobile/src/data/neighborhoods.ts` contient **les 1541
communes d'Algérie** et **les 13 provinces et territoires du Canada**, où vivent
des proches des premiers voisins. Le choix du lieu se fait par paliers : wilaya →
daïra → commune en Algérie, province au Canada — le découpage canadien n'a pas
d'équivalent utile de la commune, et la position n'y confirme donc que la
province, ce que l'écran dit franchement. Une recherche libre court-circuite les
paliers.

Côté algérien, cette liste contient donc, avec
leur daïra et leur wilaya, les 69 wilayas du découpage de 2026 (loi n° 26-06),
dont les 11 dernières, codes 59 à 69. Les noms bilingues, les daïras et les
coordonnées viennent du jeu de données public `geoalgeria`. La recherche de
l'inscription porte sur les trois : commune, daïra, wilaya, en français comme en
arabe.

Le rayon accepté pour la vérification n'est pas fixe : c'est la moitié de la
distance à la commune la plus proche, borné entre 2,5 et 20 km. Une commune
serrée entre deux autres garde un rayon serré ; une commune du Sahara, seule à
cent kilomètres à la ronde, en obtient un large — sans quoi ses habitants ne
pourraient jamais confirmer leur position. C'est volontairement grossier hors de ces deux wilayas — un chef-lieu
se découpera en quartiers quand il y aura assez de voisins pour que ça ait un
sens. Personne ne doit rester sans entrée : un voisin absent de la liste ne peut
pas s'inscrire. Quand sa commune manque quand même, l'inscription reste possible
sans vérification de position, et le compte est alors marqué « non vérifié ».

Ajouter une commune, c'est ajouter la même entrée dans les deux copies —
`mobile/src/data/neighborhoods.ts` et `server/src/content/neighborhoods.ts` — et
dans la page d'essai `essai/jiran-essai.html`.

Trois fichiers existent en double entre les deux paquets — le découpage des
quartiers, la liste de mots interdits et le filtre de texte. L'application en a
besoin hors ligne, le serveur en a besoin comme autorité. Un test du serveur
compare les deux copies et échoue à la première divergence.

## Décision encore ouverte

Les exigences techniques pour la vraie application (géolocalisation, données
administratives algériennes, modération IA, messagerie temps réel, notifications
push) sont détaillées en §7 du cahier des charges.
