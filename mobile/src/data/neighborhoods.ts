import type { Neighborhood } from '../domain/types';

/**
 * Seuil de voisins vérifiés en dessous duquel un quartier reste jumelé avec un
 * quartier voisin, le temps d'avoir un fil vivant (§2 du cahier des charges).
 */
export const TWINNING_THRESHOLD = 50;

/**
 * Extrait du découpage administratif algérien réel (communes et wilayas), à
 * remplacer par le jeu de données complet partagé avec As3ar (§7.2) — d'où le
 * code de wilaya officiel porté par chaque entrée, qui sert de clé commune
 * entre les deux applications.
 *
 * Le regroupement se fait par quartier nommé, jamais par découpage géométrique
 * abstrait (§2) : les coordonnées ne servent qu'à vérifier qu'un nouveau voisin
 * habite bien là où il le déclare.
 */
export const NEIGHBORHOODS: Neighborhood[] = [
  {
    id: 'bab-ezzouar',
    name: 'Bab Ezzouar',
    nameAr: 'باب الزوار',
    wilaya: 'Alger',
    wilayaAr: 'الجزائر',
    wilayaCode: '16',
    latitude: 36.7213,
    longitude: 3.1836,
    radiusMeters: 2500,
    verifiedNeighbors: 214,
  },
  {
    id: 'dar-el-beida',
    name: 'Dar El Beïda',
    nameAr: 'الدار البيضاء',
    wilaya: 'Alger',
    wilayaAr: 'الجزائر',
    wilayaCode: '16',
    latitude: 36.7133,
    longitude: 3.2122,
    radiusMeters: 2500,
    verifiedNeighbors: 96,
  },
  {
    id: 'bordj-el-kiffan',
    name: 'Bordj El Kiffan',
    nameAr: 'برج الكيفان',
    wilaya: 'Alger',
    wilayaAr: 'الجزائر',
    wilayaCode: '16',
    latitude: 36.7503,
    longitude: 3.1931,
    radiusMeters: 3000,
    verifiedNeighbors: 128,
  },
  {
    id: 'el-harrach',
    name: 'El Harrach',
    nameAr: 'الحراش',
    wilaya: 'Alger',
    wilayaAr: 'الجزائر',
    wilayaCode: '16',
    latitude: 36.7167,
    longitude: 3.1333,
    radiusMeters: 2500,
    verifiedNeighbors: 74,
  },
  {
    id: 'rouiba',
    name: 'Rouiba',
    nameAr: 'الرويبة',
    wilaya: 'Alger',
    wilayaAr: 'الجزائر',
    wilayaCode: '16',
    latitude: 36.7386,
    longitude: 3.2836,
    radiusMeters: 3000,
    verifiedNeighbors: 38,
    twinnedWith: 'dar-el-beida',
  },
  {
    id: 'reghaia',
    name: 'Reghaïa',
    nameAr: 'رغاية',
    wilaya: 'Alger',
    wilayaAr: 'الجزائر',
    wilayaCode: '16',
    latitude: 36.7353,
    longitude: 3.3403,
    radiusMeters: 3000,
    verifiedNeighbors: 22,
    twinnedWith: 'dar-el-beida',
  },
  {
    id: 'alger-centre',
    name: 'Alger-Centre',
    nameAr: 'الجزائر الوسطى',
    wilaya: 'Alger',
    wilayaAr: 'الجزائر',
    wilayaCode: '16',
    latitude: 36.7538,
    longitude: 3.0588,
    radiusMeters: 2000,
    verifiedNeighbors: 302,
  },
  {
    id: 'kouba',
    name: 'Kouba',
    nameAr: 'القبة',
    wilaya: 'Alger',
    wilayaAr: 'الجزائر',
    wilayaCode: '16',
    latitude: 36.7264,
    longitude: 3.0894,
    radiusMeters: 2500,
    verifiedNeighbors: 143,
  },
  {
    id: 'boumerdes-centre',
    name: 'Boumerdès Centre',
    nameAr: 'بومرداس الوسط',
    wilaya: 'Boumerdès',
    wilayaAr: 'بومرداس',
    wilayaCode: '35',
    latitude: 36.7594,
    longitude: 3.4722,
    radiusMeters: 3000,
    verifiedNeighbors: 61,
  },
  {
    id: 'blida-centre',
    name: 'Blida Centre',
    nameAr: 'البليدة الوسط',
    wilaya: 'Blida',
    wilayaAr: 'البليدة',
    wilayaCode: '09',
    latitude: 36.4703,
    longitude: 2.8277,
    radiusMeters: 3000,
    verifiedNeighbors: 88,
  },
];

export function findNeighborhood(id: string): Neighborhood | undefined {
  return NEIGHBORHOODS.find((n) => n.id === id);
}

/**
 * Quartiers dont le fil est partagé avec celui-ci : le quartier lui-même, son
 * quartier de rattachement s'il est jumelé, et les quartiers rattachés à lui.
 * L'origine exacte reste affichée sur chaque publication (§2).
 */
export function sharedFeedNeighborhoodIds(id: string): string[] {
  const neighborhood = findNeighborhood(id);
  if (!neighborhood) return [id];

  const root = neighborhood.twinnedWith ?? neighborhood.id;
  const ids = new Set<string>([neighborhood.id, root]);
  for (const other of NEIGHBORHOODS) {
    if (other.twinnedWith === root) ids.add(other.id);
  }
  return [...ids];
}
