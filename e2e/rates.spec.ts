import { type Page, expect, test } from '@playwright/test';
import { prisma } from '../lib/db';

// The admin tools only exist on the staff.* hostname (see proxy.ts).
const STAFF_BASE_URL = 'http://staff.localhost:3000';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

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
    await page.goto(`${STAFF_BASE_URL}/admin/login`);
    await page.locator('#password').fill(ADMIN_PASSWORD ?? '');
    await page.getByRole('button', { name: 'Sign In' }).click();
    // Must be the page login lands on, not /\/admin\// — that also matches
    // /admin/login, so the assertion would pass before the redirect ran and
    // the next navigation would race it.
    await expect(page).toHaveURL(/\/admin\/vouchers$/);
  });

  test.beforeEach(async () => {
    await prisma.roomRate.deleteMany({ where: { hotelSlug: HOTEL_SLUG, date: WINDOW } });
    await prisma.rateChange.deleteMany({ where: { hotelSlug: HOTEL_SLUG, firstNight: WINDOW } });
  });

  test.afterAll(async () => {
    await prisma.roomRate.deleteMany({ where: { hotelSlug: HOTEL_SLUG, date: WINDOW } });
    await prisma.rateChange.deleteMany({ where: { hotelSlug: HOTEL_SLUG, firstNight: WINDOW } });
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
    // changes, which used to leave the posted room name empty and make the
    // loader reject its own form.
    await expect(loader.locator('input[name="roomName"]')).toHaveValue('Deluxe Room');
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
    expect(await prisma.roomRate.count({ where: { hotelSlug: HOTEL_SLUG, date: WINDOW } })).toBe(0);

    await page.getByRole('button', { name: /save 7 nights/i }).click();
    await expect(page.getByText(/7 nights updated/i)).toBeVisible();

    const rows = await prisma.roomRate.findMany({ where: { hotelSlug: HOTEL_SLUG, date: WINDOW } });
    expect(rows).toHaveLength(7);
    expect(rows.every((row) => row.rate.toNumber() === 7777 && row.totalRooms === 3)).toBe(true);

    // And the write is recorded.
    expect(
      await prisma.rateChange.count({ where: { hotelSlug: HOTEL_SLUG, firstNight: WINDOW } }),
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

    const rows = await prisma.roomRate.findMany({ where: { hotelSlug: HOTEL_SLUG, date: WINDOW } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.date.getUTCDay()).toBe(saturday);
  });
});
