import {
  type LangfuseSpanAttributes,
  startActiveObservation,
  startObservation,
} from '@langfuse/tracing';

import { getLangfuseClient } from './init.js';

interface TraceResult {
  answer: string;
  traceId: string;
}

/**
 * Create a root Langfuse trace per solve call so that all child spans (tool calls,
 * generations) are grouped under one trace. When a sessionId is provided, the trace is
 * tagged with it so that all traces from the same benchmark run appear together in
 * Langfuse.
 */
export async function traceAgentSolve(
  agentName: string,
  questionId: string,
  prompt: string,
  solveFn: () => Promise<string>,
  sessionId?: string,
): Promise<TraceResult> {
  return startActiveObservation(agentName, async (trace) => {
    if (sessionId) {
      trace.updateTrace({ sessionId });
    }
    trace.update({ input: { questionId, prompt } });
    const result = await solveFn();
    trace.update({ output: result });
    return { answer: result, traceId: trace.traceId };
  });
}

/**
 * Post a boolean correctness score to Langfuse for the given trace, and store the
 * expected answer as trace metadata.
 */
export function scoreTrace(
  traceId: string,
  correct: boolean,
  expectedAnswer: string,
): void {
  const client = getLangfuseClient();
  if (!client) {
    return;
  }
  client.score({
    traceId,
    name: 'correctness',
    value: correct ? 1 : 0,
    dataType: 'BOOLEAN',
  });
  // Store the expected answer alongside the model output so reviewers
  // can compare them directly in Langfuse.
  client.trace({
    id: traceId,
    metadata: { expectedAnswer },
  });
}

/**
 * Create a sequence-aware observation recorder. Each call gets a start time at least 1 ms
 * after the previous one so Langfuse preserves the intended display order.
 */
export function createObservationRecorder() {
  let lastMs = 0;

  return function recordObservation(name: string, attrs: LangfuseSpanAttributes) {
    // Use wall-clock time when it has advanced past the last recorded
    // timestamp; otherwise bump by 1 ms.
    const now = Date.now();
    const ms = now > lastMs ? now : lastMs + 1;
    lastMs = ms;

    const startTime = new Date(ms);
    const span = startObservation(name, attrs, { startTime });
    span.end(new Date(ms + 1));
  };
}

/**
 * Build a Langfuse session ID that groups all traces from a single benchmark run.
 *
 * The session ID is formatted as:
 * <benchmarkName>/<agentName>/<YYYY-MM-DD-HHMM>
 */
export function buildSessionId(
  benchmarkName: string,
  agentName: string,
  now: Date = new Date(),
): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((p) => [p.type, p.value]),
  );
  const timestamp = `${parts.year}-${parts.month}-${parts.day}-${parts.hour}${parts.minute}`;
  return `${benchmarkName}/${agentName}/${timestamp}`;
}
