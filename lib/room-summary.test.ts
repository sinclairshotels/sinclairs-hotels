import { describe, expect, it } from 'vitest';
import { roomSummary } from './room-summary';

describe('roomSummary', () => {
  it('takes the first sentence', () => {
    expect(
      roomSummary(
        'Cozy and quiet, the superior rooms overlook the pine forests. They come with a bed.',
      ),
    ).toBe('Cozy and quiet, the superior rooms overlook the pine forests.');
  });

  it('keeps a description that is already one short sentence whole', () => {
    expect(roomSummary('A twin bedroom with an ensuite bathroom.')).toBe(
      'A twin bedroom with an ensuite bathroom.',
    );
  });

  it('cuts a long first sentence at a word, not mid-word', () => {
    const summary = roomSummary(
      'The richly appointed premier rooms in dark wood finish are spacious and comfortable, blending well with the intimate atmosphere of the resort.',
    );
    expect(summary.endsWith('…')).toBe(true);
    expect(summary.length).toBeLessThanOrEqual(121);
    expect(summary).not.toMatch(/\s…$/);
  });

  // An abbreviation would otherwise end the sentence early. Rare in this copy,
  // but "sq. ft." used to be all over it.
  it('does not treat a description with no full stop as empty', () => {
    expect(roomSummary('A room with no full stop')).toBe('A room with no full stop');
  });
});
