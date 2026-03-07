import { beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

import { buildSessionId, createObservationRecorder } from './trace-agent.js';

const mockEnd = vi.fn();

vi.mock('@langfuse/tracing', () => ({
  startObservation: vi.fn(() => ({ end: mockEnd })),
  startActiveObservation: vi.fn(),
}));

// Re-import after mock so we can inspect calls.
const { startObservation } = await import('@langfuse/tracing');

describe('createObservationRecorder', () => {
  let dateNowSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    dateNowSpy = vi.spyOn(Date, 'now');
  });

  it('assigns monotonically increasing start times when calls share the same millisecond', () => {
    dateNowSpy.mockReturnValue(1000);

    const recordObservation = createObservationRecorder();
    recordObservation('tool-a', { input: 'a' });
    recordObservation('tool-b', { input: 'b' });
    recordObservation('tool-c', { input: 'c' });

    const calls = vi.mocked(startObservation).mock.calls;
    const startTimes = calls.map((c) =>
      (c[2] as { startTime: Date }).startTime.getTime(),
    );

    expect(startTimes).toEqual([1000, 1001, 1002]);
  });

  it('uses wall-clock time when it has advanced past the last timestamp', () => {
    const recordObservation = createObservationRecorder();

    dateNowSpy.mockReturnValue(1000);
    recordObservation('first', {});

    // Wall clock jumps forward past the last recorded timestamp.
    dateNowSpy.mockReturnValue(5000);
    recordObservation('second', {});

    const calls = vi.mocked(startObservation).mock.calls;
    const startTimes = calls.map((c) =>
      (c[2] as { startTime: Date }).startTime.getTime(),
    );

    expect(startTimes).toEqual([1000, 5000]);
  });

  it('sets end time to 1 ms after start time', () => {
    dateNowSpy.mockReturnValue(1000);

    const recordObservation = createObservationRecorder();
    recordObservation('tool', {});

    const endTime: Date = mockEnd.mock.calls[0][0];
    expect(endTime.getTime()).toBe(1001);
  });

  it('passes name and attributes through to startObservation', () => {
    dateNowSpy.mockReturnValue(1000);

    const attrs = { input: { key: 'value' } };
    const recordObservation = createObservationRecorder();
    recordObservation('my-tool', attrs);

    expect(startObservation).toHaveBeenCalledWith('my-tool', attrs, {
      startTime: new Date(1000),
    });
  });
});

describe('buildSessionId', () => {
  it('formats as benchmark/agent/YYYY-MM-DD-HHMM', () => {
    // 2025-07-15 09:30 UTC → 2025-07-15 02:30 America/Los_Angeles (PDT, UTC-7).
    const date = new Date('2025-07-15T09:30:00Z');
    const id = buildSessionId('gaia', 'my-agent', date);
    expect(id).toBe('gaia/my-agent/2025-07-15-0230');
  });

  it('zero-pads single-digit months and days', () => {
    // 2025-01-05 16:05 UTC → 2025-01-05 08:05 America/Los_Angeles (PST, UTC-8).
    const date = new Date('2025-01-05T16:05:00Z');
    const id = buildSessionId('bench', 'agent', date);
    expect(id).toBe('bench/agent/2025-01-05-0805');
  });
});
