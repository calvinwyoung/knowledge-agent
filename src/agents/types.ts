import type { Question } from '../benchmarks/types.js';

export interface SolveOptions {
  workDir?: string;
}

/**
 * An agent answers a question.
 */
export interface Agent {
  name: string;
  solve(question: Question, options?: SolveOptions): Promise<string>;
}
