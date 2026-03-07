import type { ToolDefinition } from '@mariozechner/pi-coding-agent';
import { Type } from '@sinclair/typebox';

export const submitAnswerTool: ToolDefinition = {
  name: 'submit_answer',
  label: 'Submit Answer',
  description: 'Submit the final answer to the question.',
  parameters: Type.Object({
    answer: Type.String({
      description:
        'The final answer — just the value, no extra commentary, ' +
        'units (unless asked), or explanation.',
    }),
  }),
  async execute() {
    return {
      content: [{ type: 'text', text: 'Answer submitted.' }],
      details: {},
    };
  },
};
