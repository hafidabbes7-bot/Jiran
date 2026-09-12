/**
 * Durée de vie d'une publication, selon l'intérêt qu'elle a suscité.
 *
 * L'hébergement gratuit offre peu d'espace, et une publication de quartier ne
 * sert plus à grand-chose passé quelques semaines : « chien perdu », « perceuse
 * à prêter », « coupure d'eau demain ». Plutôt que d'effacer tout le monde à la
 * même date, on garde plus longtemps ce que le quartier a lu et commenté.
 *
 * Une interaction = un « j'aime » ou une réponse. Le décompte part de la date
 * de publication, jamais de la dernière interaction : sinon une publication
 * animée ne s'effacerait jamais, et la place ne serait jamais rendue.
 */
export interface Palier {
  /** Nombre minimal d'interactions pour entrer dans ce palier. */
  interactionsMin: number;
  /** Jours de conservation à partir de la publication. */
  jours: number;
}

export const PALIERS: readonly Palier[] = [
  { interactionsMin: 20, jours: 45 },
  { interactionsMin: 5, jours: 30 },
  { interactionsMin: 1, jours: 20 },
  { interactionsMin: 0, jours: 10 },
];

/** Jours de conservation pour un nombre d'interactions donné. */
export function joursDeConservation(interactions: number): number {
  for (const palier of PALIERS) {
    if (interactions >= palier.interactionsMin) return palier.jours;
  }
  // Inatteignable : le dernier palier part de zéro. Le repli reste le plus
  // prudent — garder plutôt qu'effacer.
  return PALIERS[PALIERS.length - 1]!.jours;
}

/** Vrai si une publication a dépassé sa durée de vie à la date donnée. */
export function expirée(créée: Date, interactions: number, maintenant: Date): boolean {
  const limite = new Date(créée.getTime());
  limite.setUTCDate(limite.getUTCDate() + joursDeConservation(interactions));
  return maintenant.getTime() >= limite.getTime();
}
