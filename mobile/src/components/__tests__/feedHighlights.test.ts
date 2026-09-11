import { latestAlert, newcomer } from '../FeedHighlights';
import type { Neighbor, Post } from '../../domain/types';

const maintenant = new Date('2026-09-11T12:00:00Z');

const post = (overrides: Partial<Post>): Post => ({
  id: 'p',
  authorName: 'Voisin',
  authorIsMe: false,
  category: 'entraide',
  text: 'texte',
  neighborhoodId: 'bab-ezzouar',
  createdAt: maintenant.toISOString(),
  likes: 0,
  likedByMe: false,
  commentCount: 0,
  reportedByMe: false,
  moderation: { cycles: 0, permanent: false, hidden: false },
  ...overrides,
});

const voisin = (overrides: Partial<Neighbor>): Neighbor => ({
  id: 'n',
  name: 'Voisin',
  trusted: false,
  joinedAt: maintenant.toISOString(),
  ...overrides,
});

const ilYA = (heures: number) =>
  new Date(maintenant.getTime() - heures * 3600_000).toISOString();

describe('latestAlert', () => {
  it('retient l’alerte de sécurité la plus récente', () => {
    const alerte = post({ id: 'recente', category: 'securite', createdAt: ilYA(1) });
    const ancienne = post({ id: 'ancienne', category: 'securite', createdAt: ilYA(3) });

    // Le fil arrive du serveur déjà trié, du plus récent au plus ancien.
    expect(latestAlert([alerte, ancienne], maintenant)?.id).toBe('recente');
  });

  it('ignore les publications qui ne sont pas des alertes', () => {
    expect(latestAlert([post({ category: 'entraide' })], maintenant)).toBeUndefined();
  });

  it('laisse retomber une alerte de plus de 24 h', () => {
    const vieille = post({ category: 'securite', createdAt: ilYA(25) });
    expect(latestAlert([vieille], maintenant)).toBeUndefined();
  });

  it('ne met jamais en avant une alerte masquée par la modération', () => {
    const masquee = post({
      category: 'securite',
      createdAt: ilYA(1),
      moderation: { cycles: 1, permanent: false, hidden: true },
    });
    expect(latestAlert([masquee], maintenant)).toBeUndefined();
  });
});

describe('newcomer', () => {
  it('retient le dernier arrivé de la semaine', () => {
    const hier = voisin({ id: 'hier', name: 'Hier', joinedAt: ilYA(24) });
    const avantHier = voisin({ id: 'avant', name: 'Avant', joinedAt: ilYA(48) });

    expect(newcomer([avantHier, hier], maintenant)?.id).toBe('hier');
  });

  it('oublie ceux qui sont arrivés il y a plus d’une semaine', () => {
    const ancien = voisin({ joinedAt: ilYA(24 * 8) });
    expect(newcomer([ancien], maintenant)).toBeUndefined();
  });

  it('ne propose personne dans un quartier sans voisin', () => {
    expect(newcomer([], maintenant)).toBeUndefined();
  });
});
