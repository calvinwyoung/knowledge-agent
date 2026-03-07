import type { ToolDefinition } from '@mariozechner/pi-coding-agent';
import { type Static, Type } from '@sinclair/typebox';

import { formatTasks, parseTasks, readTasks, writeTasks } from './task-utils.js';

const taskUpdateParams = Type.Object({
  id: Type.Number({ description: 'The task ID to update' }),
  completed: Type.Optional(
    Type.Boolean({
      description: 'Mark the task complete or incomplete',
    }),
  ),
  description: Type.Optional(
    Type.String({ description: 'New description for the task' }),
  ),
});

type TaskUpdateParams = Static<typeof taskUpdateParams>;

/**
 * Update an existing task's completion status and/or description,
 * then return the full updated task list.
 */
export const taskUpdateTool: ToolDefinition = {
  name: 'task_update',
  label: 'Update Task',
  description:
    'Update a task in TASKS.md by ID (toggle completion and/or change description). Returns the full updated task list.',
  parameters: taskUpdateParams,
  async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
    const { id, completed, description } = params as TaskUpdateParams;
    const cwd = ctx?.cwd ?? process.cwd();

    const tasks = parseTasks(readTasks(cwd));
    const task = tasks.find((t) => t.id === id);
    if (!task) {
      return {
        content: [{ type: 'text', text: `Task ${id} not found.` }],
        details: {},
      };
    }

    if (completed !== undefined) {
      task.completed = completed;
    }
    if (description !== undefined) {
      task.description = description;
    }

    const content = formatTasks(tasks);
    writeTasks(cwd, `${content}\n`);

    return {
      content: [{ type: 'text', text: content }],
      details: {},
    };
  },
};
