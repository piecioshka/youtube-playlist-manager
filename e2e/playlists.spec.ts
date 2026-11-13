import AxeBuilder from '@axe-core/playwright';
import {
  expect,
  horizontalScroll,
  LONG_TITLE,
  playlistRows,
  playlistTitles,
  unmarkedYouTubeLinks,
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

  // Liczby kanału to cztery równe kafle w siatce dwa na dwa
  const tiles = await page.locator('.account__stat').evaluateAll((stats) =>
    stats.map((stat) => {
      const rect = stat.getBoundingClientRect();
      return {
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
      };
    }),
  );
  expect(tiles).toHaveLength(4);
  expect(tiles[0]?.top).toBe(tiles[1]?.top);
  expect(tiles[2]?.top).toBe(tiles[3]?.top);
  expect(tiles[2]?.top).toBeGreaterThan(tiles[0]?.top ?? 0);
  expect(tiles[0]?.left).toBe(tiles[2]?.left);
  expect(new Set(tiles.map((tile) => tile.width)).size).toBe(1);

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

test('marks every link to YouTube with an icon and a dotted underline', async ({
  page,
}) => {
  await signIn(page);
  // Wyszukiwanie dokłada linki do pasujących filmów
  await page
    .getByRole('searchbox', { name: 'Szukaj playlist i filmów' })
    .fill('quicksort');
  await expect(page.locator('.playlist-videos__link').first()).toBeVisible();

  expect(await unmarkedYouTubeLinks(page)).toEqual([]);
  expect(await page.locator('a[href*="youtube.com"]').count()).toBeGreaterThan(
    2,
  );
  // Link poza YouTube zostaje zwykłym linkiem
  await expect(
    page
      .getByRole('link', { name: /Licencja MIT|MIT License/ })
      .locator('.external-link__icon'),
  ).toHaveCount(0);
});

test('has no accessibility violations on the playlist screen', async ({
  page,
}) => {
  await signIn(page);

  const dark = await new AxeBuilder({ page }).analyze();
  expect(dark.violations).toEqual([]);

  // Kolory statusów widoczności muszą mieć kontrast także w jasnym motywie
  await page.getByRole('button', { name: 'Przełącz motyw' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const light = await new AxeBuilder({ page }).analyze();
  expect(light.violations).toEqual([]);
});

test('follows the system theme and remembers a chosen one after reload', async ({
  page,
}) => {
  await signIn(page);
  const html = page.locator('html');
  const toggle = page.getByRole('button', { name: 'Przełącz motyw' });
  const chrome = page.locator('meta[name="theme-color"]');
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(chrome).toHaveAttribute('content', '#121214');

  // Zmiana w systemie dochodzi bez przeładowania
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(html).toHaveAttribute('data-theme', 'light');
  await expect(chrome).toHaveAttribute('content', '#f7f7f8');

  await toggle.click();
  await expect(html).toHaveAttribute('data-theme', 'dark');

  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(chrome).toHaveAttribute('content', '#121214');
});

test('has no accessibility violations in the light theme', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Przełącz motyw' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('switches the interface to English and remembers it after reload', async ({
  page,
}) => {
  await signIn(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');

  await page.getByRole('button', { name: 'Zmień język na angielski' }).click();

  const heading = page.getByRole('heading', { level: 2 });
  await expect(heading).toHaveText('Your playlists (4)');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();

  await page.reload();
  await expect(heading).toHaveText('Your playlists (4)');
  await expect(
    page.getByRole('button', { name: 'Switch the language to Polish' }),
  ).toHaveText('🇬🇧');
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
  await expect(account).toContainText('Kanał od 2012-03-04');

  await expect(
    page.getByRole('link', { name: SEED_CHANNEL.title }),
  ).toHaveAttribute(
    'href',
    `https://www.youtube.com/channel/${SEED_CHANNEL.id}`,
  );

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('ships a content security policy that covers the inline theme script', async ({
  page,
}) => {
  await page.goto('/');
  const policy = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');

  expect(policy).toContain("default-src 'self'");
  expect(policy).toMatch(/script-src 'self' 'sha256-[A-Za-z0-9+/=]+' /);
  expect(policy).not.toContain('unsafe');
  // Skrypt motywu przeszedł przez politykę: atrybut jest ustawiony przed startem Reacta
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

for (const width of [400, 1440]) {
  test(`keeps one 56 px header row on the list and the profile at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await signIn(page);

    for (const open of [
      async () => undefined,
      () => page.getByRole('link', { name: 'Algorytmy', exact: true }).click(),
    ]) {
      await open();
      const header = await page.getByRole('banner').boundingBox();
      expect(header?.height).toBeCloseTo(56, 0);

      const controls = page.locator('.app__actions > *');
      const boxes = await controls.evaluateAll((elements) =>
        elements.map((element) => element.getBoundingClientRect()),
      );
      expect(boxes.length).toBe(5);
      const [first] = boxes;
      for (const box of boxes) {
        expect(box.height).toBeCloseTo(36, 0);
        expect(box.top).toBeCloseTo(first?.top ?? 0, 0);
      }
      expect(await horizontalScroll(page)).toBe(0);
    }
  });
}
