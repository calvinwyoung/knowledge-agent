import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod/v4';

/**
 * Tool that forces the model to place its final answer in a structured tool-call
 * argument, matching the pi-coding-agent pattern.
 */
const submitAnswerTool = tool(
  'submit_answer',
  'Submit the final answer to the question.',
  {
    answer: z
      .string()
      .describe(
        'The final answer value only — no reasoning, explanation, or ' +
          'units (unless asked). E.g. "42", not "The answer is 42."',
      ),
  },
  async () => ({
    content: [{ type: 'text', text: 'Answer submitted.' }],
  }),
);

/**
 * In-process MCP server that exposes the submit_answer tool to the Claude Agent SDK.
 */
export const answerMcpServer = createSdkMcpServer({
  name: 'answer',
  tools: [submitAnswerTool],
});
