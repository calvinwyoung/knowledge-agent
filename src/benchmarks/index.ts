import { gaiaBenchmark } from './gaia/index.js';
import type { Benchmark } from './types.js';

// Benchmark registry, mirroring the agent registry pattern in src/agents/index.ts.
const benchmarks: Record<string, Benchmark> = {
  gaia: gaiaBenchmark,
};

/**
 * Look up a benchmark by name from the registry.
 */
export function getBenchmark(name: string): Benchmark {
  const benchmark = benchmarks[name];
  if (!benchmark) {
    const available = Object.keys(benchmarks).join(', ');
    throw new Error(`Unknown benchmark: "${name}". Available: ${available}`);
  }
  return benchmark;
}

export type { Benchmark, Question } from './types.js';
