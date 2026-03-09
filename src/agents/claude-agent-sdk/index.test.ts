import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createClaudeAgent } from './index.js';

const { mockQuery, mockAnswerServer } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockAnswerServer: { type: 'sdk', name: 'answer' },
}));

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: mockQuery,
}));

vi.mock('./submit-answer-tool.js', () => ({
  answerMcpServer: mockAnswerServer,
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

  it('passes mcpServers option to query', async () => {
    mockQuery.mockReturnValueOnce(
      streamMessages([
        {
          type: 'result',
          subtype: 'success',
          result: 'result-text',
        },
      ]),
    );

    const agent = createClaudeAgent();
    await agent.solve({
      id: 'q1',
      prompt: 'What is 2 + 2?',
      expectedAnswer: '4',
      metadata: {},
    });

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const params = mockQuery.mock.calls[0][0] as {
      options: { mcpServers?: Record<string, unknown> };
    };
    expect(params.options.mcpServers).toBeDefined();
    expect(params.options.mcpServers).toHaveProperty('answer');
  });

  it('extracts answer from submit_answer tool-use block', async () => {
    mockQuery.mockReturnValueOnce(
      streamMessages([
        {
          type: 'assistant',
          message: {
            content: [
              { type: 'text', text: 'Let me compute that.' },
              {
                type: 'tool_use',
                name: 'mcp__answer__submit_answer',
                input: { answer: 'tool-answer' },
              },
            ],
          },
        },
        {
          type: 'result',
          subtype: 'success',
          result: 'fallback-result',
        },
      ]),
    );

    const agent = createClaudeAgent();
    const answer = await agent.solve({
      id: 'q2',
      prompt: 'What is 2 + 2?',
      expectedAnswer: '4',
      metadata: {},
    });

    expect(answer).toBe('tool-answer');
  });

  it('falls back to result text when no submit_answer call', async () => {
    mockQuery.mockReturnValueOnce(
      streamMessages([
        {
          type: 'result',
          subtype: 'success',
          result: 'fallback-result',
        },
      ]),
    );

    const agent = createClaudeAgent();
    const answer = await agent.solve({
      id: 'q3',
      prompt: 'Return answer.',
      expectedAnswer: 'fallback-result',
      metadata: {},
    });

    expect(answer).toBe('fallback-result');
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
