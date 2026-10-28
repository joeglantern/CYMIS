import { describe, expect, it } from 'vitest';
import { olderThan } from './version';

describe('olderThan', () => {
  it('compares by number, not by text', () => {
    expect(olderThan('1.2.9', '1.2.10')).toBe(true);
    expect(olderThan('1.10.0', '1.9.0')).toBe(false);
  });

  it('treats equal versions as current', () => {
    expect(olderThan('0.1.0', '0.1.0')).toBe(false);
  });

  it('lets anything through when the server sets no minimum', () => {
    expect(olderThan('0.1.0', '0.0.0')).toBe(false);
  });

  it('copes with short or odd versions', () => {
    expect(olderThan('1', '1.0.1')).toBe(true);
    expect(olderThan('1.0.0-beta', '1.0.0')).toBe(false);
  });
});
