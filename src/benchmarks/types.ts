/**
 * A single benchmark question.
 */
export interface Question {
  id: string;
  prompt: string;
  expectedAnswer: string;
  metadata: Record<string, unknown>;
}

/**
 * A benchmark loads questions and scores answers.
 */
export interface Benchmark {
  name: string;
  load(options: {
    file: string;
    limit?: number;
    filter?: Record<string, unknown>;
  }): Promise<Question[]>;
  evaluate(modelAnswer: string, expectedAnswer: string): boolean;
}
