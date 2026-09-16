import { type Page, expect, test } from '@playwright/test';
import { prisma } from '../lib/db';
import { ensureE2EAdmin } from '../test-utils/auth';
import { clearNights } from '../test-utils/inventory';

// The admin tools only exist on the staff.* hostname (see proxy.ts).
const STAFF_BASE_URL = 'http://staff.localhost:3000';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const E2E_ADMIN_EMAIL = 'e2e-admin@sinclairshotels.test';

const HOTEL_LABEL = 'Sinclairs Gangtok';
const HOTEL_SLUG = 'gangtok';

function isoDay(offset: number): string {
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  return new Date(today.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
}

// Far enough out that the spec owns this window outright.
const FIRST = isoDay(320);
const LAST = isoDay(326);
const WINDOW = {
  gte: new Date(`${isoDay(310)}T00:00:00.000Z`),
  lt: new Date(`${isoDay(340)}T00:00:00.000Z`),
};

test.describe('rates loader (staff)', () => {
  // Serial: these share one date window and clear it in beforeEach, so running
  // them in parallel would have each wiping the others' rows mid-assertion.
  test.describe.configure({ mode: 'serial' });

  test.skip(!ADMIN_PASSWORD, 'ADMIN_PASSWORD not set in this environment');

  // One login for the whole file, on a page these tests share. The admin
  // sign-in is rate limited per IP, and a login per test was enough — with the
  // voucher spec logging in alongside — to trip it and fail the suite only
  // when run together.
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await ensureE2EAdmin(E2E_ADMIN_EMAIL, ADMIN_PASSWORD ?? '');

    await page.goto(`${STAFF_BASE_URL}/admin/login`);
    await page.locator('#email').fill(E2E_ADMIN_EMAIL);
    await page.locator('#password').fill(ADMIN_PASSWORD ?? '');
    await page.getByRole('button', { name: 'Sign In' }).click();
    // Must be the page login lands on, not /\/admin\// — that also matches
    // /admin/login, so the assertion would pass before the redirect ran and
    // the next navigation would race it.
    await expect(page).toHaveURL(/\/admin\/bookings$/);
  });

  test.beforeEach(async () => {
    await clearNights(HOTEL_SLUG, WINDOW);
    await prisma.auditEvent.deleteMany({
      where: { hotelSlug: HOTEL_SLUG, action: 'rates.updated' },
    });
  });

  test.afterAll(async () => {
    await clearNights(HOTEL_SLUG, WINDOW);
    await prisma.auditEvent.deleteMany({
      where: { hotelSlug: HOTEL_SLUG, action: 'rates.updated' },
    });
    await prisma.$disconnect();
    await page.close();
  });

  test('switching property keeps a valid room selected', async () => {
    await page.goto(`${STAFF_BASE_URL}/admin/rates`);
    const loader = page.locator('form').filter({ has: page.locator('#rate') });
    const triggers = loader.locator('[role="combobox"]');

    await triggers.nth(0).click();
    await page.locator('[role="listbox"]').getByRole('option', { name: HOTEL_LABEL }).click();

    // Regression: the room Select's items are replaced when the property
    // changes, which used to leave the posted room empty and make the loader
    // reject its own form. The value is a generated id, so what matters is
    // that it is populated and names a room of the property just chosen.
    await expect(loader.locator('input[name="roomTypeId"]')).not.toHaveValue('');
    await expect(loader.locator('input[name="ratePlanId"]')).not.toHaveValue('');
    await expect(triggers.nth(1)).toHaveText(/Deluxe Room/);
  });

  test('previews a load before writing it, then writes what it previewed', async () => {
    await page.goto(`${STAFF_BASE_URL}/admin/rates`);
    const loader = page.locator('form').filter({ has: page.locator('#rate') });

    await loader.locator('[role="combobox"]').nth(0).click();
    await page.locator('[role="listbox"]').getByRole('option', { name: HOTEL_LABEL }).click();

    await loader.locator('input[name="from"]').evaluate((el, value) => {
      (el as HTMLInputElement).value = value;
    }, FIRST);
    await loader.locator('input[name="to"]').evaluate((el, value) => {
      (el as HTMLInputElement).value = value;
    }, LAST);
    await page.locator('#rate').fill('7777');
    await page.locator('#totalRooms').fill('3');

    await page.getByRole('button', { name: /review changes/i }).click();

    // Nothing is written by the preview itself.
    await expect(page.getByText('Confirm this change')).toBeVisible();
    expect(
      await prisma.roomInventory.count({ where: { hotelSlug: HOTEL_SLUG, date: WINDOW } }),
    ).toBe(0);

    await page.getByRole('button', { name: /save 7 nights/i }).click();
    await expect(page.getByText(/7 nights updated/i)).toBeVisible();

    const rows = await prisma.roomInventory.findMany({
      where: { hotelSlug: HOTEL_SLUG, date: WINDOW },
    });
    expect(rows).toHaveLength(7);
    expect(rows.every((row) => row.roomsOnSale === 3)).toBe(true);

    // And the write is recorded.
    expect(
      await prisma.auditEvent.count({
        where: { hotelSlug: HOTEL_SLUG, action: 'rates.updated' },
      }),
    ).toBe(1);
  });

  test('applies a weekday-only load to just those nights', async () => {
    await page.goto(`${STAFF_BASE_URL}/admin/rates`);
    const loader = page.locator('form').filter({ has: page.locator('#rate') });

    await loader.locator('[role="combobox"]').nth(0).click();
    await page.locator('[role="listbox"]').getByRole('option', { name: HOTEL_LABEL }).click();

    await loader.locator('input[name="from"]').evaluate((el, value) => {
      (el as HTMLInputElement).value = value;
    }, FIRST);
    await loader.locator('input[name="to"]').evaluate((el, value) => {
      (el as HTMLInputElement).value = value;
    }, LAST);
    await page.locator('#rate').fill('9999');
    await page.locator('#totalRooms').fill('2');

    const saturday = 6;
    await loader.locator(`input[name="weekdays"][value="${saturday}"]`).check();
    await page.getByRole('button', { name: /review changes/i }).click();
    await expect(page.getByText('Confirm this change')).toBeVisible();
    await page.getByRole('button', { name: /save 1 night/i }).click();
    await expect(page.getByText(/1 night updated/i)).toBeVisible();

    const rows = await prisma.roomInventory.findMany({
      where: { hotelSlug: HOTEL_SLUG, date: WINDOW },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.date.getUTCDay()).toBe(saturday);
  });
});
