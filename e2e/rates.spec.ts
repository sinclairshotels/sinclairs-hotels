import { type Page, expect, test } from '@playwright/test';
import { prisma } from '../lib/db';
import { e2eAdminSessionToken } from '../test-utils/auth';
import { clearNights, findRoom, loadNights } from '../test-utils/inventory';

// The admin tools only exist on the staff.* hostname (see proxy.ts).
const STAFF_BASE_URL = 'http://staff.localhost:3000';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const E2E_ADMIN_EMAIL = 'e2e-admin@sinclairshotels.test';

const HOTEL_SLUG = 'gangtok';
const HOTEL_LABEL = 'Sinclairs Gangtok';
const ROOM = 'Deluxe Room';

function isoDay(offset: number): string {
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  return new Date(today.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
}

const asDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const WINDOW = { gte: asDate(isoDay(0)), lt: asDate(isoDay(14)) };

test.describe('rates calendar (staff)', () => {
  // Serial: these share one property's visible window and rewrite it, and the
  // admin sign-in is rate limited per address.
  test.describe.configure({ mode: 'serial' });

  test.skip(!ADMIN_PASSWORD, 'ADMIN_PASSWORD not set in this environment');
  let room: Awaited<ReturnType<typeof findRoom>>;
  let sessionToken: string;

  test.beforeAll(async () => {
    sessionToken = await e2eAdminSessionToken(E2E_ADMIN_EMAIL, ADMIN_PASSWORD ?? '');
  });

  test.beforeEach(async ({ page, context }) => {
    // The session is injected rather than typed: the sign-in form has its own
    // spec, and driving it once per test here would trip the login limiter.
    await context.addCookies([
      { name: 'staff_session', value: sessionToken, domain: 'staff.localhost', path: '/' },
    ]);

    room = await findRoom(HOTEL_SLUG, ROOM);
    await prisma.booking.deleteMany({
      where: { hotelSlug: HOTEL_SLUG, guestEmail: { endsWith: 'e2e-rates.invalid' } },
    });
    await clearNights(HOTEL_SLUG, WINDOW);
    await loadNights(
      room,
      HOTEL_SLUG,
      Array.from({ length: 14 }, (_, i) => asDate(isoDay(i))),
      { rate: 5000, roomsOnSale: 4 },
    );
    await page.goto(`${STAFF_BASE_URL}/admin/rates?hotel=${HOTEL_SLUG}&days=14`);
  });

  test.afterAll(async () => {
    await prisma.booking.deleteMany({
      where: { hotelSlug: HOTEL_SLUG, guestEmail: { endsWith: 'e2e-rates.invalid' } },
    });
    await prisma.$disconnect();
  });

  const cell = (page: Page, date: string) =>
    page.getByRole('button', { name: new RegExp(`${ROOM}, Room Only, ${date}`) }).first();

  test('shows the selected property’s calendar', async ({ page }) => {
    await expect(page.getByRole('rowheader', { name: new RegExp(ROOM) }).first()).toBeVisible();
    await expect(cell(page, isoDay(0))).toContainText('₹5,000');
    await expect(cell(page, isoDay(0))).toContainText('4 on sale');
  });

  test('takes a block of nights on shift-click and edits them together', async ({ page }) => {
    await cell(page, isoDay(1)).click();
    await expect(page.getByText('1 night selected')).toBeVisible();

    await cell(page, isoDay(4)).click({ modifiers: ['Shift'] });
    await expect(page.getByText('4 nights selected')).toBeVisible();

    // Raise the rate ten percent across the block. The mode has to be chosen
    // first — the value input stays disabled while the field is set to
    // "leave unchanged", which is what stops an empty box writing a zero.
    await page
      .locator('form')
      .filter({ hasText: 'nights selected' })
      .locator('[role="combobox"]')
      .first()
      .click();
    await page.locator('[role="listbox"]').getByRole('option', { name: 'Increase by %' }).click();
    await page.getByLabel('Rate value').fill('10');

    await page.getByRole('button', { name: /review changes/i }).click();
    await expect(page.getByText(/4 nights actually change/)).toBeVisible();

    await page.getByRole('button', { name: /apply to 4 nights/i }).click();
    // The grid refreshes in place, so the new price appearing in the cell is
    // the visible proof the write landed.
    await expect(cell(page, isoDay(1))).toContainText('₹5,500');

    const prices = await prisma.ratePrice.findMany({
      where: {
        ratePlanId: room.ratePlanId,
        date: { gte: asDate(isoDay(1)), lt: asDate(isoDay(5)) },
      },
    });
    expect(prices).toHaveLength(4);
    expect(prices.every((row) => row.amount.toNumber() === 5500)).toBe(true);
  });

  test('refuses to cut the allotment below what is already sold', async ({ page }) => {
    await prisma.booking.create({
      data: {
        reference: `E2E-${Date.now()}`,
        viewToken: `e2e-${Date.now()}`,
        hotelSlug: HOTEL_SLUG,
        roomTypeId: room.roomTypeId,
        ratePlanId: room.ratePlanId,
        roomName: room.roomName,
        checkIn: asDate(isoDay(2)),
        checkOut: asDate(isoDay(3)),
        rooms: 3,
        adults: 2,
        guestName: 'E2E Guest',
        guestEmail: 'guest@e2e-rates.invalid',
        guestPhone: '+91 98300 00000',
        billingAddress: 'Somewhere',
        roomTotal: 1,
        taxTotal: 0,
        total: 1,
        status: 'CONFIRMED',
      },
    });
    await page.reload();

    await cell(page, isoDay(2)).click();
    await page
      .locator('form')
      .filter({ hasText: 'night selected' })
      .locator('[role="combobox"]')
      .nth(1)
      .click();
    await page.locator('[role="listbox"]').getByRole('option', { name: 'Set to' }).click();
    await page.getByLabel('Rooms on sale').fill('1');

    await page.getByRole('button', { name: /review changes/i }).click();

    await expect(page.getByText(/already sold beyond that allotment/i)).toBeVisible();
    const inventory = await prisma.roomInventory.findFirst({
      where: { roomTypeId: room.roomTypeId, date: asDate(isoDay(2)) },
    });
    expect(inventory?.roomsOnSale).toBe(4);
  });

  test('switches between the 14, 30 and 60 day views', async ({ page }) => {
    await page.locator('select[name="days"]').selectOption('30');
    await page.getByRole('button', { name: 'Show' }).click();

    await expect(page).toHaveURL(/days=30/);
    await expect(cell(page, isoDay(20))).toBeVisible();
  });

  test('offers the property picker and keeps the chosen one', async ({ page }) => {
    await page.locator('select[name="hotel"]').selectOption('ooty');
    await page.getByRole('button', { name: 'Show' }).click();

    await expect(page).toHaveURL(/hotel=ooty/);
    await expect(page.getByRole('option', { name: HOTEL_LABEL })).not.toBeChecked();
  });
});
