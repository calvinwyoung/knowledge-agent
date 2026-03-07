import type { ToolDefinition } from '@mariozechner/pi-coding-agent';
import { type Static, Type } from '@sinclair/typebox';
import { Exa } from 'exa-js';

const parameters = Type.Object({
  url: Type.String({ description: 'The URL to fetch content from' }),
  maxLength: Type.Optional(
    Type.Number({
      description: 'Maximum number of characters to return (default: 10000)',
    }),
  ),
});

type Params = Static<typeof parameters>;

/**
 * Strip HTML tags and collapse whitespace to extract readable text
 * from raw HTML. This is intentionally simple — no dependency
 * needed for a basic fallback.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fallback fetcher using Node's built-in fetch(). Used when Exa
 * returns no content for a URL.
 */
async function fetchWithNodeFetch(
  url: string,
  maxLength: number,
): Promise<{ title: string; text: string }> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; KnowledgeAgent/1.0)',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15_000),
  });

  const html = await response.text();

  // Try to extract a <title> tag.
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled';

  const text = stripHtml(html).slice(0, maxLength);

  return { title, text };
}

/**
 * Fetch the text content of a specific URL using Exa.ai, falling
 * back to a plain HTTP fetch when Exa returns empty content.
 */
export const webFetchTool: ToolDefinition = {
  name: 'web_fetch',
  label: 'Web Fetch',
  description:
    'Fetch the full text content of a specific URL. Use this ' +
    'when you already have a URL and need its contents.',
  parameters,
  async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
    const { url, maxLength = 10_000 } = params as Params;

    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) {
      throw new Error('EXA_API_KEY environment variable is not set');
    }

    const exa = new Exa(apiKey);
    const result = await exa.getContents([url], { text: true });
    const page = result.results[0];

    const exaText = page?.text?.trim() ?? '';

    // If the Exa result contains text, return it formatted with a title.
    if (exaText.length > 0) {
      const text = exaText.slice(0, maxLength);
      const title = page?.title ?? 'Untitled';
      return {
        content: [{ type: 'text', text: `# ${title}\n\n${text}` }],
        details: {},
      };
    }

    try {
      // Fall back to a direct HTTP fetch when Exa returns nothing.
      const { title, text } = await fetchWithNodeFetch(url, maxLength);
      return {
        content: [{ type: 'text', text: `# ${title}\n\n${text}` }],
        details: {},
      };
    } catch {
      return {
        content: [{ type: 'text', text: 'No content returned.' }],
        details: {},
      };
    }
  },
};
