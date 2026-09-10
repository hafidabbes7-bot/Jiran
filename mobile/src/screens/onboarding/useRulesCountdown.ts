import { useEffect, useState } from 'react';

/** Durée pendant laquelle le bouton d'acceptation des règles reste verrouillé. */
export const RULES_COUNTDOWN_SECONDS = 3;

/**
 * Compte à rebours de l'écran « Règles du quartier » (§3) : le bouton ne
 * devient actif qu'au bout de {@link RULES_COUNTDOWN_SECONDS} secondes, pour
 * qu'on ne puisse pas passer l'écran sans l'avoir vu.
 */
export function useRulesCountdown(active: boolean): { remaining: number; unlocked: boolean } {
  const [remaining, setRemaining] = useState(RULES_COUNTDOWN_SECONDS);

  useEffect(() => {
    if (!active) {
      setRemaining(RULES_COUNTDOWN_SECONDS);
      return;
    }

    const interval = setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          clearInterval(interval);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [active]);

  return { remaining, unlocked: active && remaining === 0 };
}
