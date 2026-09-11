import { checkPosition, distanceMeters, findCoverage } from '../location';
import { NEIGHBORHOODS, findNeighborhood } from '../../data/neighborhoods';

const babEzzouar = findNeighborhood('bab-ezzouar')!;
const bordjElKiffan = findNeighborhood('bordj-el-kiffan')!;

describe('distanceMeters', () => {
  it('renvoie 0 pour le même point', () => {
    expect(distanceMeters(babEzzouar, babEzzouar)).toBeCloseTo(0, 5);
  });

  it('mesure une distance plausible entre deux communes d’Alger', () => {
    const distance = distanceMeters(babEzzouar, bordjElKiffan);
    expect(distance).toBeGreaterThan(2_000);
    expect(distance).toBeLessThan(6_000);
  });
});

describe('checkPosition', () => {
  it('valide une position dans le quartier déclaré', () => {
    const result = checkPosition(
      { latitude: babEzzouar.latitude + 0.002, longitude: babEzzouar.longitude },
      babEzzouar,
      NEIGHBORHOODS
    );
    expect(result.verified).toBe(true);
  });

  it('refuse une position trop éloignée et propose le bon quartier', () => {
    const result = checkPosition(bordjElKiffan, babEzzouar, NEIGHBORHOODS);
    expect(result.verified).toBe(false);
    expect(result.suggestion?.id).toBe('bordj-el-kiffan');
  });
});

describe('findCoverage', () => {
  it('retrouve le quartier d’une position sans rien déclarer', () => {
    const coverage = findCoverage(
      { latitude: babEzzouar.latitude, longitude: babEzzouar.longitude },
      NEIGHBORHOODS
    );
    expect(coverage.neighborhood?.id).toBe('bab-ezzouar');
  });

  it('couvre Béjaïa, où des voisins essaient l’application', () => {
    const coverage = findCoverage({ latitude: 36.7509, longitude: 5.0567 }, NEIGHBORHOODS);
    expect(coverage.neighborhood?.id).toBe('bejaia-centre');
  });

  it('ne couvre pas une position en pleine mer, mais nomme le plus proche', () => {
    const coverage = findCoverage({ latitude: 37.6, longitude: 5.0 }, NEIGHBORHOODS);
    expect(coverage.neighborhood).toBeUndefined();
    expect(coverage.nearest).toBeDefined();
    expect(coverage.distanceMeters).toBeGreaterThan(8_000);
  });
});

describe('couverture du territoire', () => {
  it('propose une entrée pour chacune des 69 wilayas', () => {
    const codes = new Set(
      NEIGHBORHOODS.filter((n) => n.country === 'DZ').map((n) => n.regionCode)
    );
    for (let i = 1; i <= 69; i += 1) {
      expect(codes.has(String(i).padStart(2, '0'))).toBe(true);
    }
  });

  it('connaît les wilayas créées en 2026', () => {
    const bouSaada = NEIGHBORHOODS.find((n) => n.id === 'bou-saada');
    expect(bouSaada?.regionCode).toBe('68');
    expect(bouSaada?.region).toBe('Bou Saâda');
  });

  it('ne place aucun lieu hors de son pays', () => {
    const limites = {
      DZ: { lat: [18, 38], lon: [-9, 12] },
      CA: { lat: [41, 84], lon: [-142, -52] },
    } as const;

    for (const n of NEIGHBORHOODS) {
      const limite = limites[n.country];
      expect(n.latitude).toBeGreaterThan(limite.lat[0]);
      expect(n.latitude).toBeLessThan(limite.lat[1]);
      expect(n.longitude).toBeGreaterThan(limite.lon[0]);
      expect(n.longitude).toBeLessThan(limite.lon[1]);
    }
  });

  it('couvre les 13 provinces et territoires du Canada', () => {
    const canada = NEIGHBORHOODS.filter((n) => n.country === 'CA');
    expect(canada).toHaveLength(13);
    expect(canada.map((n) => n.regionCode)).toContain('QC');
    // Au Canada on s'arrête à la province : pas de palier en dessous.
    expect(canada.every((n) => n.subRegion === undefined)).toBe(true);
  });

  it('garde la daïra pour chaque commune algérienne', () => {
    const algerie = NEIGHBORHOODS.filter((n) => n.country === 'DZ');
    expect(algerie).toHaveLength(1541);
    expect(algerie.every((n) => Boolean(n.subRegion))).toBe(true);
  });

  it('ne jumelle qu’avec des quartiers existants', () => {
    const ids = new Set(NEIGHBORHOODS.map((n) => n.id));
    for (const n of NEIGHBORHOODS) {
      if (n.twinnedWith) expect(ids.has(n.twinnedWith)).toBe(true);
    }
  });
});
