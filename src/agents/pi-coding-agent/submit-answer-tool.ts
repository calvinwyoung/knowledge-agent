import type { ToolDefinition } from '@mariozechner/pi-coding-agent';
import { Type } from '@sinclair/typebox';

export const submitAnswerTool: ToolDefinition = {
  name: 'submit_answer',
  label: 'Submit Answer',
  description: 'Submit the final answer to the question.',
  parameters: Type.Object({
    answer: Type.String({
      description:
        'The final answer value only — no reasoning, explanation, or ' +
        'units (unless asked). E.g. "42", not "The answer is 42."',
    }),
  }),
  async execute() {
    return {
      content: [{ type: 'text', text: 'Answer submitted.' }],
      details: {},
    };
  },
};
