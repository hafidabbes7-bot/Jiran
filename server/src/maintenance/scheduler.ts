import { CleanupService } from './cleanupService.js';

const JOUR_MS = 24 * 60 * 60 * 1000;

/**
 * Lance le ménage une fois par jour, depuis le serveur lui-même.
 *
 * Les tâches planifiées de Render sont payantes ; un minuteur dans le
 * processus est ce qui reste. Il a une faiblesse assumée : sur la formule
 * gratuite, le service s'endort après quinze minutes sans visite, et un
 * minuteur endormi ne se déclenche pas. D'où le rattrapage au réveil — le
 * premier passage a lieu peu après le démarrage, et le retard est rattrapé
 * dès que quelqu'un ouvre l'application.
 *
 * Ce minuteur ne modifie jamais la structure de la base : il ne supprime que
 * des publications arrivées au bout de leur durée de vie.
 */
export function planifierNettoyage(
  service: CleanupService,
  options?: { intervalleMs?: number; délaiInitialMs?: number }
): () => void {
  const intervalle = options?.intervalleMs ?? JOUR_MS;
  // Quelques minutes de battement au démarrage : un redéploiement ne doit pas
  // faire tourner le ménage pendant que le service monte.
  const délai = options?.délaiInitialMs ?? 5 * 60 * 1000;

  let arrêté = false;

  const passe = async () => {
    if (arrêté) return;
    try {
      const rapport = await service.run({ aperçu: false });
      if (rapport.supprimées > 0 || rapport.photosEnÉchec > 0) {
        console.info(
          `[cleanup] ${rapport.supprimées} publication(s) arrivée(s) à terme, ` +
            `${rapport.photosRetirées} photo(s) retirée(s)` +
            (rapport.photosEnÉchec ? `, ${rapport.photosEnÉchec} photo(s) gardée(s)` : '')
        );
      }
    } catch (error) {
      // Un ménage raté ne doit pas emporter le serveur avec lui : les voisins
      // n'ont que faire de l'espace disque, ils veulent lire leur fil.
      console.error('[cleanup] passage échoué', error);
    }
  };

  const premier = setTimeout(() => {
    void passe();
  }, délai);
  const suivants = setInterval(() => {
    void passe();
  }, intervalle);

  // Sans `unref`, ces minuteurs empêcheraient le processus de s'arrêter.
  premier.unref?.();
  suivants.unref?.();

  return () => {
    arrêté = true;
    clearTimeout(premier);
    clearInterval(suivants);
  };
}
