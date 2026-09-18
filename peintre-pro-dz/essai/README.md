# Version d'essai — PEINTRE PRO DZ

`peintre-pro-dz-essai.html` est une **page unique** qui rejoue le cœur de
PEINTRE PRO DZ dans un navigateur : clients, devis, pièces avec calcul
automatique des surfaces, travaux depuis les tarifs, totaux (remise, TVA,
acompte, reste), calcul rapide de peinture, aperçu imprimable du devis, et
bascule français / arabe avec passage en lecture de droite à gauche.

Rien à installer : on ouvre le fichier, ou le lien publié, et ça marche —
y compris sans connexion une fois la page chargée.

## Ce qui est identique à l'application

Les formules sont les mêmes que dans le code Kotlin, à la décimale près :

| Calcul | Source Android | Vérifié ici |
|---|---|---|
| Surfaces | `SurfaceCalculator.kt` | 5 × 4 × 2,80 avec 1 porte et 2 fenêtres → murs 50,4 m², ouvertures 4,56 m², **net 45,84 m²**, plafond 20 m² |
| Peinture | `PaintCalculator.kt` | 45 m² × 2 couches ÷ 10 m²/L → **9 L**, soit 5 + 2,5 + 1 + 1 L |
| Totaux | `TotalsCalculator.kt` | 210 000 − 10 000 = 200 000, TVA 19 % = 38 000, **total 238 000**, reste 88 000 |
| Numérotation | `QuoteNumbering.kt` | `DEV-2026-0001`, séquence annuelle |

Les tarifs d'exemple sont ceux de `DefaultData.kt`, avec les mêmes
coefficients par niveau (économique 0,8 · standard 1 · premium 1,3).

## Ce que la page ne fait pas, et que l'application fait

- **Ce n'est pas l'application.** Elle sert à faire toucher le devis à des
  artisans et à recueillir leurs réactions avant de figer les écrans.
- **Les données ne sortent pas de ce navigateur** : elles vivent dans son
  `localStorage`, pas dans une base SQLite. Vider les données du site, changer
  de téléphone ou passer en navigation privée les fait disparaître. Sur
  Android, c'est Room/SQLite qui tient ce rôle, avec sauvegarde système.
- **Pas de vrai PDF** : l'aperçu passe par l'impression du navigateur. Le PDF
  généré par l'application arrive en phase 2.
- **Pas de téléchargement** : dans la page publiée, l'export de sauvegarde
  s'affiche en texte à copier plutôt qu'en fichier — le lecteur d'artefacts
  bloque les téléchargements lancés par une page.
- **Pas de chantiers ni de paiements** : ces écrans annoncent la phase 2,
  comme dans l'application.

## Utiliser la page

- **Localement** : ouvrir `peintre-pro-dz-essai.html` dans Chrome ou Firefox,
  ou l'envoyer sur un téléphone et l'ouvrir depuis le gestionnaire de fichiers.
- **En ligne** : la page est publiée comme artefact sur claude.ai. Le lien est
  privé tant qu'il n'est pas partagé depuis le menu « Partager » de la page.

Le code de l'application reste dans `peintre-pro-dz/app/` ; cette page est
volontairement indépendante pour ne pas alourdir le vrai projet.
