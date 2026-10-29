import { describe, expect, it } from 'vitest';

import { formatBytes, formatDayLabel } from './format';

describe('formatBytes', () => {
  it('scales units', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(25 * 1024 * 1024)).toBe('25 MB');
  });
});

describe('formatDayLabel', () => {
  const now = new Date('2026-10-29T12:00:00');

  it('names today and yesterday', () => {
    expect(formatDayLabel('2026-10-29T01:00:00', now)).toBe('Today');
    expect(formatDayLabel('2026-10-28T23:00:00', now)).toBe('Yesterday');
  });

  it('shows the year only for other years', () => {
    expect(formatDayLabel('2026-03-01T10:00:00', now)).not.toMatch(/2026/);
    expect(formatDayLabel('2025-03-01T10:00:00', now)).toMatch(/2025/);
  });
});
