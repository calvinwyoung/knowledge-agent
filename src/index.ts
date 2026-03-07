import { getAgent } from './agents/index.js';
import { getBenchmark } from './benchmarks/index.js';
import type { Question } from './benchmarks/types.js';
import { executeQuestion, printSummary, run } from './runner/index.js';
import { initTracing, shutdownTracing, traceAgentSolve } from './tracing/index.js';

/**
 * Read all data from stdin as a UTF-8 string.
 */
function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

/**
 * Minimal CLI arg parser that avoids pulling in external dependencies like yargs or
 * commander.
 */
function parseArgs(args: string[]): {
  command: string;
  flags: Record<string, string>;
  positional: string[];
} {
  const command = args[0] ?? 'help';
  const flags: Record<string, string> = {};
  const positional: string[] = [];

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = 'true';
      }
    } else {
      positional.push(arg);
    }
  }

  return { command, flags, positional };
}

/**
 * Print CLI usage information to stdout.
 */
function printUsage(): void {
  console.log(`Usage:
  knowledge-agent run --agent <name> --benchmark <name> --file <path> [--level <n>] [--limit <n>] [--concurrency <n>]
  knowledge-agent ask --agent <name> "<question>"
  knowledge-agent help`);
}

/**
 * CLI entry point that dispatches to `run` (benchmark evaluation) or `ask` (single question) subcommands.
 */
async function main(): Promise<void> {
  initTracing();

  const { command, flags, positional } = parseArgs(process.argv.slice(2));

  switch (command) {
    case 'run': {
      const agentName = flags.agent;
      const benchmarkName = flags.benchmark;
      const file = flags.file;

      if (!agentName || !benchmarkName || !file) {
        console.error('Error: --agent, --benchmark, and --file are required');
        printUsage();
        process.exit(1);
      }

      const filter: Record<string, unknown> = {};
      if (flags.level) {
        filter.level = flags.level;
      }

      const limit = flags.limit ? Number.parseInt(flags.limit, 10) : undefined;
      const concurrency = flags.concurrency
        ? Number.parseInt(flags.concurrency, 10)
        : undefined;

      const results = await run(agentName, benchmarkName, {
        file,
        limit,
        filter,
        concurrency,
      });
      printSummary(results);
      break;
    }

    case 'run-question': {
      // Child-process entry point. Reads a JSON payload from stdin containing the
      // question, agent/benchmark names, and session info. Writes the Result as JSON
      // to stdout.

      // Redirect console.log to stderr so that runQuestion's progress output doesn't
      // corrupt the JSON result written to stdout.
      console.log = console.error;

      const input = await readStdin();
      const {
        agentName: childAgentName,
        benchmarkName: childBenchmarkName,
        question,
        sessionId,
      } = JSON.parse(input) as {
        agentName: string;
        benchmarkName: string;
        question: Question;
        sessionId: string;
      };

      const agent = getAgent(childAgentName);
      const benchmark = getBenchmark(childBenchmarkName);

      // The parent already provisioned the attached file and amended the
      // prompt, so we pass process.cwd() as workDir.
      const result = await executeQuestion({
        agent,
        benchmark,
        question,
        sessionId,
        workDir: process.cwd(),
      });

      // Write the result to stdout for the parent to parse.
      process.stdout.write(JSON.stringify(result));
      break;
    }

    case 'ask': {
      const agentName = flags.agent;
      const question = positional[0];

      if (!agentName || !question) {
        console.error('Error: --agent and a question are required');
        printUsage();
        process.exit(1);
      }

      const agent = getAgent(agentName);
      const questionObj = {
        id: 'ask',
        prompt: question,
        expectedAnswer: '',
        metadata: {},
      };
      // Wrap the solve call in a Langfuse trace so tool calls and generations are
      // observable.
      const { answer } = await traceAgentSolve(agent.name, 'ask', question, () =>
        agent.solve(questionObj),
      );
      console.log(answer);
      break;
    }

    default:
      printUsage();
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  // Flush pending Langfuse spans even when the process exits due to an error.
  .finally(() => shutdownTracing());
