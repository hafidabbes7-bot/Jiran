import type { ModerationState, Report } from '../types';

/** Nombre de voisins distincts qui déclenchent un masquage (§3). */
export const REPORTS_PER_CYCLE = 3;

/** Durée du masquage temporaire, en jours (§3). */
export const HIDE_DURATION_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

interface CycleScan {
  cycles: number;
  lastCycleAt?: string;
  /** Signalants distincts déjà comptés dans le cycle en cours. */
  pending: Set<string>;
}

/** Rejoue les signalements d'une publication, cycle par cycle. */
function scanCycles(postId: string, reports: Report[]): CycleScan {
  const ordered = reports
    .filter((r) => r.postId === postId)
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  let cycles = 0;
  let lastCycleAt: string | undefined;
  let pending = new Set<string>();

  for (const report of ordered) {
    // Un même voisin ne peut pas faire avancer un cycle à lui seul.
    if (pending.has(report.reporterId)) continue;
    pending.add(report.reporterId);

    if (pending.size >= REPORTS_PER_CYCLE) {
      cycles += 1;
      lastCycleAt = report.createdAt;
      pending = new Set();
    }
  }

  return { cycles, lastCycleAt, pending };
}

/**
 * Recalcule l'état de modération d'une publication à partir de ses
 * signalements.
 *
 * Règle du cahier des charges : 3 signalements de voisins **différents**
 * masquent le contenu pendant 3 jours ; si un nouveau cycle de 3 signalements
 * distincts arrive, le blocage devient définitif.
 *
 * Le calcul est volontairement dérivé des signalements bruts plutôt que
 * stocké : le même journal rejoué donne toujours le même verdict, et la file
 * d'attente des modérateurs humains (§7.4) travaille sur ces mêmes
 * signalements.
 */
export function computeModerationState(postId: string, reports: Report[]): ModerationState {
  const { cycles, lastCycleAt } = scanCycles(postId, reports);

  if (cycles === 0) {
    return { postId, cycles: 0, permanent: false };
  }

  // Récidive : un second cycle de 3 signalements distincts rend le blocage
  // définitif.
  if (cycles >= 2) {
    return { postId, cycles, permanent: true };
  }

  const hiddenUntil = new Date(new Date(lastCycleAt!).getTime() + HIDE_DURATION_DAYS * DAY_MS);
  return { postId, cycles, permanent: false, hiddenUntil: hiddenUntil.toISOString() };
}

/** `true` si la publication doit être masquée dans le fil à cet instant. */
export function isHidden(state: ModerationState, now: Date = new Date()): boolean {
  if (state.permanent) return true;
  if (!state.hiddenUntil) return false;
  return now.getTime() < new Date(state.hiddenUntil).getTime();
}

/** Nombre de signalements distincts encore nécessaires pour le prochain cycle. */
export function reportsUntilNextCycle(postId: string, reports: Report[]): number {
  return REPORTS_PER_CYCLE - scanCycles(postId, reports).pending.size;
}
