import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import {
  expect,
  horizontalScroll,
  MISSING_VIDEO_ID,
  playlistRows,
  signIn,
  test,
} from './fixtures';

function videoList(page: Page) {
  return page.getByRole('list', { name: /^Filmy/ });
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
});

test('moves a video down', async ({ page, youtube }) => {
  await openAlgorithms(page);

  await page
    .getByRole('button', { name: 'W dół „Quicksort in 4 minutes”' })
    .click();

  await expect
    .poll(() => videoTitles(page))
    .toEqual([ALGO_VIDEOS[1], ALGO_VIDEOS[0], ALGO_VIDEOS[2]]);
  await expect(
    page.getByRole('button', { name: 'W dół „Quicksort in 4 minutes”' }),
  ).toBeEnabled();
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
    const items = videoList(page).getByRole('listitem');
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

test('removes a video after confirmation and shows the new count in the table', async ({
  page,
  youtube,
}) => {
  await openAlgorithms(page);
  const last = videoList(page).getByRole('listitem').last();

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

test('adds a video by its youtu.be link', async ({ page, youtube }) => {
  await openAlgorithms(page);

  await page
    .getByRole('textbox', { name: 'Dodaj film' })
    .fill('https://youtu.be/dQw4w9WgXcQ');
  await page.getByRole('button', { name: 'Dodaj', exact: true }).click();

  await expect
    .poll(() => videoTitles(page))
    .toEqual([...ALGO_VIDEOS, 'Added video dQw4w9WgXcQ']);
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
  await page.getByRole('textbox', { name: 'Opis' }).fill('Nowy opis');
  await page.getByRole('button', { name: 'Zapisz' }).click();

  await expect(page.getByRole('heading', { level: 2 })).toHaveText(
    /^Twoje playlisty/,
  );
  await expect(page.getByText('Tej playlisty już nie ma.')).toBeVisible();
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

test('has no accessibility violations on the profile', async ({ page }) => {
  await openAlgorithms(page);
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
