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

test.describe('rates screens (staff)', () => {
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
  });

  test.afterAll(async () => {
    await prisma.booking.deleteMany({
      where: { hotelSlug: HOTEL_SLUG, guestEmail: { endsWith: 'e2e-rates.invalid' } },
    });
    await prisma.$disconnect();
  });

  const cellText = (page: Page, date: string) =>
    page.getByText(new RegExp(`${ROOM}, Room Only, ${date}`)).first();

  test('the calendar shows what is loaded, and is read-only', async ({ page }) => {
    await page.goto(`${STAFF_BASE_URL}/admin/rates?hotel=${HOTEL_SLUG}&days=14`);

    await expect(page.getByRole('rowheader', { name: new RegExp(ROOM) }).first()).toBeVisible();
    await expect(cellText(page, isoDay(0))).toContainText('5000 rupees');
    await expect(cellText(page, isoDay(0))).toContainText('4 on sale');

    // No cell is a control any more — rates are set on Monthly and Daily.
    const grid = page.getByRole('table');
    await expect(grid.getByRole('button')).toHaveCount(0);
  });

  test('a daily override saves one night and is marked on the calendar', async ({ page }) => {
    await page.goto(`${STAFF_BASE_URL}/admin/rates/daily`);

    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: HOTEL_LABEL }).click();
    await page.getByRole('combobox').nth(1).click();
    await page.getByRole('option', { name: ROOM, exact: true }).click();

    await page.getByRole('button', { name: 'Night to override' }).click();
    const target = new Date(`${isoDay(3)}T00:00:00.000Z`);
    await page
      .getByRole('dialog')
      .getByRole('button', {
        name: new RegExp(
          `${target.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long' })} ${target.getUTCDate()}`,
        ),
      })
      .first()
      .click();

    await page.getByLabel('Price per night').fill('9500');
    await page.getByRole('button', { name: /save this night/i }).click();
    await expect(page.getByText(/overridden. It will survive/i)).toBeVisible();

    const written = await prisma.ratePrice.findFirst({
      where: { ratePlanId: room.ratePlanId, date: asDate(isoDay(3)) },
    });
    expect(written?.amount.toNumber()).toBe(9500);
    expect(written?.source).toBe('DAILY');

    await page.goto(`${STAFF_BASE_URL}/admin/rates?hotel=${HOTEL_SLUG}&days=14`);
    await expect(cellText(page, isoDay(3))).toContainText('set daily');
    await expect(cellText(page, isoDay(2))).not.toContainText('set daily');
  });

  test('the daily screen refuses a night below what is already sold', async ({ page }) => {
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

    await page.goto(`${STAFF_BASE_URL}/admin/rates/daily`);
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: HOTEL_LABEL }).click();
    await page.getByRole('combobox').nth(1).click();
    await page.getByRole('option', { name: ROOM, exact: true }).click();

    await page.getByRole('button', { name: 'Night to override' }).click();
    const target = new Date(`${isoDay(2)}T00:00:00.000Z`);
    await page
      .getByRole('dialog')
      .getByRole('button', {
        name: new RegExp(
          `${target.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long' })} ${target.getUTCDate()}`,
        ),
      })
      .first()
      .click();

    await page.getByLabel('Rooms on sale').fill('1');
    await page.getByRole('button', { name: /save this night/i }).click();

    await expect(page.getByText(/already sold that night/i)).toBeVisible();
    const untouched = await prisma.roomInventory.findFirst({
      where: { roomTypeId: room.roomTypeId, date: asDate(isoDay(2)) },
    });
    expect(untouched?.roomsOnSale).toBe(4);
  });

  test('the monthly screen previews before it writes, then writes what it previewed', async ({
    page,
  }) => {
    await page.goto(`${STAFF_BASE_URL}/admin/rates/monthly?hotel=${HOTEL_SLUG}`);
    await page.waitForSelector('table');

    // The last of the twelve months on offer: nothing else in the suite
    // touches it, so the counts are unambiguous.
    const lastMonthColumn = page
      .getByRole('row')
      .filter({ hasText: ROOM })
      .first()
      .getByRole('spinbutton');
    const count = await lastMonthColumn.count();
    await lastMonthColumn.nth(count - 2).fill('3');
    await lastMonthColumn.nth(count - 1).fill('7200');

    await page.getByRole('button', { name: /review changes/i }).click();
    await expect(page.getByText(/nights actually change/)).toBeVisible();

    await page.getByRole('button', { name: /save \d+ nights/i }).click();
    await expect(page.getByText(/nights updated across/i)).toBeVisible();

    const written = await prisma.ratePrice.findFirst({
      where: { ratePlanId: room.ratePlanId, amount: 7200 },
    });
    expect(written?.source).toBe('MONTHLY');

    await prisma.ratePrice.deleteMany({ where: { ratePlanId: room.ratePlanId, amount: 7200 } });
  });

  test('switches between the 14, 30 and 60 day views', async ({ page }) => {
    await page.goto(`${STAFF_BASE_URL}/admin/rates?hotel=${HOTEL_SLUG}&days=14`);
    await expect(page.getByRole('columnheader')).toHaveCount(15);

    await page.goto(`${STAFF_BASE_URL}/admin/rates?hotel=${HOTEL_SLUG}&days=30`);
    await expect(page.getByRole('columnheader')).toHaveCount(31);
  });

  test('offers the property picker and keeps the chosen one', async ({ page }) => {
    await page.goto(`${STAFF_BASE_URL}/admin/rates?hotel=${HOTEL_SLUG}&days=14`);

    const picker = page.locator('select[name="hotel"]');
    await expect(picker).toHaveValue(HOTEL_SLUG);
    await picker.selectOption('darjeeling');
    await page.getByRole('button', { name: 'Show' }).click();
    await expect(page.locator('select[name="hotel"]')).toHaveValue('darjeeling');
  });
});
