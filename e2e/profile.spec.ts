import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import {
  expect,
  horizontalScroll,
  MISSING_VIDEO_ID,
  playlistRows,
  signIn,
  test,
  unmarkedYouTubeLinks,
} from './fixtures';

function videoList(page: Page) {
  return page.getByRole('table', { name: /^Filmy/ });
}

function videoTitles(page: Page): Promise<string[]> {
  return videoList(page).getByRole('link').allTextContents();
}

async function openAlgorithms(page: Page): Promise<void> {
  await signIn(page);
  await page.getByRole('link', { name: 'Algorytmy', exact: true }).click();
  await expect(videoList(page)).toBeVisible();
}

const ALGO_VIDEOS = [
  'Quicksort in 4 minutes',
  'Big O notation for beginners',
  "Dijkstra's algorithm explained",
];

test('opens a playlist profile from the table', async ({ page }) => {
  await openAlgorithms(page);

  expect(new URL(page.url()).hash).toBe('#/playlists/PL-algo');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Algorytmy');
  await expect(page.getByText('3 filmy · Niepubliczna')).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Otwórz na YouTube' }),
  ).toHaveAttribute('href', 'https://www.youtube.com/playlist?list=PL-algo');
  expect(await videoTitles(page)).toEqual(ALGO_VIDEOS);
  // Przy filmie stoi data jego publikacji na YouTube, a nie data dodania do playlisty
  await expect(
    videoList(page).locator('tbody tr').first().locator('time'),
  ).toHaveText('2019-03-14');
});

test('moves a video down with the arrow key on its handle', async ({
  page,
  youtube,
}) => {
  await openAlgorithms(page);
  const handle = page.getByRole('button', {
    name: 'Przenieś „Quicksort in 4 minutes”',
  });

  await handle.focus();
  await page.keyboard.press('ArrowDown');

  await expect
    .poll(() => videoTitles(page))
    .toEqual([ALGO_VIDEOS[1], ALGO_VIDEOS[0], ALGO_VIDEOS[2]]);
  await expect(handle).toBeFocused();
  await expect(handle).not.toHaveAttribute('aria-disabled');
  const put = youtube.requests.find(
    (request) =>
      request.method === 'PUT' &&
      request.url.pathname.endsWith('playlistItems'),
  );
  expect(put?.body).toEqual({
    id: 'item-quicksort',
    snippet: {
      playlistId: 'PL-algo',
      resourceId: { kind: 'youtube#video', videoId: 'vid-quicksort' },
      position: 1,
    },
  });
  expect(youtube.videos['PL-algo']?.map((video) => video.title)).toEqual([
    ALGO_VIDEOS[1],
    ALGO_VIDEOS[0],
    ALGO_VIDEOS[2],
  ]);
});

// Cały wiersz docelowy musi być w oknie, bo mysz nie przewinie strony w trakcie przeciągania
test.describe('drag and drop', () => {
  test.use({ viewport: { width: 1280, height: 1100 } });

  test('drags the first video onto the last one', async ({ page, youtube }) => {
    await openAlgorithms(page);
    const items = videoList(page).locator('tbody tr');
    const handle = items.first().locator('.video-item__handle');
    const last = items.last();

    const box = await last.boundingBox();
    if (box === null) {
      throw new Error('The last video has no box');
    }
    await handle.hover();
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 5, { steps: 5 });
    await page.mouse.move(box.x + 200, box.y + box.height - 5, { steps: 5 });
    await page.mouse.up();

    await expect
      .poll(() => videoTitles(page))
      .toEqual([ALGO_VIDEOS[1], ALGO_VIDEOS[2], ALGO_VIDEOS[0]]);
    await expect(
      page.getByRole('status').filter({ hasText: 'Przeniesiono' }),
    ).toHaveText('Przeniesiono „Quicksort in 4 minutes” na pozycję 3.');
    const put = youtube.requests.find(
      (request) =>
        request.method === 'PUT' &&
        request.url.pathname.endsWith('playlistItems'),
    );
    expect(put?.body).toEqual({
      id: 'item-quicksort',
      snippet: {
        playlistId: 'PL-algo',
        resourceId: { kind: 'youtube#video', videoId: 'vid-quicksort' },
        position: 2,
      },
    });
    expect(youtube.videos['PL-algo']?.map((video) => video.title)).toEqual([
      ALGO_VIDEOS[1],
      ALGO_VIDEOS[2],
      ALGO_VIDEOS[0],
    ]);
  });
});

