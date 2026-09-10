import { NEIGHBORHOODS, sharedFeedNeighborhoodIds } from '../neighborhoods';

describe('sharedFeedNeighborhoodIds', () => {
  it('rend un quartier avec les cités qui lui sont rattachées', () => {
    const ids = sharedFeedNeighborhoodIds('dar-el-beida');
    expect(ids).toEqual(expect.arrayContaining(['dar-el-beida', 'rouiba', 'reghaia']));
  });

  it('rattache une cité jumelée au fil partagé', () => {
    const ids = sharedFeedNeighborhoodIds('rouiba');
    expect(ids).toEqual(expect.arrayContaining(['rouiba', 'dar-el-beida', 'reghaia']));
  });

  it('laisse un grand quartier avec son seul fil', () => {
    expect(sharedFeedNeighborhoodIds('alger-centre')).toEqual(['alger-centre']);
  });

  it('ne renvoie que des identifiants connus', () => {
    const known = new Set(NEIGHBORHOODS.map((n) => n.id));
    for (const id of sharedFeedNeighborhoodIds('rouiba')) {
      expect(known.has(id)).toBe(true);
    }
  });
});
