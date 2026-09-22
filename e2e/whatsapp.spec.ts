import { contactNumbers, whatsappMessage } from '@/content/site';
import { expect, test } from '@playwright/test';

// The floating button is the site's only always-visible contact point, and the
// number in it is the one CLAUDE.md allows on the site at all. It used to be
// hard-coded in the component as well as in content/site.ts, which is two
// places to change one number.
//
// Both hosts the public site answers on. Neither starts with `staff.`, so
// proxy.ts serves the public layout to both — which is exactly the claim worth
// testing, because the href must not depend on where the page was served from.
const PUBLIC_HOSTS = ['http://localhost:3000', 'http://127.0.0.1:3000'];
const STAFF_HOST = 'http://staff.localhost:3000';

const expected = `https://wa.me/${contactNumbers.whatsappNumber}?text=${encodeURIComponent(
  whatsappMessage,
)}`;

for (const host of PUBLIC_HOSTS) {
  test(`WhatsApp button opens wa.me with the number and message on ${host}`, async ({ page }) => {
    await page.goto(`${host}/`);

    const button = page.getByTestId('whatsapp-button');
    await expect(button).toBeVisible();

    const href = await button.getAttribute('href');
    expect(href).toBe(expected);

    // Spelled out rather than only compared to the constant, so a change to
    // either the number or the message has to be made here deliberately.
    const url = new URL(href as string);
    expect(url.host).toBe('wa.me');
    expect(url.pathname).toBe('/919257108784');
    expect(url.searchParams.get('text')).toBe(whatsappMessage);
    expect(url.searchParams.get('text')).not.toBe('');
  });
}

test('the same button appears on a hotel page, not only the home page', async ({ page }) => {
  await page.goto(`${PUBLIC_HOSTS[0]}/hotels/gangtok`);

  await expect(page.getByTestId('whatsapp-button')).toHaveAttribute('href', expected);
});

test('the staff host never serves it', async ({ page }) => {
  // staff.* is admin-only and redirects everything else to the dashboard, so
  // the public layout — and this button with it — must never appear there.
  await page.goto(`${STAFF_HOST}/`);

  await expect(page.getByTestId('whatsapp-button')).toHaveCount(0);
});