test.describe('touch drag and drop', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test('drags the first video below the last one with a finger', async ({
    page,
    youtube,
  }) => {
    await openAlgorithms(page);
    // Lista na środku okna: przy krawędzi przeciąganie przewijałoby stronę
    await videoList(page).evaluate((list) =>
      list.scrollIntoView({ block: 'center' }),
    );
    const items = videoList(page).locator('tbody tr');
    const handle = await items
      .first()
      .locator('.video-item__handle')
      .boundingBox();
    const last = await items.last().boundingBox();
    if (handle === null || last === null) {
      throw new Error('The video list has no boxes');
    }
    const x = handle.x + handle.width / 2;
    const startY = handle.y + handle.height / 2;
    const endY = last.y + last.height - 4;

    // Playwright nie ma przeciągania palcem, więc dotyk idzie wprost przez protokół przeglądarki
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y: startY }],
    });
    for (let step = 1; step <= 6; step += 1) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: startY + ((endY - startY) * step) / 6 }],
      });
    }
    await expect(items.last()).toHaveClass(/video-item--drop-after/);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });

    await expect
      .poll(() => videoTitles(page))
      .toEqual([ALGO_VIDEOS[1], ALGO_VIDEOS[2], ALGO_VIDEOS[0]]);
    expect(youtube.videos['PL-algo']?.map((video) => video.title)).toEqual([
      ALGO_VIDEOS[1],
      ALGO_VIDEOS[2],
      ALGO_VIDEOS[0],
    ]);
  });
});

test('removes a video after confirmation and shows the new count in the table', async ({
  page,
  youtube,
}) => {
  await openAlgorithms(page);
  const last = videoList(page).locator('tbody tr').last();

  await last.getByRole('button', { name: /^Usuń z playlisty/ }).click();
  await expect(
    last.getByRole('group', {
      name: "Usunąć film „Dijkstra's algorithm explained” z playlisty?",
    }),
  ).toBeVisible();
  await last.getByRole('button', { name: 'Usuń', exact: true }).click();

  await expect.poll(() => videoTitles(page)).toEqual(ALGO_VIDEOS.slice(0, 2));
  await expect(page.getByRole('heading', { level: 3 })).toHaveText('Filmy (2)');
  const deleteRequest = youtube.requests.find(
    (request) => request.method === 'DELETE',
  );
  expect(deleteRequest?.url.pathname).toBe('/youtube/v3/playlistItems');
  expect(deleteRequest?.url.searchParams.get('id')).toBe('item-dijkstra');

  await page.getByRole('link', { name: 'Wszystkie playlisty' }).click();

  expect(new URL(page.url()).hash).toBe('#/');
  const row = playlistRows(page).filter({ hasText: 'Algorytmy' });
  await expect(row.getByRole('cell').first()).toHaveText('2');
});

test('stays at the removed video instead of jumping up to the heading', async ({
  page,
}) => {
  // Niskie okno: nagłówek listy filmów nie mieści się razem z ostatnim filmem
  await page.setViewportSize({ width: 1280, height: 320 });
  await signIn(page);
  await page.getByRole('link', { name: 'Muzyka do pracy' }).click();
  const items = videoList(page).locator('tbody tr');
  await expect(items).toHaveCount(4);
  const heading = page.getByRole('heading', { level: 3 });

  await items
    .last()
    .getByRole('button', { name: /^Usuń z playlisty/ })
    .click();
  await expect(heading).not.toBeInViewport();
  await items.last().getByRole('button', { name: 'Usuń', exact: true }).click();

  await expect(items).toHaveCount(3);
  await expect(
    items.last().getByRole('button', { name: /^Usuń z playlisty/ }),
  ).toBeFocused();
  await expect(heading).not.toBeInViewport();
});

test('adds a video by its youtu.be link', async ({ page, youtube }) => {
  await openAlgorithms(page);

  await page
    .getByRole('textbox', { name: 'Dodaj film' })
    .fill('https://youtu.be/dQw4w9WgXcQ');
  await page.getByRole('button', { name: 'Dodaj', exact: true }).click();

  await expect
    .poll(() => videoTitles(page))
    .toEqual([...ALGO_VIDEOS, 'Added video dQw4w9WgXcQ']);
  // Dodany film od razu ma datę publikacji, bez ponownego wczytania listy
  await expect(
    videoList(page).locator('tbody tr').last().locator('time'),
  ).toHaveText('2009-10-25');
  await expect(page.getByRole('textbox', { name: 'Dodaj film' })).toHaveValue(
    '',
  );
  await expect(
    page.getByRole('status').filter({ hasText: 'Dodano' }),
  ).toHaveText('Dodano film.');
  const post = youtube.requests.find((request) => request.method === 'POST');
  expect(post?.body).toEqual({
    snippet: {
      playlistId: 'PL-algo',
      resourceId: { kind: 'youtube#video', videoId: 'dQw4w9WgXcQ' },
    },
  });
});

