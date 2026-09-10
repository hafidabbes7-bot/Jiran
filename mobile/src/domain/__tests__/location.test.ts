import { checkPosition, distanceMeters } from '../location';
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
