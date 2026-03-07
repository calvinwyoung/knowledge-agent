import { query } from '@anthropic-ai/claude-agent-sdk';
import { toJSONSchema, z } from 'zod/v4';

import { createObservationRecorder } from '../../tracing/trace-agent.js';
import type { Agent } from '../types.js';

interface ClaudeAgentOptions {
  maxTurns?: number;
  systemPrompt?: string;
}

const AnswerOutputSchema = z
  .object({
    answer: z.string(),
  })
  .strict();

const DEFAULT_SYSTEM_PROMPT = `You are a research agent that solves questions \
by thinking carefully and using tools to gather evidence before answering.

# Approach

1. **Understand the question.** Before taking any action, break down what is
   being asked. Identify the key entities, constraints, and what form the
   answer should take.
2. **Plan your steps.** Outline a brief numbered plan (2-5 steps) for how
   you will find the answer. Prefer concrete, verifiable approaches over
   guessing.
3. **Use tools deliberately.** You have access to coding and file-system
   tools. Use them to:
   - Write or edit files, including scripts and code, to compute, transform, or verify
     data.
   - Execute shell commands to perform tasks or queries.
4. **Verify before answering.** After arriving at a candidate answer,
   check it. Re-read the question to confirm you are answering exactly
   what was asked. If a calculation is involved, re-run or cross-check it.
   If the answer should be returned in a specific format, then format it accordingly.
5. **State your final answer directly.** Once you are confident, give a
   concise final answer with no extra explanation or hedging. Just state
   the answer.

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
- Return your final answer in structured output field \`answer\` with
  only the answer value, no extra commentary, units (unless asked), or
  explanation.`;

/**
 * Wrap the Claude Agent SDK into the Agent interface so it can be used for benchmark evaluation.
 */
export function createClaudeAgent(options: ClaudeAgentOptions = {}): Agent {
  const { maxTurns = 100, systemPrompt = DEFAULT_SYSTEM_PROMPT } = options;

  return {
    name: 'claude-agent-sdk',

    async solve(question, _options?) {
      const conversation = query({
        prompt: question.prompt,
        options: {
          model: 'claude-sonnet-4-6',
          // Permissions are bypassed because benchmark runs are fully automated with no
          // human in the loop.
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
          maxTurns,
          systemPrompt,
          outputFormat: {
            type: 'json_schema',
            schema: toJSONSchema(AnswerOutputSchema),
          },
        },
      });

      // The SDK provides a streaming interface, so we create tracing spans
      // inline as messages arrive.
      const recordObservation = createObservationRecorder();
      let result = '';
      let fallbackAssistantText = '';
      for await (const message of conversation) {
        if (message.type === 'assistant') {
          // Decompose content blocks into separate observations so tool
          // calls appear as distinct siblings rather than buried in a
          // generation blob.
          for (const block of message.message.content) {
            if (block.type === 'tool_use') {
              recordObservation(block.name, { input: block.input });
            } else if (block.type === 'text') {
              recordObservation('generation', { output: block.text });
              fallbackAssistantText = block.text;
            }
          }
        } else if (message.type === 'tool_progress') {
          recordObservation(message.tool_name ?? 'tool_call', {
            input: {
              tool_use_id: message.tool_use_id,
              elapsed_time_seconds: message.elapsed_time_seconds,
            },
          });
        } else if (message.type === 'result') {
          if (message.subtype === 'success') {
            const structured = AnswerOutputSchema.safeParse(message.structured_output);
            // Use || so empty strings fall through to the next candidate.
            result =
              (structured.success ? structured.data.answer : null) ??
              (message.result || fallbackAssistantText);
          } else {
            // Any error subtype (max_turns, execution error, structured
            // output retries exhausted) — fall back to the last assistant
            // text we captured.
            result = fallbackAssistantText;
          }
        }
      }
      return result;
    },
  };
}