test('rejects text that is not a YouTube video', async ({ page, youtube }) => {
  await openAlgorithms(page);

  await page.getByRole('textbox', { name: 'Dodaj film' }).fill('kot');
  await page.getByRole('button', { name: 'Dodaj', exact: true }).click();

  await expect(page.getByRole('alert')).toHaveText(
    'To nie wygląda na link do filmu z YouTube.',
  );
  expect(youtube.requests.some((request) => request.method === 'POST')).toBe(
    false,
  );
});

test('explains a video that does not exist on YouTube', async ({
  page,
  youtube,
}) => {
  await openAlgorithms(page);

  await page
    .getByRole('textbox', { name: 'Dodaj film' })
    .fill(MISSING_VIDEO_ID);
  await page.getByRole('button', { name: 'Dodaj', exact: true }).click();

  await expect(page.getByRole('alert')).toHaveText(
    'Nie znaleziono takiego filmu na YouTube.',
  );
  expect(await videoTitles(page)).toEqual(ALGO_VIDEOS);
  expect(youtube.requests.some((request) => request.method === 'POST')).toBe(
    true,
  );
});

test('saves the description and visibility', async ({ page, youtube }) => {
  await openAlgorithms(page);

  await page.getByRole('button', { name: 'Edytuj' }).click();
  await page.getByRole('textbox', { name: 'Opis' }).fill('Kurs algorytmów');
  await page
    .getByRole('combobox', { name: 'Widoczność' })
    .selectOption('Prywatna');
  await page.getByRole('button', { name: 'Zapisz' }).click();

  await expect(
    page.getByRole('status').filter({ hasText: 'Zapisano' }),
  ).toHaveText('Zapisano zmiany.');
  const put = youtube.requests.find(
    (request) =>
      request.method === 'PUT' && request.url.pathname.endsWith('playlists'),
  );
  expect(put?.url.searchParams.get('part')).toBe('snippet,status');
  expect(put?.body).toEqual({
    id: 'PL-algo',
    snippet: { title: 'Algorytmy', description: 'Kurs algorytmów' },
    status: { privacyStatus: 'private' },
  });
  await expect(page.getByText(/^3 filmy · 🔒 Prywatna ·/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zapisz' })).toBeDisabled();

  await page.getByRole('link', { name: 'Wszystkie playlisty' }).click();
  const row = playlistRows(page).filter({ hasText: 'Algorytmy' });
  await expect(row.getByRole('cell').nth(1)).toHaveText('🔒 Prywatna');
});

test('goes back to the list when the saved playlist no longer exists', async ({
  page,
  youtube,
}) => {
  await openAlgorithms(page);

  youtube.failNextRequestWith(404);
  await page.getByRole('button', { name: 'Edytuj' }).click();
  await page.getByRole('textbox', { name: 'Opis' }).fill('Nowy opis');
  await page.getByRole('button', { name: 'Zapisz' }).click();

  await expect(page.getByRole('heading', { level: 2 })).toHaveText(
    /^Twoje playlisty/,
  );
  await expect(page.getByText('Tej playlisty już nie ma.')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 })).toBeFocused();
  await expect(playlistRows(page).filter({ hasText: 'Algorytmy' })).toHaveCount(
    0,
  );
});

test('deletes the playlist from its profile and returns to the table', async ({
  page,
}) => {
  await openAlgorithms(page);

  await page.getByRole('button', { name: 'Usuń playlistę' }).click();
  await page.getByRole('button', { name: 'Usuń na stałe' }).click();

  await expect(
    page.getByRole('status').filter({ hasText: 'Usunięto' }),
  ).toHaveText('Usunięto playlistę „Algorytmy”.');
  expect(new URL(page.url()).hash).toBe('#/');
  await expect(playlistRows(page).filter({ hasText: 'Algorytmy' })).toHaveCount(
    0,
  );
});

