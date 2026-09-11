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
    const codes = new Set(NEIGHBORHOODS.map((n) => n.wilayaCode));
    for (let i = 1; i <= 69; i += 1) {
      expect(codes.has(String(i).padStart(2, '0'))).toBe(true);
    }
  });

  it('connaît les wilayas créées en 2026', () => {
    const bouSaada = NEIGHBORHOODS.find((n) => n.id === 'bou-saada');
    expect(bouSaada?.wilayaCode).toBe('68');
    expect(bouSaada?.wilaya).toBe('Bou Saâda');
  });

  it('ne place aucun quartier hors d’Algérie', () => {
    for (const n of NEIGHBORHOODS) {
      expect(n.latitude).toBeGreaterThan(18);
      expect(n.latitude).toBeLessThan(38);
      expect(n.longitude).toBeGreaterThan(-9);
      expect(n.longitude).toBeLessThan(12);
    }
  });

  it('ne jumelle qu’avec des quartiers existants', () => {
    const ids = new Set(NEIGHBORHOODS.map((n) => n.id));
    for (const n of NEIGHBORHOODS) {
      if (n.twinnedWith) expect(ids.has(n.twinnedWith)).toBe(true);
    }
  });
});
