import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Task {
  id: number;
  completed: boolean;
  description: string;
}

export const TASKS_FILE = 'TASKS.md';

/**
 * Read the raw contents of TASKS.md from the given directory,
 * returning an empty string if the file does not exist.
 */
export function readTasks(cwd: string): string {
  try {
    return readFileSync(join(cwd, TASKS_FILE), 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Write content to TASKS.md in the given directory.
 */
export function writeTasks(cwd: string, content: string): void {
  writeFileSync(join(cwd, TASKS_FILE), content, 'utf-8');
}

/**
 * Parse numbered checklist lines into structured task objects.
 */
export function parseTasks(content: string): Task[] {
  const tasks: Task[] = [];
  for (const line of content.split('\n')) {
    const match = line.match(/^(\d+)\.\s+\[([ x])\]\s+(.+)$/);
    if (match) {
      tasks.push({
        id: Number(match[1]),
        completed: match[2] === 'x',
        description: match[3],
      });
    }
  }
  return tasks;
}

/**
 * Serialize an array of tasks back into the numbered checklist
 * format.
 */
export function formatTasks(tasks: Task[]): string {
  return tasks
    .map((t) => `${t.id}. [${t.completed ? 'x' : ' '}] ${t.description}`)
    .join('\n');
}
