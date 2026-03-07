import type { Agent } from '../agents/types.js';
import type { Benchmark, Question } from '../benchmarks/types.js';
import { scoreTrace, traceAgentSolve } from '../tracing/index.js';

/**
 * Options for executing a single question.
 */
export interface ExecuteQuestionOptions {
  agent: Agent;
  benchmark: Benchmark;
  question: Question;
  sessionId: string;
  workDir: string;
}

/**
 * Result of running one question.
 */
export interface ExecuteQuestionResult {
  questionId: string;
  modelAnswer: string;
  expectedAnswer: string;
  isCorrect: boolean;
  durationMs: number;
}

/**
 * Solve a single question with the given agent, evaluate the answer against
 * the benchmark's expected answer, and return a Result. Assumes any attached
 * files have already been provisioned in workDir.
 */
export async function executeQuestion(
  options: ExecuteQuestionOptions,
): Promise<ExecuteQuestionResult> {
  const { agent, benchmark, question, sessionId, workDir } = options;

  console.log(`[${question.id}]`);
  console.log(`  Q: ${question.prompt.slice(0, 200)}...`);

  const start = performance.now();
  let modelAnswer: string;
  let traceId: string | undefined;
  try {
    const result = await traceAgentSolve(
      agent.name,
      question.id,
      question.prompt,
      () =>
        agent.solve(question, {
          // Handle each question in its own working directory to prevent
          // cross-contamination between questions.
          workDir,
        }),
      sessionId,
    );
    modelAnswer = result.answer;
    traceId = result.traceId;
  } catch (err) {
    // Record the failure but keep going so one broken question doesn't
    // abort the entire run.
    console.log(`  ERROR: ${err}`);
    modelAnswer = '';
  }
  const durationMs = performance.now() - start;

  const isCorrect = benchmark.evaluate(modelAnswer, question.expectedAnswer);

  if (traceId) {
    scoreTrace(traceId, isCorrect, question.expectedAnswer);
  }

  console.log(`  A: ${modelAnswer}`);
  console.log(`  Expected: ${question.expectedAnswer}`);
  console.log(
    `  ${isCorrect ? 'CORRECT' : 'WRONG'} (${(durationMs / 1000).toFixed(1)}s)\n`,
  );

  return {
    questionId: question.id,
    modelAnswer,
    expectedAnswer: question.expectedAnswer,
    isCorrect,
    durationMs,
  };
}
