# PEINTRE PRO DZ — Phase 1

Application Android (Kotlin + Jetpack Compose + Room) pour les peintres et petites
entreprises de peinture en Algérie. **100 % hors connexion, sans compte utilisateur.**

Toutes les données sont enregistrées dans une base SQLite locale (Room) : elles
survivent à la fermeture de l'application et au redémarrage du téléphone.

---

## 1. Ce qui fonctionne en phase 1

| Domaine | Détail |
|---|---|
| Accueil | Tableau de bord (nombre de devis, devis acceptés, chantiers en cours, montant à encaisser) + bloc « Ce mois » + gros boutons + ⚡ CALCUL RAPIDE |
| Clients | Ajouter / modifier / supprimer / rechercher, fiche client avec historique des devis, chantiers et reste à encaisser |
| Devis | Numérotation automatique `DEV-2026-0001`, client, type de chantier, adresse, date, notes, niveau (Économique / Standard / Premium), statut (Brouillon → Envoyé → Accepté / Refusé / Annulé) |
| Pièces | Longueur / largeur / hauteur, portes, fenêtres, surfaces calculées automatiquement, correction manuelle possible |
| Travaux | Lignes travaux / matériaux / main-d'œuvre / autres frais, depuis les tarifs ou en saisie libre, quantités pré-remplies (murs nets, plafond, murs + plafond, portes, fenêtres) |
| Tarifs | Catalogue modifiable par niveau, ajout / modification / suppression, remise à zéro |
| Totaux | Sous-totaux, remise, TVA optionnelle et configurable, total, acompte, reste à payer |
| Calcul rapide | Surfaces + quantité de peinture estimée + conditionnements (1 / 2,5 / 5 / 10 / 20 L) + création d'un devis à partir du calcul |
| Paramètres | Entreprise, devise, TVA, validité, rendement et couches par défaut, conditions |
| Persistance | Room / SQLite, schémas exportés dans `app/schemas`, **aucune migration destructive** |

Prévu en phase 2 : PDF, partage, paiements, chantiers.
Prévu en phase 3 : photos, export / import JSON, statistiques, arabe.
Les écrans « Mes chantiers » et « Paiements » existent déjà dans la navigation et
annoncent clairement la phase 2 (les tables `sites`, `payments` et `site_photos`
sont **déjà créées en base**, donc la phase 2 n'imposera aucune migration risquée).

---

## 2. Arborescence

```
peintre-pro-dz/
├── settings.gradle.kts
├── build.gradle.kts
├── gradle.properties
├── gradlew / gradlew.bat
├── gradle/
│   ├── libs.versions.toml            # catalogue de versions
│   └── wrapper/                      # Gradle 8.7
└── app/
    ├── build.gradle.kts
    ├── proguard-rules.pro
    └── src/
        ├── main/
        │   ├── AndroidManifest.xml
        │   ├── res/
        │   │   ├── values/strings.xml       # TOUS les textes (français)
        │   │   ├── values/themes.xml
        │   │   ├── values-ar/strings.xml    # emplacement de la traduction arabe
        │   │   ├── drawable/…               # icône de lancement
        │   │   └── xml/…                    # règles de sauvegarde système
        │   └── java/dz/peintrepro/
        │       ├── PeintreProApp.kt         # Application + conteneur
        │       ├── MainActivity.kt
        │       ├── core/
        │       │   ├── Formats.kt           # nombres, montants, dates
        │       │   └── QuoteNumbering.kt    # DEV-2026-0001
        │       ├── domain/
        │       │   ├── model/Enums.kt       # statuts, niveaux, unités…
        │       │   └── calc/
        │       │       ├── SurfaceCalculator.kt
        │       │       ├── PaintCalculator.kt
        │       │       └── TotalsCalculator.kt
        │       ├── data/
        │       │   ├── local/
        │       │   │   ├── AppDatabase.kt   # base Room + données de départ
        │       │   │   ├── DefaultData.kt   # tarifs d'exemple
        │       │   │   ├── entity/…         # 9 tables
        │       │   │   ├── dao/…            # 9 DAO
        │       │   │   └── relation/QuoteListRow.kt
        │       │   └── repository/…         # 7 repositories
        │       ├── di/
        │       │   ├── AppContainer.kt      # injection manuelle
        │       │   └── QuickCalcHandoff.kt
        │       └── ui/
        │           ├── theme/               # couleurs, typographie, thème M3
        │           ├── components/          # briques communes + dialogues
        │           ├── navigation/          # Routes.kt + AppNavHost.kt
        │           └── screens/
        │               ├── home/ clients/ quotes/ quote/ room/
        │               └── tariffs/ quickcalc/ settings/ common/
        └── test/java/dz/peintrepro/…        # tests des calculs
```

---

## 3. Compiler et tester dans Android Studio

1. Android Studio **Koala (2024.1.1)** ou plus récent, JDK 17.
2. `File > Open…` → choisir le dossier `peintre-pro-dz` (pas le dossier parent).
3. Laisser Gradle se synchroniser (il télécharge Gradle 8.7, AGP 8.5.2, Kotlin 2.0.20,
   Compose BOM 2024.09.02 et Room 2.6.1 — connexion Internet nécessaire **pour la
   compilation uniquement**, l'application, elle, fonctionne hors ligne).
4. `Build > Make Project` (ou `./gradlew assembleDebug`).
5. Brancher un téléphone Android 7.0+ (API 24) ou lancer un émulateur, puis `Run ▶`.
6. Tests des calculs : `./gradlew test`
   (surfaces, quantité de peinture, totaux, numérotation).

### Premier lancement
La base est créée automatiquement avec :
- la ligne de paramètres (devise `DA`, TVA désactivée, rendement 10 m²/L) ;
- un catalogue de tarifs d'exemple pour les trois niveaux.

Ces prix sont **des exemples** : ils se modifient dans `Paramètres > Mes tarifs`.

### Parcours de test conseillé
1. Accueil → `⚡ CALCUL RAPIDE` → 5 × 4 × 2,80, 1 porte, 2 fenêtres, 2 couches
   → surface nette 45,84 m², peinture ≈ 9,17 L.
2. `CRÉER UN DEVIS À PARTIR DE CE CALCUL` → choisir ou créer un client :
   le devis `DEV-…-0001` est créé, avec la pièce et la ligne de peinture.
3. Ajouter une pièce, ajouter des travaux depuis les tarifs, voir le total se mettre à jour.
4. Fermer complètement l'application, la rouvrir : **tout est toujours là**.

---

## 4. Règles de conception à conserver

- **Aucune donnée en mémoire seule** : tout passe par Room. Les ViewModels ne font
  que lire des `Flow` et écrire via les repositories.
- **Jamais de `fallbackToDestructiveMigration()`** : pour changer le schéma,
  incrémenter `AppDatabase.VERSION` et écrire une `Migration` (les schémas JSON sont
  exportés dans `app/schemas` justement pour ça).
- **Le total du devis est recalculé et stocké** (`quotes.totalAmount`) à chaque
  écriture : les listes et le tableau de bord restent instantanés.
- **Tous les textes viennent de `strings.xml`** : la traduction arabe se fait en
  copiant le fichier dans `values-ar/`, sans toucher au code.
- **Validations** : nom de client obligatoire, dimensions strictement positives
  (sauf surface corrigée à la main), quantités et prix jamais négatifs, remise
  plafonnée au sous-total, surface nette jamais négative.
- **Estimation de peinture** : toujours présentée comme une estimation, le rendement
  étant modifiable par l'utilisateur.
