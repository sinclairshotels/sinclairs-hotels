import { expect, test } from '@playwright/test';

// The money path, driven as a guest: both prices on the list, and a cancel that
// lands on the right status either side of the deadline. jsdom cannot reproduce
// this — the statuses are decided by a server action against a real database —
// so it lives here rather than in a component test.
import { prisma } from '../lib/db';
import { findRoom, loadNights } from '../test-utils/inventory';

const HOTEL = 'ooty';

function isoDay(offset: number): string {
  const t = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  return new Date(t.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
}
const asDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

test.describe('refundable rates', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    const room = await findRoom(HOTEL, 'Deluxe Room');
    await loadNights(
      room,
      HOTEL,
      Array.from({ length: 20 }, (_, i) => asDate(isoDay(i + 1))),
      { rate: 5400, roomsOnSale: 4 },
    );
    await prisma.hotelSettings.upsert({
      where: { hotelSlug: HOTEL },
      update: { breakfastSupplement: 450, refundableUpliftPct: 15, freeCancellationDays: 3 },
      create: {
        hotelSlug: HOTEL,
        breakfastSupplement: 450,
        refundableUpliftPct: 15,
        freeCancellationDays: 3,
      },
    });
  });

  test('room list shows both prices with the deadline date', async ({ page }) => {
    await page.goto(`/book/${HOTEL}?checkIn=${isoDay(10)}&checkOut=${isoDay(12)}&adults=2`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);

    await expect(page.getByText('Non-refundable').first()).toBeVisible();
    await expect(page.getByText('Refundable', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Free cancellation until/).first()).toBeVisible();
  });

  test('a refundable booking can be cancelled for a full refund', async ({ page }) => {
    const booking = await prisma.booking.create({
      data: {
        reference: `SNC-RF-${Date.now()}`,
        viewToken: `tok-refundable-${Date.now()}`,
        hotelSlug: HOTEL,
        roomName: 'Deluxe Room',
        planName: 'Room Only',
        rateType: 'REFUNDABLE',
        cancellationDeadline: asDate(isoDay(7)),
        checkIn: asDate(isoDay(10)),
        checkOut: asDate(isoDay(12)),
        rooms: 1,
        adults: 2,
        children: 0,
        guestName: 'Priya Sharma',
        guestEmail: 'priya@refund-e2e.invalid',
        guestPhone: '+91 98300 12345',
        billingAddress: 'Somewhere',
        roomTotal: 12420,
        taxTotal: 621,
        total: 13041,
        status: 'CONFIRMED',
      },
    });

    await page.goto(`/booking/${booking.viewToken}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(400);
    await expect(page.getByText(/Free cancellation until/).first()).toBeVisible();

    await page.getByRole('button', { name: 'Cancel this booking' }).click();
    await page.getByRole('button', { name: 'Yes, cancel it' }).click();
    await page.waitForTimeout(2500);

    const after = await prisma.booking.findUnique({ where: { id: booking.id } });
    expect(after?.status).toBe('REFUND_DUE');
    expect(after?.cancelledAt).not.toBeNull();
  });

  test('a non-refundable booking cancels with no refund', async ({ page }) => {
    const booking = await prisma.booking.create({
      data: {
        reference: `SNC-NR-${Date.now()}`,
        viewToken: `tok-nonref-${Date.now()}`,
        hotelSlug: HOTEL,
        roomName: 'Deluxe Room',
        rateType: 'NON_REFUNDABLE',
        checkIn: asDate(isoDay(10)),
        checkOut: asDate(isoDay(12)),
        rooms: 1,
        adults: 2,
        children: 0,
        guestName: 'Rohan Mehta',
        guestEmail: 'rohan@refund-e2e.invalid',
        guestPhone: '+91 98300 12345',
        billingAddress: 'Somewhere',
        roomTotal: 10800,
        taxTotal: 540,
        total: 11340,
        status: 'CONFIRMED',
      },
    });

    await page.goto(`/booking/${booking.viewToken}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Cancel this booking' }).click();
    await page.getByRole('button', { name: 'Yes, cancel it' }).click();
    await page.waitForTimeout(2500);

    const after = await prisma.booking.findUnique({ where: { id: booking.id } });
    // The money stays, so this is CANCELLED and never reaches Payments as a task.
    expect(after?.status).toBe('CANCELLED');
  });

  test.afterAll(async () => {
    await prisma.booking.deleteMany({ where: { guestEmail: { endsWith: 'refund-e2e.invalid' } } });
  });
});
