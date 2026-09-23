// @vitest-environment node
import { prisma } from '@/lib/db';
import { STAFF_NOTIFY_EMAIL } from '@/lib/mail';
import { guaranteedRecipients, recipientsFor } from '@/lib/notification-emails';

// The three one-line wrappers these tests used to call are gone: each send
// site now asks for its own page's list by name, so a wrapper per kind was a
// layer that only ever renamed things.
const notificationRecipients = async (hotelSlug: string | null) =>
  (await guaranteedRecipients('ENQUIRY', hotelSlug)).to;
import { afterEach, describe, expect, it } from 'vitest';

const TEST_ADDRESS = /@notify-test\.invalid$/;

afterEach(async () => {
  await prisma.notificationEmail.deleteMany({
    where: { address: { endsWith: '@notify-test.invalid' } },
  });
});

describe('notificationRecipients', () => {
  // An empty table has to behave exactly as the site did before this existed,
  // or turning the feature on silently redirects every enquiry.
  it('falls back to the content address when nothing is configured', async () => {
    const to = await notificationRecipients('gangtok');
    expect(to).toEqual(['gangtok@sinclairshotels.com']);
  });

  it('falls back to the central staff address with no property', async () => {
    expect(await notificationRecipients(null)).toEqual([STAFF_NOTIFY_EMAIL]);
  });

  it('sends to the property list and the central list together', async () => {
    await prisma.notificationEmail.createMany({
      data: [
        { hotelSlug: null, kind: 'ENQUIRY', address: 'central@notify-test.invalid' },
        { hotelSlug: 'gangtok', kind: 'ENQUIRY', address: 'gangtok@notify-test.invalid' },
      ],
    });

    const to = await notificationRecipients('gangtok');
    expect(new Set(to)).toEqual(
      new Set(['central@notify-test.invalid', 'gangtok@notify-test.invalid']),
    );
  });

  // A central address is an addition, not a replacement: a property with none
  // of its own must keep its content address rather than losing its mail to
  // whoever happens to be watching everything.
  it('keeps a property’s content address when only a central one is set', async () => {
    await prisma.notificationEmail.create({
      data: { hotelSlug: null, kind: 'ENQUIRY', address: 'central@notify-test.invalid' },
    });

    const to = await notificationRecipients('gangtok');
    expect(new Set(to)).toEqual(
      new Set(['central@notify-test.invalid', 'gangtok@sinclairshotels.com']),
    );
  });

  it('does not leak one property’s addresses into another’s', async () => {
    await prisma.notificationEmail.create({
      data: { hotelSlug: 'gangtok', kind: 'ENQUIRY', address: 'gangtok@notify-test.invalid' },
    });

    expect(await notificationRecipients('ooty')).toEqual(['ooty@sinclairshotels.com']);
  });

  // Each admin page has its own list now. Enquiries and bookings shared one
  // until they were split, which is why the migration copied every address
  // into both rather than picking one.
  it('does not send a booking address an enquiry, or the other way round', async () => {
    await prisma.notificationEmail.create({
      data: { hotelSlug: 'gangtok', kind: 'BOOKING', address: 'bookings@notify-test.invalid' },
    });

    expect(await notificationRecipients('gangtok')).toEqual(['gangtok@sinclairshotels.com']);
    expect((await recipientsFor('BOOKING', 'gangtok')).to).toEqual([
      'bookings@notify-test.invalid',
    ]);
  });
});

describe('recipientsFor', () => {
  it('keeps To, CC and BCC apart', async () => {
    await prisma.notificationEmail.createMany({
      data: [
        { hotelSlug: null, kind: 'PAYMENT', field: 'TO', address: 'to@notify-test.invalid' },
        { hotelSlug: null, kind: 'PAYMENT', field: 'CC', address: 'cc@notify-test.invalid' },
        { hotelSlug: null, kind: 'PAYMENT', field: 'BCC', address: 'bcc@notify-test.invalid' },
      ],
    });

    expect(await recipientsFor('PAYMENT')).toEqual({
      to: ['to@notify-test.invalid'],
      cc: ['cc@notify-test.invalid'],
      bcc: ['bcc@notify-test.invalid'],
    });
  });

  // No fallback by design on these two: an unset list means nobody asked for
  // the copy, and inventing a recipient for money news or somebody's CV is
  // worse than sending none.
  it('is empty rather than guessing for cancellations and careers', async () => {
    expect(await recipientsFor('CANCELLATION')).toEqual({ to: [], cc: [], bcc: [] });
    expect(await recipientsFor('CAREERS')).toEqual({ to: [], cc: [], bcc: [] });
  });
});
