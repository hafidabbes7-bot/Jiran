import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SlidingWindowLimiter } from './rateLimit.js';

describe('SlidingWindowLimiter', () => {
  it('laisse passer jusqu’au quota puis bloque', () => {
    let clock = 0;
    const limiter = new SlidingWindowLimiter(3, 60, () => clock);

    assert.equal(limiter.take('ip'), true);
    assert.equal(limiter.take('ip'), true);
    assert.equal(limiter.take('ip'), true);
    assert.equal(limiter.take('ip'), false);
  });

  it('rouvre le quota une fois la fenêtre passée', () => {
    let clock = 0;
    const limiter = new SlidingWindowLimiter(1, 60, () => clock);

    assert.equal(limiter.take('ip'), true);
    assert.equal(limiter.take('ip'), false);

    clock += 61_000;
    assert.equal(limiter.take('ip'), true);
  });

  it('compte séparément deux clés', () => {
    let clock = 0;
    const limiter = new SlidingWindowLimiter(1, 60, () => clock);

    assert.equal(limiter.take('ip-a'), true);
    assert.equal(limiter.take('ip-b'), true);
  });
});
