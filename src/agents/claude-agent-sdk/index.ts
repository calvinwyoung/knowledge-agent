import { query } from '@anthropic-ai/claude-agent-sdk';

import { createObservationRecorder } from '../../tracing/trace-agent.js';
import type { Agent } from '../types.js';
import { answerMcpServer } from './submit-answer-tool.js';

interface ClaudeAgentOptions {
  maxTurns?: number;
  systemPrompt?: string;
}

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
- When you have your final answer, call the \`submit_answer\` tool with
  only the answer value — no reasoning, no explanation, no extra
  commentary, no units (unless asked). For example, if the answer is
  "42", submit just "42", not "The answer is 42." or any surrounding
  text.`;

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
          mcpServers: {
            answer: answerMcpServer,
          },
        },
      });

      // The SDK provides a streaming interface, so we create tracing spans
      // inline as messages arrive.
      const recordObservation = createObservationRecorder();
      let result = '';
      let submitAnswerValue = '';
      let fallbackAssistantText = '';
      for await (const message of conversation) {
        if (message.type === 'assistant') {
          // Decompose content blocks into separate observations so tool
          // calls appear as distinct siblings rather than buried in a
          // generation blob.
          for (const block of message.message.content) {
            if (block.type === 'tool_use') {
              recordObservation(block.name, { input: block.input });
              // Capture the answer from a submit_answer tool call.
              if (block.name === 'mcp__answer__submit_answer') {
                submitAnswerValue = (block.input as { answer: string }).answer;
              }
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
            // Use || so empty strings fall through to the next candidate.
            result = submitAnswerValue || message.result || fallbackAssistantText;
          } else {
            // Any error subtype (max_turns, execution error) — fall back
            // to the last assistant text we captured.
            result = fallbackAssistantText;
          }
        }
      }
      return result;
    },
  };
}
