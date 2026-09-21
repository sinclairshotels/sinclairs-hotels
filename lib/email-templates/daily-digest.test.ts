import { dailyDigestHtml } from '@/lib/email-templates/daily-digest';
import { describe, expect, it } from 'vitest';

const empty = {
  dateLabel: 'Monday, 21 Sep 2026',
  enquiries: [],
  newsletterEmails: [],
  payments: [],
  refundsDue: [],
  coverage: [],
};

const refund = {
  reference: 'SNC-260921-RLUCW',
  hotelName: 'Sinclairs Gangtok',
  amount: '10395.00',
  bookedOn: '22/09/2026',
};

const shortOfRates = { hotelName: 'Sinclairs Ooty', roomName: 'Nilgiri Suite', daysLeft: 0 };

// These two are the failures that cost money without anyone noticing: a guest
// charged for a room that had gone, and a calendar quietly running dry. Both
// were on the dashboard and only on the dashboard, which reaches whoever
// happens to open it.
describe('dailyDigestHtml', () => {
  it('names a booking owed a refund, with what it is worth', () => {
    const html = dailyDigestHtml({ ...empty, refundsDue: [refund] });
    expect(html).toContain('SNC-260921-RLUCW');
    expect(html).toContain('10395.00');
    expect(html).toContain('Sinclairs Gangtok');
  });

  it('says plainly that a refund needs a person', () => {
    const html = dailyDigestHtml({ ...empty, refundsDue: [refund] });
    expect(html).toMatch(/nothing moves money on its own/i);
  });

  it('names a room type that has run out of rates', () => {
    const html = dailyDigestHtml({ ...empty, coverage: [shortOfRates] });
    expect(html).toContain('Nilgiri Suite');
    expect(html).toContain('nothing loaded');
  });

  it('counts the days left when a room is loaded but running out', () => {
    const html = dailyDigestHtml({ ...empty, coverage: [{ ...shortOfRates, daysLeft: 1 }] });
    expect(html).toContain('1 day left');
    expect(html).not.toContain('1 days left');
  });

  it('leads with how much needs attention, so it is visible before scrolling', () => {
    const html = dailyDigestHtml({
      ...empty,
      refundsDue: [refund],
      coverage: [shortOfRates],
    });
    expect(html).toMatch(/2 things need attention/i);
  });

  it('says nothing is wrong rather than leaving the sections blank', () => {
    const html = dailyDigestHtml(empty);
    expect(html).toContain('None outstanding.');
    expect(html).toContain('Every room type is loaded past the warning window.');
    expect(html).not.toMatch(/needs? attention/i);
  });

  it('still reports the day that just passed', () => {
    const html = dailyDigestHtml({ ...empty, newsletterEmails: ['someone@example.invalid'] });
    expect(html).toContain('Monday, 21 Sep 2026');
    expect(html).toContain('someone@example.invalid');
  });
});
