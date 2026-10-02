import AxeBuilder from '@axe-core/playwright';
import {
  expect,
  LONG_TITLE,
  playlistRows,
  playlistTitles,
  signIn,
  test,
} from './fixtures';

test('signs in and lists playlists newest first', async ({ page, youtube }) => {
  await signIn(page);

  await expect(page.getByRole('heading', { level: 2 })).toHaveText(
    'Twoje playlisty (4)',
  );
  expect(await playlistTitles(page)).toEqual([
    'Ćwiczenia',
    'Muzyka do pracy',
    'Algorytmy',
    LONG_TITLE,
  ]);
  expect(youtube.requests[0]?.url.searchParams.get('mine')).toBe('true');
});

test('sorts alphabetically and remembers the choice after reload', async ({
  page,
}) => {
  const alphabetical = [
    'Algorytmy',
    'Ćwiczenia',
    'Muzyka do pracy',
    LONG_TITLE,
  ];
  await signIn(page);

  const titleHeader = page.getByRole('columnheader', { name: /^Tytuł/ });
  await titleHeader.getByRole('button').click();
  await expect(titleHeader).toHaveAttribute('aria-sort', 'ascending');
  expect(await playlistTitles(page)).toEqual(alphabetical);

  // Sesja przeżywa odświeżenie, więc wystarczy przeładować stronę
  await page.reload();
  await expect(titleHeader).toHaveAttribute('aria-sort', 'ascending');
  expect(await playlistTitles(page)).toEqual(alphabetical);
});

test('renames a playlist and keeps its description', async ({
  page,
  youtube,
}) => {
  await signIn(page);
  // Po wejściu w edycję tytuł znika z tekstu wiersza, więc filtr po tekście przestałby go łapać
  const row = playlistRows(page).nth(2);

  await row.getByRole('button', { name: /^Zmień nazwę/ }).click();
  const input = row.getByRole('textbox', { name: 'Nowa nazwa playlisty' });
  await input.fill('Algorytmy i struktury danych');
  await input.press('Enter');

  await expect(
    page.getByRole('link', { name: 'Algorytmy i struktury danych' }),
  ).toBeVisible();
  const put = youtube.requests.find((request) => request.method === 'PUT');
  expect(put?.body).toEqual({
    id: 'PL-algo',
    snippet: {
      title: 'Algorytmy i struktury danych',
      description: 'Wykłady z algorytmiki',
    },
  });
});

test('deletes a playlist after confirmation', async ({ page, youtube }) => {
  await signIn(page);
  const row = playlistRows(page).filter({ hasText: 'Muzyka do pracy' });

  await row.getByRole('button', { name: /^Usuń playlistę/ }).click();
  await expect(
    row.getByRole('group', {
      name: 'Potwierdzenie usunięcia playlisty Muzyka do pracy',
    }),
  ).toBeVisible();
  await row.getByRole('button', { name: 'Usuń na stałe' }).click();

  await expect(page.getByRole('status')).toHaveText(
    'Usunięto playlistę „Muzyka do pracy”.',
  );
  expect(await playlistTitles(page)).toEqual([
    'Ćwiczenia',
    'Algorytmy',
    LONG_TITLE,
  ]);
  const deleteRequest = youtube.requests.find(
    (request) => request.method === 'DELETE',
  );
  expect(deleteRequest?.url.searchParams.get('id')).toBe('PL-music');
});

test('returns to the sign-in screen when the session expires', async ({
  page,
  youtube,
}) => {
  await signIn(page);
  youtube.failNextRequestWith(401);
  // Po wejściu w edycję tytuł znika z tekstu wiersza, więc filtr po tekście przestałby go łapać
  const row = playlistRows(page).first();

  await row.getByRole('button', { name: /^Zmień nazwę/ }).click();
  await row
    .getByRole('textbox', { name: 'Nowa nazwa playlisty' })
    .fill('Trening');
  await row.getByRole('button', { name: 'Zapisz' }).click();

  await expect(
    page.getByText('Sesja wygasła, zaloguj się ponownie.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Zaloguj przez Google' }),
  ).toBeEnabled();
});

test('fits a phone screen without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await signIn(page);

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test('has no accessibility violations on the playlist screen', async ({
  page,
}) => {
  await signIn(page);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
