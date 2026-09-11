# Version d'essai

`jiran-essai.html` est une **page unique** qui rejoue le socle de Jiran —
inscription, fil de quartier partagé, catégories, réponses, signalements avec
blocage automatique, SOS, bascule français / arabe — sans serveur à installer et
sans rien à poser sur les téléphones.

Elle est publiée comme artefact sur claude.ai, où elle utilise le magasin
partagé de la plateforme : plusieurs personnes qui ouvrent le même lien voient
le même fil, en direct.

**Ce n'est pas l'application.** Elle sert à faire toucher le principe à des
voisins et à recueillir leurs réactions, pas à être publiée. Ce qu'elle ne fait
pas, et que l'application fait :

- **aucune vérification du numéro** — le prénom est simplement déclaré ;
- **aucune notification** — un SOS n'apparaît que chez un voisin qui a la page
  ouverte ou qui la rouvre ;
- **aucune file de modération humaine** — seul le blocage automatique s'applique ;
- **pas de jumelage des cités**, et la position n'est pas vérifiée à
  l'inscription.

La règle des trois signalements y est en revanche réelle : il faut bien trois
personnes différentes pour masquer une publication.

Le code applicatif reste `mobile/` et `server/` ; cette page est volontairement
indépendante, pour qu'elle ne complique pas le vrai projet.