test('keeps Delete playlist in one row with Edit under the playlist details', async ({
  page,
}) => {
  await openAlgorithms(page);

  const edit = await page.getByRole('button', { name: 'Edytuj' }).boundingBox();
  const remove = await page
    .getByRole('button', { name: 'Usuń playlistę' })
    .boundingBox();
  const table = await videoList(page).boundingBox();
  if (edit === null || remove === null || table === null) {
    throw new Error('The profile header has no boxes');
  }
  expect(Math.abs(remove.y - edit.y)).toBeLessThan(2);
  expect(remove.x).toBeGreaterThan(edit.x + edit.width);
  expect(remove.height).toBe(edit.height);
  // Wcześniej przycisk stał pod listą filmów, na samym dole strony
  expect(remove.y).toBeLessThan(table.y);
});

test('goes to the playlist table when the app title is clicked', async ({
  page,
}) => {
  await openAlgorithms(page);

  await page.getByRole('link', { name: 'YouTube Playlist Manager' }).click();

  expect(new URL(page.url()).hash).toBe('#/');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(
    /^Twoje playlisty/,
  );
});

test('opens a profile from its address and goes back with the browser', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/#/playlists/PL-music');

  await expect(page.getByRole('heading', { level: 2 })).toHaveText(
    'Muzyka do pracy',
  );
  // Po odświeżeniu sesja i profil zostają
  await page.reload();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(
    'Muzyka do pracy',
  );
  await page.goBack();

  await expect(page.getByRole('heading', { level: 2 })).toHaveText(
    /^Twoje playlisty/,
  );
});

test('lists an unavailable video and removes it in bulk', async ({
  page,
  youtube,
}) => {
  await signIn(page);
  await page.getByRole('link', { name: 'Muzyka do pracy' }).click();
  const list = videoList(page);
  await expect(list).toBeVisible();

  await expect(page.getByRole('heading', { level: 3 })).toHaveText('Filmy (4)');
  await expect(page.getByText(/^4 filmy · Publiczna/)).toBeVisible();
  const unavailable = list.locator('.video-item--unavailable');
  await expect(unavailable).toHaveCount(1);
  await expect(unavailable).toHaveText(
    /Film niedostępny \(usunięty albo prywatny\)/,
  );
  expect(await videoTitles(page)).toEqual([
    'Lofi beats to study',
    'Jazz for focus and study',
    'Rain sounds',
  ]);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);

  await page.getByRole('button', { name: 'Usuń niedostępne (1)' }).click();
  await page
    .getByRole('group', { name: 'Usunąć 1 niedostępny film z playlisty?' })
    .getByRole('button', { name: 'Usuń', exact: true })
    .click();

  await expect(unavailable).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 3 })).toHaveText('Filmy (3)');
  await expect(
    page.getByRole('button', { name: /^Usuń niedostępne/ }),
  ).toHaveCount(0);
  const deletes = youtube.requests.filter(
    (request) => request.method === 'DELETE',
  );
  expect(deletes).toHaveLength(1);
  expect(deletes[0]?.url.searchParams.get('id')).toBe('item-deleted');
  expect(youtube.videos['PL-music']?.map((video) => video.itemId)).toEqual([
    'item-lofi',
    'item-jazz',
    'item-rain',
  ]);
});

test('fits a phone screen without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await openAlgorithms(page);

  expect(await horizontalScroll(page)).toBe(0);
});

