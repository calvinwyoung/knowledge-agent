import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { formatTasks, parseTasks, readTasks, writeTasks } from './task-utils.js';

describe('parseTasks', () => {
  it('returns an empty array for an empty string', () => {
    expect(parseTasks('')).toEqual([]);
  });

  it('parses a single incomplete task', () => {
    expect(parseTasks('1. [ ] Buy milk')).toEqual([
      { id: 1, completed: false, description: 'Buy milk' },
    ]);
  });

  it('parses a single completed task', () => {
    expect(parseTasks('1. [x] Buy milk')).toEqual([
      { id: 1, completed: true, description: 'Buy milk' },
    ]);
  });

  it('parses multiple tasks', () => {
    const input = ['1. [ ] First task', '2. [x] Second task', '3. [ ] Third task'].join(
      '\n',
    );

    expect(parseTasks(input)).toEqual([
      { id: 1, completed: false, description: 'First task' },
      { id: 2, completed: true, description: 'Second task' },
      { id: 3, completed: false, description: 'Third task' },
    ]);
  });

  it('ignores malformed lines', () => {
    const input = [
      '1. [ ] Valid task',
      'not a task',
      '',
      '- [ ] wrong format',
      '2. [x] Another valid task',
    ].join('\n');

    expect(parseTasks(input)).toEqual([
      { id: 1, completed: false, description: 'Valid task' },
      { id: 2, completed: true, description: 'Another valid task' },
    ]);
  });
});

describe('formatTasks', () => {
  it('returns an empty string for an empty array', () => {
    expect(formatTasks([])).toBe('');
  });

  it('formats a single task', () => {
    expect(formatTasks([{ id: 1, completed: false, description: 'Buy milk' }])).toBe(
      '1. [ ] Buy milk',
    );
  });

  it('formats a mix of completed and incomplete tasks', () => {
    const tasks = [
      { id: 1, completed: true, description: 'Done thing' },
      { id: 2, completed: false, description: 'Pending thing' },
    ];
    expect(formatTasks(tasks)).toBe('1. [x] Done thing\n2. [ ] Pending thing');
  });
});

describe('readTasks / writeTasks', () => {
  it('returns an empty string when the file does not exist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'task-test-'));
    try {
      expect(readTasks(dir)).toBe('');
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('round-trips: write then read back', () => {
    const dir = mkdtempSync(join(tmpdir(), 'task-test-'));
    try {
      const content = '1. [ ] Hello\n2. [x] World\n';
      writeTasks(dir, content);
      expect(readTasks(dir)).toBe(content);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
