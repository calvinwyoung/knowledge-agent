import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createClaudeAgent } from './index.js';

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: mockQuery,
}));

/**
 * Build an async message stream matching the SDK's query interface.
 */
async function* streamMessages(messages: unknown[]): AsyncGenerator<unknown, void> {
  for (const message of messages) {
    yield message;
  }
}

describe('createClaudeAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefers structured output answer on successful result', async () => {
    mockQuery.mockReturnValueOnce(
      streamMessages([
        {
          type: 'result',
          subtype: 'success',
          result: 'fallback-result',
          structured_output: { answer: 'structured-answer' },
        },
      ]),
    );

    const agent = createClaudeAgent();
    const answer = await agent.solve({
      id: 'q1',
      prompt: 'What is 2 + 2?',
      expectedAnswer: '4',
      metadata: {},
    });

    expect(answer).toBe('structured-answer');
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const params = mockQuery.mock.calls[0][0] as {
      options: { outputFormat?: { type?: string; schema?: Record<string, unknown> } };
    };
    expect(params.options.outputFormat?.type).toBe('json_schema');
    expect(params.options.outputFormat?.schema).toMatchObject({
      type: 'object',
      properties: {
        answer: { type: 'string' },
      },
      required: ['answer'],
      additionalProperties: false,
    });
  });

  it('falls back to result text when structured output is missing or invalid', async () => {
    mockQuery.mockReturnValueOnce(
      streamMessages([
        {
          type: 'result',
          subtype: 'success',
          result: 'fallback-result',
          structured_output: { answer: 42 },
        },
      ]),
    );

    const agent = createClaudeAgent();
    const answer = await agent.solve({
      id: 'q2',
      prompt: 'Return answer.',
      expectedAnswer: 'fallback-result',
      metadata: {},
    });

    expect(answer).toBe('fallback-result');
  });

  it('returns last assistant text when structured output retries are exhausted', async () => {
    mockQuery.mockReturnValueOnce(
      streamMessages([
        {
          type: 'assistant',
          message: {
            content: [{ type: 'text', text: 'assistant-fallback' }],
          },
        },
        {
          type: 'result',
          subtype: 'error_max_structured_output_retries',
          errors: ['schema validation failed'],
        },
      ]),
    );

    const agent = createClaudeAgent();
    const answer = await agent.solve({
      id: 'q3',
      prompt: 'Return answer.',
      expectedAnswer: 'assistant-fallback',
      metadata: {},
    });

    expect(answer).toBe('assistant-fallback');
  });

  it('returns last assistant text when max turns exceeded', async () => {
    mockQuery.mockReturnValueOnce(
      streamMessages([
        {
          type: 'assistant',
          message: {
            content: [{ type: 'text', text: 'partial-progress' }],
          },
        },
        {
          type: 'result',
          subtype: 'error_max_turns',
        },
      ]),
    );

    const agent = createClaudeAgent();
    const answer = await agent.solve({
      id: 'q4',
      prompt: 'Long running question.',
      expectedAnswer: 'partial-progress',
      metadata: {},
    });

    expect(answer).toBe('partial-progress');
  });

  it('falls through empty result string to assistant text', async () => {
    mockQuery.mockReturnValueOnce(
      streamMessages([
        {
          type: 'assistant',
          message: {
            content: [{ type: 'text', text: 'assistant-text' }],
          },
        },
        {
          type: 'result',
          subtype: 'success',
          result: '',
          structured_output: { answer: 42 },
        },
      ]),
    );

    const agent = createClaudeAgent();
    const answer = await agent.solve({
      id: 'q5',
      prompt: 'Return answer.',
      expectedAnswer: 'assistant-text',
      metadata: {},
    });

    expect(answer).toBe('assistant-text');
  });
});
