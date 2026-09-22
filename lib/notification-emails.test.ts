// @vitest-environment node
import { prisma } from '@/lib/db';
import { STAFF_NOTIFY_EMAIL } from '@/lib/mail';
import { notificationRecipients } from '@/lib/notification-emails';
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
        { hotelSlug: null, address: 'central@notify-test.invalid' },
        { hotelSlug: 'gangtok', address: 'gangtok@notify-test.invalid' },
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
      data: { hotelSlug: null, address: 'central@notify-test.invalid' },
    });

    const to = await notificationRecipients('gangtok');
    expect(new Set(to)).toEqual(
      new Set(['central@notify-test.invalid', 'gangtok@sinclairshotels.com']),
    );
  });

  it('does not leak one property’s addresses into another’s', async () => {
    await prisma.notificationEmail.create({
      data: { hotelSlug: 'gangtok', address: 'gangtok@notify-test.invalid' },
    });

    expect(await notificationRecipients('ooty')).toEqual(['ooty@sinclairshotels.com']);
  });
});