test('lays the profile out for a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await openAlgorithms(page);

  // Miniatura stoi obok tytułu, a nie nad nim
  const thumbnail = await page.locator('.profile__thumbnail').boundingBox();
  const title = await page.getByRole('heading', { level: 2 }).boundingBox();
  if (thumbnail === null || title === null) {
    throw new Error('The profile header has no box');
  }
  expect(thumbnail.x + thumbnail.width).toBeLessThanOrEqual(title.x);
  expect(title.y).toBeLessThan(thumbnail.y + thumbnail.height);

  // Usuwanie to ikona w tym samym rzędzie co tytuł
  const item = videoList(page).locator('tbody tr').first();
  const text = await item.locator('.video-item__cell--title').boundingBox();
  const remove = item.getByRole('button', {
    name: 'Usuń z playlisty „Quicksort in 4 minutes”',
  });
  const removeBox = await remove.boundingBox();
  if (text === null || removeBox === null) {
    throw new Error('The video row has no box');
  }
  expect(removeBox.y).toBeLessThan(text.y + text.height);
  expect(removeBox.y + removeBox.height).toBeGreaterThan(text.y);
  expect(removeBox.x).toBeGreaterThan(text.x + text.width - 1);
  expect(removeBox.width).toBeLessThanOrEqual(40);

  expect(await horizontalScroll(page)).toBe(0);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

for (const width of [1280, 375]) {
  test(`cuts a long video title short before the remove button at ${width} px`, async ({
    page,
    youtube,
  }) => {
    const first = youtube.videos['PL-algo']?.[0];
    if (first === undefined) {
      throw new Error('No seeded video');
    }
    first.title =
      'Bardzo długi tytuł filmu, który nie mieści się w wierszu. '.repeat(6);
    await page.setViewportSize({ width, height: 800 });
    await openAlgorithms(page);
    const item = videoList(page).locator('tbody tr').first();

    const link = await item.locator('.video-item__link').boundingBox();
    const remove = await item
      .getByRole('button', { name: /^Usuń z playlisty/ })
      .boundingBox();
    if (link === null || remove === null) {
      throw new Error('The video row has no box');
    }
    // Tytuł kończy się przed przyciskiem, a piktogram linku zostaje widoczny
    expect(link.x + link.width).toBeLessThanOrEqual(remove.x);
    await expect(item.locator('.external-link__icon')).toBeInViewport();
    const clipped = await item
      .locator('.external-link__text')
      .evaluate(
        (text) =>
          text.scrollWidth > text.clientWidth ||
          text.scrollHeight > text.clientHeight,
      );
    expect(clipped).toBe(true);
    expect(await horizontalScroll(page)).toBe(0);
  });
}

test('sorts the videos by a column, hides the drag handles and clears the sorting', async ({
  page,
}) => {
  await openAlgorithms(page);
  const table = videoList(page);
  const titleHeader = table.getByRole('columnheader', { name: 'Tytuł' });
  const numberHeader = table.getByRole('columnheader', { name: 'Nr' });
  await expect(numberHeader).toHaveAttribute('aria-sort', 'ascending');

  await titleHeader.getByRole('button').click();

  await expect(titleHeader).toHaveAttribute('aria-sort', 'ascending');
  expect(await videoTitles(page)).toEqual([
    ALGO_VIDEOS[1],
    ALGO_VIDEOS[2],
    ALGO_VIDEOS[0],
  ]);
  const handle = page.getByRole('button', {
    name: 'Przenieś „Quicksort in 4 minutes”',
  });
  await expect(handle).toHaveCount(0);

  await page.getByRole('button', { name: 'Wyczyść sortowanie' }).click();

  expect(await videoTitles(page)).toEqual(ALGO_VIDEOS);
  await expect(handle).not.toHaveAttribute('aria-disabled');
});

test('sorts the videos with a select on a phone', async ({ page }) => {
  await openAlgorithms(page);
  const select = page.getByRole('combobox', { name: 'Sortowanie' });
  await expect(select).toBeHidden();

  await page.setViewportSize({ width: 375, height: 800 });
  await expect(select).toBeVisible();
  await select.selectOption('Tytuł: Z-A');

  expect(await videoTitles(page)).toEqual([
    ALGO_VIDEOS[0],
    ALGO_VIDEOS[2],
    ALGO_VIDEOS[1],
  ]);
  expect(await horizontalScroll(page)).toBe(0);
});

test('marks every link to YouTube on the profile', async ({ page }) => {
  await openAlgorithms(page);

  expect(await unmarkedYouTubeLinks(page)).toEqual([]);
  // Link do playlisty, trzy filmy, kanał w nagłówku i stopka
  expect(await page.locator('a[href*="youtube.com"]').count()).toBe(6);

  // Pod kursorem kropki zmieniają się w jedną ciągłą linię, a link nie dokłada drugiej
  for (const link of [
    page.getByRole('link', { name: 'Otwórz na YouTube' }),
    videoList(page).getByRole('link').first(),
    page.getByRole('contentinfo').getByRole('link', { name: 'YouTube' }),
  ]) {
    await link.hover();
    await expect(link).toHaveCSS('text-decoration-line', 'none');
    const text = link.locator('.external-link__text');
    await expect(text).toHaveCSS('text-decoration-line', 'underline');
    await expect(text).toHaveCSS('text-decoration-style', 'solid');
  }
});

test('has no accessibility violations on the profile', async ({ page }) => {
  await openAlgorithms(page);
  // Z otwartym panelem edycji, żeby formularz też został sprawdzony
  await page.getByRole('button', { name: 'Edytuj' }).click();
  await page
    .getByRole('button', { name: /^Usuń z playlisty/ })
    .first()
    .click();

  const dark = await new AxeBuilder({ page }).analyze();
  expect(dark.violations).toEqual([]);

  await page.getByRole('button', { name: 'Ciemny motyw' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const light = await new AxeBuilder({ page }).analyze();
  expect(light.violations).toEqual([]);
});
