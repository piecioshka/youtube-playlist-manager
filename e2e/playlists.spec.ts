import AxeBuilder from '@axe-core/playwright';
import {
  expect,
  horizontalScroll,
  LONG_TITLE,
  playlistRows,
  playlistTitles,
  SEED_CHANNEL,
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

test('filters playlists by visibility', async ({ page }) => {
  await signIn(page);

  await page.getByRole('button', { name: /^Prywatne/ }).click();

  expect(await playlistTitles(page)).toEqual(['Ćwiczenia']);
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(
    'Twoje playlisty (1 z 4)',
  );
});

test('finds a video inside a playlist with the keyboard shortcut', async ({
  page,
}) => {
  await signIn(page);
  const searchBox = page.getByRole('searchbox', {
    name: 'Szukaj playlist i filmów',
  });

  await page.keyboard.press('ControlOrMeta+K');
  await expect(searchBox).toBeFocused();
  await searchBox.fill('quicksort');

  const link = page.getByRole('link', { name: 'Quicksort in 4 minutes' });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', /list=PL-algo/);
  expect(await playlistTitles(page)).toEqual(['Algorytmy']);
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(
    'Twoje playlisty (1 z 4)',
  );
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
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
    status: { privacyStatus: 'unlisted' },
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

  await expect(
    page.getByRole('status').filter({ hasText: 'Usunięto' }),
  ).toHaveText('Usunięto playlistę „Muzyka do pracy”.');
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

  expect(await horizontalScroll(page)).toBe(0);
});

test('sorts with a select on a phone, where the table has no headers', async ({
  page,
}) => {
  await signIn(page);
  const select = page.getByRole('combobox', { name: 'Sortowanie' });
  // Na szerokim ekranie sortują nagłówki tabeli
  await expect(select).toBeHidden();

  await page.setViewportSize({ width: 375, height: 800 });
  await expect(select).toBeVisible();
  await expect(select).toHaveValue('publishedAt-desc');
  await select.selectOption('Tytuł: A-Z');

  const titles = await playlistTitles(page);
  expect(titles).toEqual(
    [...titles].sort((a, b) =>
      a.localeCompare(b, 'pl', { sensitivity: 'base' }),
    ),
  );
  expect(titles[0]).toBe('Algorytmy');
  expect(await horizontalScroll(page)).toBe(0);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('keeps the footer on one line on a wide screen', async ({ page }) => {
  await page.goto('/');
  const footer = page.getByRole('contentinfo');
  await expect(footer).toContainText('Licencja MIT');

  // Druga linia tekstu zaczynałaby się o całą wysokość wiersza niżej niż pierwsza
  const spread = await footer.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const tops = [...range.getClientRects()].map((rect) => rect.top);
    return Math.max(...tops) - Math.min(...tops);
  });
  expect(spread).toBeLessThan(8);
});

test('lays the list out for a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await signIn(page);
  await expect(page.getByRole('table')).toBeVisible();

  // Kontrolki nagłówka stoją w jednym rzędzie przy prawej krawędzi
  const header = await page.getByRole('banner').boundingBox();
  const actions = await page.locator('.app__actions').boundingBox();
  if (header === null || actions === null) {
    throw new Error('The header has no box');
  }
  expect(Math.round(actions.x + actions.width)).toBe(
    Math.round(header.x + header.width),
  );

  // Statystyki kanału w równej siatce: trzy w pierwszym rzędzie
  const statTops = await page
    .locator('.account__stat')
    .evaluateAll((stats) =>
      stats.map((stat) => Math.round(stat.getBoundingClientRect().top)),
    );
  expect(statTops).toHaveLength(5);
  expect(new Set(statTops.slice(0, 3)).size).toBe(1);
  expect(new Set(statTops.slice(3)).size).toBe(1);
  expect(statTops[3]).toBeGreaterThan(statTops[0] ?? 0);

  // Filtr widoczności to jeden przewijany rząd, a nie dwa
  const filterTops = await page
    .getByRole('group', { name: 'Filtruj po widoczności' })
    .getByRole('button')
    .evaluateAll((buttons) =>
      buttons.map((button) => Math.round(button.getBoundingClientRect().top)),
    );
  expect(filterTops).toHaveLength(4);
  expect(new Set(filterTops).size).toBe(1);

  expect(await horizontalScroll(page)).toBe(0);
});

test('has no accessibility violations on the playlist screen', async ({
  page,
}) => {
  await signIn(page);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('starts dark and remembers the light theme after reload', async ({
  page,
}) => {
  await signIn(page);
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'dark');

  const toggle = page.getByRole('button', { name: 'Ciemny motyw' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');

  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
});

test('has no accessibility violations in the light theme', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Ciemny motyw' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('switches the interface to English and remembers it after reload', async ({
  page,
}) => {
  await signIn(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');

  await page.getByRole('combobox', { name: 'Język' }).selectOption('English');

  const heading = page.getByRole('heading', { level: 2 });
  await expect(heading).toHaveText('Your playlists (4)');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();

  await page.reload();
  await expect(heading).toHaveText('Your playlists (4)');
  await expect(page.getByRole('combobox', { name: 'Language' })).toHaveValue(
    'en',
  );
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('shows the channel details after sign-in', async ({ page }) => {
  await signIn(page);

  const account = page.getByRole('region', { name: 'Twój kanał' });
  await expect(account).toContainText(SEED_CHANNEL.title);
  await expect(account).toContainText(SEED_CHANNEL.handle);
  const stat = (label: string) =>
    account.locator('.account__stat', { hasText: label }).locator('dd');
  await expect(stat('Subskrypcje')).toHaveText(/^1\s234$/);
  await expect(stat('Filmy')).toHaveText('56');
  await expect(stat('Wyświetlenia')).toHaveText(/^7\s890\s123$/);
  await expect(stat('Playlisty')).toHaveText('4');
  await expect(stat('Kanał od')).toHaveText('2012-03-04');

  await expect(
    page.getByRole('link', { name: SEED_CHANNEL.title }),
  ).toHaveAttribute(
    'href',
    `https://www.youtube.com/channel/${SEED_CHANNEL.id}`,
  );

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
