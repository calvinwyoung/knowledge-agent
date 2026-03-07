import type { ToolDefinition } from '@mariozechner/pi-coding-agent';
import { type Static, Type } from '@sinclair/typebox';
import { Exa } from 'exa-js';

const parameters = Type.Object({
  query: Type.String({ description: 'The search query' }),
  numResults: Type.Optional(
    Type.Number({
      description: 'Number of results to return (default: 10)',
    }),
  ),
});

type Params = Static<typeof parameters>;

/**
 * Search the web using Exa.ai. Returns titles, URLs, and text snippets for the top
 * results.
 */
export const webSearchTool: ToolDefinition = {
  name: 'web_search',
  label: 'Web Search',
  description:
    'Search the web using Exa.ai. Returns titles, URLs, and text snippets for the top results.',
  parameters,
  async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
    const { query, numResults = 10 } = params as Params;

    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) {
      throw new Error('EXA_API_KEY environment variable is not set');
    }

    const exa = new Exa(apiKey);

    const result = await exa.searchAndContents(query, {
      numResults,
      text: true,
    });

    const formatted = result.results
      .map((r, i) => {
        const snippet = r.text ?? '';
        return `${i + 1}. ${r.title ?? 'Untitled'}\n   ${r.url}\n   ${snippet}`;
      })
      .join('\n\n');

    return {
      content: [{ type: 'text', text: formatted || 'No results found.' }],
      details: {},
    };
  },
};
