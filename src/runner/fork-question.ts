import { fork } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

import type { Question } from '../benchmarks/types.js';
import type { ExecuteQuestionResult } from './execute-question.js';

export interface ForkQuestionOptions {
  agentName: string;
  benchmarkName: string;
  question: Question;
  workDir: string;
  sessionId: string;
}

/**
 * If the question has an attached file, copy it into the working
 * directory so the child agent can access it.
 */
function provisionAttachedFile(question: Question, workDir: string): void {
  const { fileName, filePath, dataDir } = question.metadata as {
    fileName?: string;
    filePath?: string;
    dataDir?: string;
  };

  if (!fileName) {
    return;
  }

  // Resolve the source file. GAIA stores attachments relative to the
  // parquet file's directory.
  const candidates: string[] = [];
  if (filePath) {
    candidates.push(filePath);
  }
  if (dataDir) {
    candidates.push(path.join(dataDir, fileName));
  }

  let src: string | undefined;
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (existsSync(resolved)) {
      src = resolved;
      break;
    }
  }

  if (!src) {
    return;
  }

  mkdirSync(workDir, { recursive: true });
  copyFileSync(src, path.join(workDir, fileName));
}

/**
 * Spawn a child process to run the benchmark question.
 *
 * This function sets up the scaffolding for the child process, including:
 * - Copying any attached file into the question's workspace directory
 * - Setting the child process's cwd to the question's workspace directory
 */
export async function forkQuestion(
  options: ForkQuestionOptions,
): Promise<ExecuteQuestionResult> {
  const { agentName, benchmarkName, question, workDir, sessionId } = options;

  mkdirSync(workDir, { recursive: true });

  // Copy any attached file into workDir before spawning — source paths
  // are relative to the data directory, which the child process won't
  // have access to via cwd.
  provisionAttachedFile(question, workDir);

  const payload = JSON.stringify({
    agentName,
    benchmarkName,
    question,
    sessionId,
  });

  // Use the same entry point the parent was invoked with. Resolve to an
  // absolute path so it works regardless of the child's cwd.
  const entryPoint = path.resolve(process.argv[1]);

  return new Promise((resolve, reject) => {
    const child = fork(entryPoint, ['run-question'], {
      cwd: workDir,
      // Keep inherited execArgv (e.g. tsx loader hooks) but drop --env-file, which would
      // fail because .env doesn't exist in the child's cwd. Environment variables are
      // already inherited via process.env.
      execArgv: process.execArgv.filter((arg) => !arg.startsWith('--env-file')),
      // Pipe stdin, stdout, and stderr to the parent process. The child writes the result
      // to stdout, and prints the question/answer information to stderr for progress
      // tracking.
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });

    let stdout = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    // Buffer stderr so concurrent children don't interleave output.
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    // Send the payload via stdin so we don't hit arg-length limits.
    child.stdin?.end(payload);

    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Child process exited with code ${code}\n${stderr}`));
        return;
      }

      // If there is any stderr output, write it to the parent's stdout so it all appears
      // at the same time in order of completion.
      if (stderr) {
        process.stdout.write(stderr);
      }

      try {
        resolve(JSON.parse(stdout) as ExecuteQuestionResult);
      } catch (err) {
        reject(
          new Error(
            `Failed to parse child stdout as ExecuteQuestionResult: ${err}\n${stdout}`,
          ),
        );
      }
    });
  });
}
