import type { Language } from './types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Horodatage relatif court, façon fil de discussion (« il y a 40 min »).
 * Fait à la main plutôt qu'avec `Intl.RelativeTimeFormat` : la forme arabe
 * attendue ici est celle du prototype (« قبل 40 د »), plus compacte que ce que
 * produit l'API standard.
 */
export function formatRelative(iso: string, language: Language, now: Date = new Date()): string {
  const elapsed = Math.max(0, now.getTime() - new Date(iso).getTime());

  if (elapsed < MINUTE) {
    return language === 'ar' ? 'الآن' : "à l'instant";
  }
  if (elapsed < HOUR) {
    const minutes = Math.floor(elapsed / MINUTE);
    return language === 'ar' ? `قبل ${minutes} د` : `il y a ${minutes} min`;
  }
  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR);
    return language === 'ar' ? `قبل ${hours} سا` : `il y a ${hours} h`;
  }

  const days = Math.floor(elapsed / DAY);
  if (days === 1) return language === 'ar' ? 'البارح' : 'hier';
  return language === 'ar' ? `قبل ${days} أيام` : `il y a ${days} jours`;
}

/** Distance lisible : « 320 m », « 4,2 km ». */
export function formatDistance(meters: number, language: Language): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  const value = km.toFixed(1);
  return language === 'ar' ? `${value} كم` : `${value.replace('.', ',')} km`;
}
