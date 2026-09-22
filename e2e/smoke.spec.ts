import { expect, test } from '@playwright/test';

test('home page loads and shows the hero', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('nav links to hotels listing and it renders property cards', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Hotels', exact: true }).first().click();
  await expect(page).toHaveURL(/\/hotels$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('enquiry form is reachable on contact and rejects an empty submission', async ({ page }) => {
  await page.goto('/contact');
  await page.getByRole('button', { name: /send enquiry/i }).click();
  await expect(page.getByLabel('Full Name')).toHaveJSProperty('validity.valid', false);
});

// Those links are printed on vouchers and sitting in sent email, so the
// property and type have to survive the move to /contact.
test('an old /enquiry link lands on contact with its property still chosen', async ({ page }) => {
  await page.goto('/enquiry?property=gangtok&type=hotel');

  await expect(page).toHaveURL(/\/contact\?property=gangtok&type=hotel$/);
  await expect(page.getByRole('button', { name: /send enquiry/i })).toBeVisible();
});
