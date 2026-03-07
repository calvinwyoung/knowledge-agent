import { describe, expect, it } from 'vitest';

import { getBenchmark } from './index.js';

describe('getBenchmark', () => {
  it('returns the gaia benchmark', () => {
    const benchmark = getBenchmark('gaia');
    expect(benchmark).toBeDefined();
    expect(benchmark.name).toBe('gaia');
  });

  it('throws for an unknown benchmark name', () => {
    expect(() => getBenchmark('nonexistent')).toThrow(/Unknown benchmark: "nonexistent"/);
  });
});
