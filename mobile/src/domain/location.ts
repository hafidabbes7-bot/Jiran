import type { Neighborhood } from './types';

const EARTH_RADIUS_M = 6_371_000;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Distance en mètres entre deux points, formule de haversine. */
export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export interface LocationCheck {
  /** Position dans le rayon accepté du quartier déclaré. */
  verified: boolean;
  distanceMeters: number;
  /** Quartier le plus proche de la position, s'il diffère du déclaré. */
  suggestion?: Neighborhood;
}

/**
 * Vérifie qu'une position GPS correspond bien au quartier déclaré (§2 : la
 * vérification se fait par géolocalisation, pas par courrier postal comme
 * Nextdoor, le système d'adresses algérien ne s'y prêtant pas).
 *
 * En cas d'échec, on propose le quartier réellement le plus proche plutôt que
 * de bloquer sèchement : un voisin qui s'est trompé de ligne dans la liste est
 * plus fréquent qu'un fraudeur.
 */
export function checkPosition(
  position: { latitude: number; longitude: number },
  declared: Neighborhood,
  all: Neighborhood[]
): LocationCheck {
  const distance = distanceMeters(position, declared);
  if (distance <= declared.radiusMeters) {
    return { verified: true, distanceMeters: distance };
  }

  const nearest = all.reduce((best, candidate) => {
    return distanceMeters(position, candidate) < distanceMeters(position, best) ? candidate : best;
  }, declared);

  return {
    verified: false,
    distanceMeters: distance,
    suggestion: nearest.id === declared.id ? undefined : nearest,
  };
}

export interface Coverage {
  /** Quartier couvrant réellement la position, s'il y en a un. */
  neighborhood?: Neighborhood;
  /** Quartier le plus proche, couvrant ou non — jamais indéfini si la liste ne l'est pas. */
  nearest?: Neighborhood;
  /** Distance jusqu'au plus proche, en mètres. */
  distanceMeters: number;
}

/**
 * Cherche le quartier où se trouve vraiment une position, sans rien déclarer
 * au préalable : c'est ce qui permet de proposer son quartier à un voisin au
 * lieu de lui faire parcourir la liste.
 *
 * Un quartier « couvre » la position si elle tombe dans son rayon. Aucune
 * couverture ne veut pas dire fraude : la liste des quartiers est encore
 * partielle (§7.2), et un voisin d'une commune absente doit pouvoir le
 * comprendre plutôt que rester bloqué sans explication.
 */
export function findCoverage(
  position: { latitude: number; longitude: number },
  all: Neighborhood[]
): Coverage {
  let nearest: Neighborhood | undefined;
  let nearestDistance = Infinity;
  let covering: Neighborhood | undefined;
  let coveringDistance = Infinity;

  for (const candidate of all) {
    const distance = distanceMeters(position, candidate);
    if (distance < nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
    // Les rayons se chevauchent par endroits : on retient le quartier dont on
    // est le plus proche parmi ceux qui couvrent, pas le premier de la liste.
    if (distance <= candidate.radiusMeters && distance < coveringDistance) {
      covering = candidate;
      coveringDistance = distance;
    }
  }

  return { neighborhood: covering, nearest, distanceMeters: nearestDistance };
}
