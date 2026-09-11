/** Nombre de voisins distincts qui déclenchent un masquage (§3). */
export const REPORTS_PER_CYCLE = 3;

/** Durée du masquage temporaire, en jours (§3). */
export const HIDE_DURATION_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ModerationState {
  /** Cycles de 3 signalements distincts déjà atteints. */
  cycles: number;
  /** Fin du masquage temporaire (ISO), absent si permanent ou si rien. */
  hiddenUntil?: string;
  permanent: boolean;
  hidden: boolean;
  /** Renseigné quand un modérateur a tranché lui-même. */
  decidedByModerator?: 'block' | 'restore';
}

/** Décision prise à la main par un modérateur (§7.4). */
export interface ModeratorDecision {
  decision: 'block' | 'restore';
  decidedAt: string;
}

/**
 * Verdict de modération d'une publication, à partir de ses signalements.
 *
 * 3 signalements de voisins **différents** masquent le contenu 3 jours ; un
 * second cycle de 3 le bloque définitivement (§3 du cahier des charges).
 *
 * C'est ici que la règle devient réelle : tant que les signalements vivaient
 * sur chaque téléphone, un voisin ne pouvait compter que pour lui-même et le
 * seuil de trois n'était jamais atteignable.
 *
 * @param reportedAt horodatages des signalements, du plus ancien au plus récent,
 *                   un par voisin (la clé primaire de `reports` s'en assure).
 */
export function moderationState(
  reportedAt: string[],
  now: Date = new Date(),
  decision?: ModeratorDecision
): ModerationState {
  // Une décision humaine prime sur le compteur : c'est tout l'objet d'avoir
  // des modérateurs (§7.4).
  if (decision?.decision === 'block') {
    return {
      cycles: Math.floor(reportedAt.length / REPORTS_PER_CYCLE),
      permanent: true,
      hidden: true,
      decidedByModerator: 'block',
    };
  }

  // Après un rétablissement, seuls les signalements postérieurs comptent :
  // sinon les anciens masqueraient aussitôt le contenu que le modérateur
  // vient de juger acceptable.
  const counted =
    decision?.decision === 'restore'
      ? reportedAt.filter((at) => at > decision.decidedAt)
      : reportedAt;

  const cycles = Math.floor(counted.length / REPORTS_PER_CYCLE);

  const restored = decision?.decision === 'restore' ? { decidedByModerator: 'restore' as const } : {};

  if (cycles === 0) {
    return { cycles: 0, permanent: false, hidden: false, ...restored };
  }

  if (cycles >= 2) {
    return { cycles, permanent: true, hidden: true, ...restored };
  }

  // Le masquage court à partir du signalement qui a bouclé le cycle.
  const trigger = counted[REPORTS_PER_CYCLE - 1]!;
  const hiddenUntil = new Date(new Date(trigger).getTime() + HIDE_DURATION_DAYS * DAY_MS);

  return {
    cycles,
    permanent: false,
    hiddenUntil: hiddenUntil.toISOString(),
    hidden: now.getTime() < hiddenUntil.getTime(),
    ...restored,
  };
}
