import { describe, expect, it } from 'vitest';
import {
  MAX_NIGHTS_PER_OVERRIDE,
  describeNights,
  expandRange,
  parseNightKeys,
} from './rate-nights';

describe('expandRange', () => {
  it('takes every night from the first to the last, inclusive', () => {
    expect(expandRange('2026-10-01', '2026-10-04')).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
  });

  it('is one night when both ends are the same day', () => {
    expect(expandRange('2026-10-01', '2026-10-01')).toEqual(['2026-10-01']);
  });

  it('treats a backwards range as the first night alone rather than guessing', () => {
    expect(expandRange('2026-10-04', '2026-10-01')).toEqual(['2026-10-04']);
  });

  it('crosses a month and a year end', () => {
    expect(expandRange('2026-12-30', '2027-01-02')).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
  });

  it('stops before an unbounded range', () => {
    expect(expandRange('2026-01-01', '2027-01-01').length).toBeLessThanOrEqual(
      MAX_NIGHTS_PER_OVERRIDE + 1,
    );
  });
});

describe('parseNightKeys', () => {
  it('sorts and de-duplicates, so a range and a picked date cannot collide', () => {
    expect(parseNightKeys('2026-10-03,2026-10-01,2026-10-03')).toEqual([
      '2026-10-01',
      '2026-10-03',
    ]);
  });

  it('drops anything that is not a date', () => {
    expect(parseNightKeys('2026-10-01,not-a-date,2026-02-30')).toEqual(['2026-10-01']);
    expect(parseNightKeys(undefined)).toEqual([]);
  });
});

describe('describeNights', () => {
  it('collapses consecutive nights into a run', () => {
    expect(describeNights(['2026-10-01', '2026-10-02', '2026-10-03'])).toBe(
      '1 Oct 2026 – 3 Oct 2026',
    );
  });

  it('keeps separate nights separate', () => {
    expect(describeNights(['2026-10-01', '2026-10-02', '2026-10-15'])).toBe(
      '1 Oct 2026 – 2 Oct 2026, 15 Oct 2026',
    );
  });

  it('says so when there is nothing', () => {
    expect(describeNights([])).toBe('no nights');
  });
});
