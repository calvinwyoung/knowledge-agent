import { mkdirSync } from 'node:fs';

import { getModel } from '@mariozechner/pi-ai';
import {
  createAgentSession,
  createCodingTools,
  DefaultResourceLoader,
  SessionManager,
  type ToolDefinition,
} from '@mariozechner/pi-coding-agent';

import { createObservationRecorder } from '../../tracing/trace-agent.js';
import type { Agent, SolveOptions } from '../types.js';
import { submitAnswerTool } from './submit-answer-tool.js';

interface PiCodingAgentOptions {
  name?: string;
  systemPrompt?: string;
  customTools?: ToolDefinition[];
}

/**
 * Build the default system prompt. An optional `additionalTools` string
 * is inserted into the Tools section when provided.
 */
export function buildSystemPrompt(options?: { additionalTools?: string }): string {
  // Add a newline before and after the additional tools section for readability.
  const additionalTools = options?.additionalTools
    ? `\n${options.additionalTools}\n`
    : '';

  return `You are a research agent that solves questions \
by thinking carefully and using tools to gather evidence before answering.

# Approach

1. **Understand the question.** Before taking any action, break down what is
   being asked. Identify the key entities, constraints, and what form the
   answer should take.
2. **Plan your steps.** Outline a brief numbered plan (2-5 steps) for how
   you will find the answer. Prefer concrete, verifiable approaches over
   guessing.
3. **Use tools deliberately.** Use the tools available to you to
   gather evidence, compute answers, and verify results.
4. **Verify before answering.** After arriving at a candidate answer,
   check it. Re-read the question to confirm you are answering exactly
   what was asked. If a calculation is involved, re-run or cross-check it.
   If the answer should be returned in a specific format, then format it accordingly.
5. **State your final answer directly.** Once you are confident, give a
   concise final answer with no extra explanation or hedging. Just state
   the answer.

# Tools

## Coding & File System

You have coding and file-system tools. Use them to:
- Write or edit files, including scripts and code, to compute, transform,
  or verify data.
- Execute shell commands to perform tasks or queries.
${additionalTools}
# Guidelines

- Do not guess when you can compute or look something up with a tool.
- If the question references an attached file, inspect it before
  doing anything else. Use the appropriate tool (read, head, file,
  python, etc.) based on its extension.
- If a question requires counting, listing, or comparing, write code to
  do it rather than attempting it manually.
- If your first approach fails, try an alternative strategy before
  giving up.
- Always use relative paths (never absolute paths like /Users/…).
  Your working directory is already set to the correct location.
- When you have your final answer, call the \`submit_answer\` tool with
  only the answer value — no reasoning, no explanation, no extra
  commentary, no units (unless asked). For example, if the answer is
  "42", submit just "42", not "The answer is 42." or any surrounding
  text.`;
}

/**
 * Wrap the pi-coding-agent library into the Agent interface so it can be used for
 * benchmark evaluation.
 */
export function createPiCodingAgent(options: PiCodingAgentOptions = {}): Agent {
  const {
    name = 'pi-coding-agent',
    systemPrompt = buildSystemPrompt(),
    customTools,
  } = options;

  return {
    name,

    async solve(question, options?: SolveOptions) {
      // Override the default system prompt to focus the agent on concise benchmark
      // answers instead of general coding assistance.
      const loader = new DefaultResourceLoader({
        systemPromptOverride: () => systemPrompt,
        appendSystemPromptOverride: () => [],
      });
      await loader.reload();

      // Scope file operations to the working directory when provided to isolate artifacts
      // created in each run.
      const cwd = options?.workDir ?? process.cwd();
      if (options?.workDir) {
        mkdirSync(cwd, { recursive: true });
      }

      // Thinking is disabled for faster benchmark throughput, and an in-memory session is
      // used since we don't need persistence across runs.
      const { session } = await createAgentSession({
        cwd,
        // model: getModel('anthropic', 'claude-sonnet-4-6'),
        model: getModel('anthropic', 'claude-sonnet-4-20250514'),
        thinkingLevel: 'off',
        tools: createCodingTools(cwd),
        customTools: [submitAnswerTool, ...(customTools ?? [])],
        resourceLoader: loader,
        sessionManager: SessionManager.inMemory(),
      });

      await session.prompt(question.prompt);

      // pi-coding-agent doesn't expose a streaming event API, so we reconstruct
      // tracing spans from the completed message history.
      const recordObservation = createObservationRecorder();
      const messages = session.state.messages;
      for (const msg of messages) {
        if (msg.role === 'assistant' && Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block.type === 'toolCall') {
              recordObservation(block.name, { input: block.arguments });
            }
          }
          const textParts = msg.content
            .filter((c) => c.type === 'text')
            .map((c) => (c.type === 'text' ? c.text : ''));
          if (textParts.length > 0) {
            recordObservation('generation', {
              output: textParts.join('\n'),
            });
          }
        }
      }

      // Prefer the structured answer from a submit_answer tool call.
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role === 'assistant' && Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block.type === 'toolCall' && block.name === 'submit_answer') {
              return (block.arguments as { answer: string }).answer;
            }
          }
        }
      }

      // Fallback: last assistant text.
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role === 'assistant' && Array.isArray(msg.content)) {
          const textParts = msg.content
            .filter((c) => c.type === 'text')
            .map((c) => c.text);
          if (textParts.length > 0) {
            return textParts.join('\n');
          }
        }
      }

      return '';
    },
  };
}
