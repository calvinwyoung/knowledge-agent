import type { ToolDefinition } from '@mariozechner/pi-coding-agent';
import { type Static, Type } from '@sinclair/typebox';

import { formatTasks, parseTasks, readTasks, writeTasks } from './task-utils.js';

const taskAddParams = Type.Object({
  descriptions: Type.Array(Type.String(), {
    description: 'One or more task descriptions to add.',
    minItems: 1,
  }),
});

type TaskAddParams = Static<typeof taskAddParams>;

/**
 * Append one or more tasks to TASKS.md and return the full updated list.
 */
export const taskAddTool: ToolDefinition = {
  name: 'task_add',
  label: 'Add Tasks',
  description: 'Add one or more tasks to TASKS.md. Returns the full updated task list.',
  parameters: taskAddParams,
  async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
    const { descriptions } = params as TaskAddParams;
    const cwd = ctx?.cwd ?? process.cwd();

    const tasks = parseTasks(readTasks(cwd));
    let nextId = tasks.length > 0 ? tasks[tasks.length - 1].id + 1 : 1;

    for (const description of descriptions) {
      tasks.push({ id: nextId, completed: false, description });
      nextId += 1;
    }

    const content = formatTasks(tasks);
    writeTasks(cwd, `${content}\n`);

    return {
      content: [{ type: 'text', text: content }],
      details: {},
    };
  },
};
