import { buildSystemPrompt, createPiCodingAgent } from '../pi-coding-agent/index.js';
import type { Agent } from '../types.js';
import { taskAddTool, taskListTool, taskUpdateTool } from './task-tools/index.js';
import { webFetchTool } from './web-fetch-tool.js';
import { webSearchTool } from './web-search-tool.js';

const ADDITIONAL_TOOLS = `## Web Tools

- \`web_search\`: Search the web for questions that need real-time or up-to-date
  information (current events, recent data, live URLs, etc.). Returns titles, URLs, and
  text snippets.
- \`web_fetch\`: Fetch the full text content of a specific URL. Use this when you already
  have a URL and need its contents (e.g. a link from search results or one the user
  provided).

## Task Management

You have task management tools to help you stay organized on multi-step problems.
**ALWAYS** start by calling \`task_add\` to outline a plan of numbered tasks before doing
any real work, and then use the other task management tools to track your progress.

- \`task_add\`: Add new tasks to the task list.
- \`task_update\`: Mark a task complete or update its description. This also
  returns the full task list, which you should review prior to deciding what to work on
  next.
- \`task_list\`: Return all tasks from the task list.`;

/**
 * Extend the base pi-coding-agent with better tools:
 * - Web search for questions that need real-time information.
 * - Web fetch for reading the contents of a specific URL.
 * - Task list tools for tracking progress on multi-step problems.
 */
export function createPiCodingAgentWithTools(): Agent {
  return createPiCodingAgent({
    name: 'pi-coding-agent-with-tools',
    customTools: [webSearchTool, webFetchTool, taskAddTool, taskListTool, taskUpdateTool],
    systemPrompt: buildSystemPrompt({ additionalTools: ADDITIONAL_TOOLS }),
  });
}
