import path from 'node:path';

import pLimit from 'p-limit';

import { getBenchmark, type Question } from '../benchmarks/index.js';
import { buildSessionId } from '../tracing/index.js';
import type { ExecuteQuestionResult } from './execute-question.js';
import { forkQuestion } from './fork-question.js';

// Top-level directory that holds per-run workspace subdirectories.
const WORKSPACES_DIR = 'workspaces';

interface RunOptions {
  // Path to the data file that the benchmark loader reads questions from.
  file: string;
  // Maximum number of questions to evaluate (useful for quick smoke tests).
  limit?: number;
  // Key-value pairs passed to the benchmark loader for filtering (e.g., level).
  filter?: Record<string, unknown>;
  // Number of questions to run in parallel; defaults to 1 (sequential).
  concurrency?: number;
}

/**
 * An `ExecuteQuestionResult` enriched with the original question.
 */
interface RunResult extends ExecuteQuestionResult {
  question: Question;
}

/**
 * Run an agent against all benchmark questions, collecting timing and correctness for
 * each. Each question is run in a child process whose cwd is set to its workspace
 * directory to guarantee file isolation.
 */
export async function run(
  agentName: string,
  benchmarkName: string,
  options: RunOptions,
): Promise<RunResult[]> {
  const benchmark = getBenchmark(benchmarkName);
  const questions = await benchmark.load(options);
  const sessionId = buildSessionId(benchmark.name, agentName);

  // Create a session-scoped workspace directory to isolate file operations.
  const workspaceDir = path.resolve(WORKSPACES_DIR, sessionId);
  console.log(`Loaded ${questions.length} questions from "${benchmark.name}"\n`);

  const limit = pLimit(options.concurrency ?? 1);
  const promises = questions.map((question, i) => {
    const workDir = path.join(workspaceDir, question.id);
    return limit(async () => {
      console.log(`[${i + 1}/${questions.length}] ${question.id}`);

      const result = await forkQuestion({
        agentName,
        benchmarkName,
        question,
        sessionId,
        workDir,
      });

      return { ...result, question };
    });
  });

  return Promise.all(promises);
}

/**
 * Aggregate results into overall accuracy and timing, with an optional
 * per-level breakdown (for GAIA's multi-level structure).
 */
export function printSummary(results: RunResult[]): void {
  const total = results.length;
  const correct = results.filter((r) => r.isCorrect).length;
  const accuracy = total > 0 ? (correct / total) * 100 : 0;
  const totalTime = results.reduce((s, r) => s + r.durationMs, 0) / 1000;
  const avgTime = total > 0 ? totalTime / total : 0;

  console.log('='.repeat(60));
  console.log(`Results: ${correct}/${total} correct (${accuracy.toFixed(1)}%)`);
  console.log(`Total time: ${totalTime.toFixed(1)}s`);
  console.log(`Average time: ${avgTime.toFixed(1)}s / question`);

  // Group by level if available.
  const byLevel = new Map<unknown, RunResult[]>();
  for (const r of results) {
    const level = r.question.metadata.level;
    if (level !== undefined) {
      const group = byLevel.get(level) ?? [];
      group.push(r);
      byLevel.set(level, group);
    }
  }

  if (byLevel.size > 0) {
    console.log('\nBy level:');
    for (const [level, group] of [...byLevel.entries()].sort()) {
      const c = group.filter((r) => r.isCorrect).length;
      const pct = ((c / group.length) * 100).toFixed(1);
      console.log(`  Level ${level}: ${c}/${group.length} (${pct}%)`);
    }
  }

  console.log('='.repeat(60));
}
