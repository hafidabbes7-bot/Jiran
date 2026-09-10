import {
  HIDE_DURATION_DAYS,
  computeModerationState,
  isHidden,
  reportsUntilNextCycle,
} from '../moderation/blocking';
import type { Report } from '../types';

const at = (minutes: number) => new Date(Date.UTC(2026, 0, 1, 12, minutes)).toISOString();

const report = (reporterId: string, minutes: number, postId = 'p1'): Report => ({
  postId,
  reporterId,
  reason: 'inapproprie',
  createdAt: at(minutes),
});

describe('computeModerationState', () => {
  it('laisse visible en dessous de 3 signalements', () => {
    const state = computeModerationState('p1', [report('a', 0), report('b', 1)]);
    expect(state.cycles).toBe(0);
    expect(isHidden(state)).toBe(false);
  });

  it('ne compte pas deux fois le même voisin', () => {
    const state = computeModerationState('p1', [report('a', 0), report('a', 1), report('a', 2)]);
    expect(state.cycles).toBe(0);
    expect(isHidden(state)).toBe(false);
  });

  it('masque 3 jours après 3 signalements de voisins différents', () => {
    const state = computeModerationState('p1', [report('a', 0), report('b', 1), report('c', 2)]);

    expect(state.cycles).toBe(1);
    expect(state.permanent).toBe(false);

    const justBefore = new Date(
      new Date(at(2)).getTime() + HIDE_DURATION_DAYS * 24 * 3600_000 - 1000
    );
    const justAfter = new Date(
      new Date(at(2)).getTime() + HIDE_DURATION_DAYS * 24 * 3600_000 + 1000
    );
    expect(isHidden(state, justBefore)).toBe(true);
    expect(isHidden(state, justAfter)).toBe(false);
  });

  it('bloque définitivement à la récidive', () => {
    const state = computeModerationState('p1', [
      report('a', 0),
      report('b', 1),
      report('c', 2),
      report('d', 3),
      report('e', 4),
      report('f', 5),
    ]);

    expect(state.cycles).toBe(2);
    expect(state.permanent).toBe(true);
    expect(state.hiddenUntil).toBeUndefined();
    expect(isHidden(state, new Date('2030-01-01T00:00:00Z'))).toBe(true);
  });

  it('ignore les signalements visant une autre publication', () => {
    const state = computeModerationState('p1', [
      report('a', 0),
      report('b', 1, 'p2'),
      report('c', 2, 'p2'),
    ]);
    expect(state.cycles).toBe(0);
  });
});

describe('reportsUntilNextCycle', () => {
  it('décompte les signalements manquants', () => {
    expect(reportsUntilNextCycle('p1', [])).toBe(3);
    expect(reportsUntilNextCycle('p1', [report('a', 0)])).toBe(2);
    expect(reportsUntilNextCycle('p1', [report('a', 0), report('b', 1)])).toBe(1);
    // Le cycle est bouclé : le décompte repart à 3.
    expect(reportsUntilNextCycle('p1', [report('a', 0), report('b', 1), report('c', 2)])).toBe(3);
  });
});
