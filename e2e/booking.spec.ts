import { expect, test } from '@playwright/test';
import { prisma } from '../lib/db';

// Far enough out that these rows cannot collide with anything real, and the
// whole window can be cleaned up by date.
const HOTEL = 'gangtok';
const ROOM = 'Deluxe Room';
const RATE = 6800;
const TOTAL_ROOMS = 4;

function isoDay(offset: number): string {
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  return new Date(today.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
}

const CHECK_IN = isoDay(200);
const CHECK_OUT = isoDay(202);
const WINDOW = {
  gte: new Date(`${isoDay(190)}T00:00:00.000Z`),
  lt: new Date(`${isoDay(220)}T00:00:00.000Z`),
};

const stayQuery = `checkIn=${CHECK_IN}&checkOut=${CHECK_OUT}&rooms=1&adults=2&children=0`;

// Serial: these share one seeded date window, and beforeAll/afterAll run once
// per worker — split across workers, one worker's afterAll deletes the rates
// another worker is still asserting against.
test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  for (let i = 0; i < 2; i++) {
    const date = new Date(`${isoDay(200 + i)}T00:00:00.000Z`);
    await prisma.roomRate.upsert({
      where: { hotelSlug_roomName_date: { hotelSlug: HOTEL, roomName: ROOM, date } },
      update: { rate: RATE, totalRooms: TOTAL_ROOMS, closed: false },
      create: {
        hotelSlug: HOTEL,
        roomName: ROOM,
        date,
        rate: RATE,
        totalRooms: TOTAL_ROOMS,
        closed: false,
      },
    });
  }
});

test.afterAll(async () => {
  await prisma.roomRate.deleteMany({ where: { hotelSlug: HOTEL, date: WINDOW } });
  await prisma.$disconnect();
});

test('the booking entry page offers every property', async ({ page }) => {
  await page.goto('/book');
  await expect(page.getByRole('heading', { level: 1, name: /reserve your stay/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /check availability/i })).toBeVisible();
});

test('a room with rates loaded is offered, priced, and leads to the guest form', async ({
  page,
}) => {
  await page.goto(`/book/${HOTEL}?${stayQuery}`);

  await expect(page.getByRole('heading', { level: 2, name: ROOM })).toBeVisible();
  // 2 nights at 6,800 plus 18% GST — the price the guest is shown must be the
  // one the server computes, not a rounded display of something else.
  await expect(page.getByText('₹16,048')).toBeVisible();

  await page.getByRole('link', { name: 'Select' }).first().click();

  await expect(page).toHaveURL(/\/book\/gangtok\/confirm\?/);
  await expect(
    page.getByRole('heading', { level: 1, name: /confirm your booking/i }),
  ).toBeVisible();
  await expect(page.getByText('Total payable')).toBeVisible();
  await expect(page.getByText('₹16,048')).toBeVisible();
  await expect(page.getByLabel('Full Name')).toBeVisible();
  await expect(page.getByRole('button', { name: /pay & confirm booking/i })).toBeVisible();
});

test('a property with no rates loaded says so rather than showing no availability', async ({
  page,
}) => {
  await page.goto(`/book/ooty?${stayQuery}`);
  await expect(page.getByText(/not yet bookable online/i)).toBeVisible();
});

test('a stay in the past is refused', async ({ page }) => {
  await page.goto(`/book/${HOTEL}?checkIn=${isoDay(-5)}&checkOut=${isoDay(-3)}`);
  await expect(page.getByText(/check-in cannot be in the past/i)).toBeVisible();
});

test('the guest form refuses an empty submission', async ({ page }) => {
  await page.goto(`/book/${HOTEL}/confirm?room=${encodeURIComponent(ROOM)}&${stayQuery}`);
  await page.getByRole('button', { name: /pay & confirm booking/i }).click();
  await expect(page.getByLabel('Full Name')).toHaveJSProperty('validity.valid', false);
});
