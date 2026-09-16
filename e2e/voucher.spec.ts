import { expect, test } from '@playwright/test';
import { prisma } from '../lib/db';
import { ensureE2EAdmin } from '../test-utils/auth';

// The admin/voucher tool only exists on the staff.* hostname (see proxy.ts) —
// ".localhost" resolves to loopback in every major browser regardless of the
// OS resolver, so this reaches the same local server as the public-host tests.
const STAFF_BASE_URL = 'http://staff.localhost:3000';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const E2E_ADMIN_EMAIL = 'e2e-admin@sinclairshotels.test';

test.describe('voucher issuance (staff)', () => {
  test.skip(!ADMIN_PASSWORD, 'ADMIN_PASSWORD not set in this environment');

  test('staff can log in, issue a voucher, and the guest can view it', async ({ page }) => {
    await ensureE2EAdmin(E2E_ADMIN_EMAIL, ADMIN_PASSWORD ?? '');

    await page.goto(`${STAFF_BASE_URL}/admin/login`);
    await page.locator('#email').fill(E2E_ADMIN_EMAIL);
    await page.locator('#password').fill(ADMIN_PASSWORD ?? '');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/admin\/bookings$/);

    // Sign-in now lands on Bookings rather than Vouchers.
    await page.goto(`${STAFF_BASE_URL}/admin/vouchers`);
    await page.getByRole('link', { name: 'New Voucher' }).click();
    await expect(page).toHaveURL(/\/admin\/vouchers\/new$/);

    await page.locator('#hotelSlug').click();
    await page.getByRole('option', { name: 'Sinclairs Burdwan' }).click();

    await page.locator('#bookingOffice').click();
    await page.getByRole('option', { name: 'Sinclairs Hotels — Head Office' }).click();

    // Check-in, then check-out — both date pickers show "Select date" until
    // set, so the first match is always whichever one hasn't been filled yet.
    await page.getByText('Select date').first().click();
    await page.getByText('20', { exact: true }).click();
    await page.getByText('Select date').first().click();
    await page.getByText('22', { exact: true }).click();

    await page.locator('#rooms').fill('1');
    await page.locator('#rate').fill('5000');
    await page.locator('#taxes').fill('600');

    const guestEmail = `e2e-${Date.now()}@example.invalid`;
    await page.locator('#guestName').fill('Playwright Test Guest');
    await page.locator('#guestPhone').fill('+91 9000000000');
    await page.locator('#guestEmail').fill(guestEmail);
    await page.locator('#billingAddress').fill('Test Address, Kolkata');

    await page.locator('#issuerName').fill('E2E Runner');
    await page.locator('#issuerPhone').fill('+91 9111111111');

    await page.getByRole('button', { name: /create & send voucher/i }).click();
    await expect(page.getByText('Voucher Sent')).toBeVisible();

    const message = await page.getByText(/Voucher #\d+ created/).textContent();
    const voucherNo = Number(message?.match(/#(\d+)/)?.[1]);
    expect(voucherNo).toBeGreaterThan(0);

    try {
      const voucher = await prisma.voucher.findUnique({ where: { voucherNo } });
      expect(voucher?.guestName).toBe('Playwright Test Guest');
      expect(voucher?.hotelSlug).toBe('burdwan');
      expect(voucher?.viewToken).toBeTruthy();

      await page.goto(`http://localhost:3000/v/${voucher?.viewToken}`);
      await expect(page.getByText(`Voucher #${voucherNo}`)).toBeVisible();
      await expect(page.getByText('Playwright Test Guest')).toBeVisible();
      await expect(page.getByRole('cell', { name: 'Sinclairs Burdwan' })).toBeVisible();
    } finally {
      await prisma.voucher.deleteMany({ where: { voucherNo } });
    }
  });
});
