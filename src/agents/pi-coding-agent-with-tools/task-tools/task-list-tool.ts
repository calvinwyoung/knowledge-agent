import type { ToolDefinition } from '@mariozechner/pi-coding-agent';
import { Type } from '@sinclair/typebox';

import { readTasks } from './task-utils.js';

const taskListParams = Type.Object({});

/**
 * Read and return the full contents of TASKS.md, or a placeholder
 * when no tasks exist yet.
 */
export const taskListTool: ToolDefinition = {
  name: 'task_list',
  label: 'List Tasks',
  description: 'List all tasks from TASKS.md. Returns "No tasks yet." if none exist.',
  parameters: taskListParams,
  async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
    const cwd = ctx?.cwd ?? process.cwd();
    const raw = readTasks(cwd);

    if (!raw.trim()) {
      return {
        content: [{ type: 'text', text: 'No tasks yet.' }],
        details: {},
      };
    }

    return {
      content: [{ type: 'text', text: raw.trim() }],
      details: {},
    };
  },
};
