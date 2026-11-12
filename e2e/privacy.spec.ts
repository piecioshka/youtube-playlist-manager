import AxeBuilder from '@axe-core/playwright';
import { expect, horizontalScroll, test } from './fixtures';

test('opens the privacy policy from the footer without signing in', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Polityka prywatności' }).click();

  await expect(page).toHaveURL(/\/privacy\.html$/);
  await expect(
    page.getByRole('heading', { level: 2, name: 'Polityka prywatności' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Uprawnienia konta Google' }),
  ).toHaveAttribute('href', 'https://myaccount.google.com/permissions');
});

test('returns to the app from the logo on the privacy policy', async ({
  page,
}) => {
  await page.goto('/privacy.html');
  await page.getByRole('link', { name: 'YouTube Playlist Manager' }).click();

  await expect(
    page.getByRole('button', { name: 'Zaloguj przez Google' }),
  ).toBeVisible();
});

test('switches the privacy policy to English', async ({ page }) => {
  await page.goto('/privacy.html');
  await page.getByRole('button', { name: 'Zmień język na angielski' }).click();

  await expect(
    page.getByRole('heading', { level: 2, name: 'Privacy policy' }),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('keeps the shared 56 px header and applies the theme before React', async ({
  page,
}) => {
  await page.goto('/privacy.html');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  const header = await page.getByRole('banner').boundingBox();
  expect(header?.height).toBeCloseTo(56, 0);
  await expect(page.locator('.app__actions > *')).toHaveCount(3);
});

test('has no accessibility violations on the privacy policy', async ({
  page,
}) => {
  await page.goto('/privacy.html');
  await expect(page.getByRole('heading', { level: 2 })).toBeVisible();

  const dark = await new AxeBuilder({ page }).analyze();
  expect(dark.violations).toEqual([]);

  await page.getByRole('button', { name: 'Przełącz motyw' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const light = await new AxeBuilder({ page }).analyze();
  expect(light.violations).toEqual([]);
});

test('fits a phone screen on the privacy policy', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/privacy.html');
  await expect(page.getByRole('heading', { level: 2 })).toBeVisible();

  expect(await horizontalScroll(page)).toBe(0);
});
