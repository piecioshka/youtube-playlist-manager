import {
  expect,
  test as base,
  type Locator,
  type Page,
  type Route,
} from '@playwright/test';
import { z } from 'zod';

export type FakePlaylist = {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  itemCount: number;
  privacyStatus: 'public' | 'unlisted' | 'private';
};

export type RecordedRequest = {
  method: string;
  url: URL;
  body: unknown;
};

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, PUT, DELETE, OPTIONS',
};

// Zastępuje https://accounts.google.com/gsi/client: token przychodzi od razu, bez okienka
const GIS_STUB = `
window.google = {
  accounts: {
    oauth2: {
      initTokenClient(config) {
        return {
          requestAccessToken() {
            setTimeout(() => config.callback({ access_token: 'e2e-token', expires_in: '3599' }), 0);
          },
        };
      },
      revoke(token, done) {
        done();
      },
    },
  },
};
`;

export const LONG_TITLE =
  'Superdlugatytulowanazwaplaylistybezzadnychspacji'.repeat(3);

const SEED_PLAYLISTS: FakePlaylist[] = [
  {
    id: 'PL-music',
    title: 'Muzyka do pracy',
    description: 'Spokojne kawałki',
    publishedAt: '2024-01-10T09:00:00Z',
    itemCount: 12,
    privacyStatus: 'public',
  },
  {
    id: 'PL-workout',
    title: 'Ćwiczenia',
    description: '',
    publishedAt: '2025-06-01T09:00:00Z',
    itemCount: 1,
    privacyStatus: 'private',
  },
  {
    id: 'PL-algo',
    title: 'Algorytmy',
    description: 'Wykłady z algorytmiki',
    publishedAt: '2023-03-05T09:00:00Z',
    itemCount: 3,
    privacyStatus: 'unlisted',
  },
  {
    id: 'PL-long',
    title: LONG_TITLE,
    description: '',
    publishedAt: '2022-01-01T09:00:00Z',
    itemCount: 0,
    privacyStatus: 'public',
  },
];

const putBodySchema = z.object({
  id: z.string(),
  snippet: z.object({
    title: z.string(),
    description: z.string(),
    defaultLanguage: z.string().optional(),
  }),
});

function toResource(playlist: FakePlaylist) {
  return {
    kind: 'youtube#playlist',
    id: playlist.id,
    snippet: {
      title: playlist.title,
      description: playlist.description,
      publishedAt: playlist.publishedAt,
      thumbnails: {},
    },
    contentDetails: { itemCount: playlist.itemCount },
    status: { privacyStatus: playlist.privacyStatus },
  };
}

function errorJson(status: number, reason: string) {
  return {
    error: {
      code: status,
      message: 'Simulated failure',
      errors: [{ reason, message: 'Simulated failure' }],
    },
  };
}

export class FakeYouTube {
  playlists: FakePlaylist[] = structuredClone(SEED_PLAYLISTS);
  requests: RecordedRequest[] = [];
  private nextFailureStatus: number | null = null;

  failNextRequestWith(status: number): void {
    this.nextFailureStatus = status;
  }

  async install(page: Page): Promise<void> {
    await page.route('https://accounts.google.com/gsi/client', (route) =>
      route.fulfill({ contentType: 'text/javascript', body: GIS_STUB }),
    );
    await page.route(
      'https://www.googleapis.com/youtube/v3/playlists**',
      (route) => this.handle(route),
    );
  }

  private async handle(route: Route): Promise<void> {
    const request = route.request();
    const method = request.method();
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    const url = new URL(request.url());
    const rawBody = request.postData();
    const body: unknown = rawBody ? JSON.parse(rawBody) : null;
    this.requests.push({ method, url, body });

    if (this.nextFailureStatus !== null) {
      const status = this.nextFailureStatus;
      this.nextFailureStatus = null;
      await route.fulfill({
        status,
        headers: CORS_HEADERS,
        json: errorJson(status, status === 401 ? 'authError' : 'backendError'),
      });
      return;
    }

    if (method === 'GET') {
      await route.fulfill({
        headers: CORS_HEADERS,
        json: {
          kind: 'youtube#playlistListResponse',
          items: this.playlists.map(toResource),
        },
      });
      return;
    }

    if (method === 'PUT') {
      const parsed = putBodySchema.safeParse(body);
      if (!parsed.success) {
        await route.fulfill({
          status: 400,
          headers: CORS_HEADERS,
          json: errorJson(400, 'invalidArgument'),
        });
        return;
      }
      const update = parsed.data;
      const playlist = this.playlists.find((item) => item.id === update.id);
      if (!playlist) {
        await route.fulfill({
          status: 404,
          headers: CORS_HEADERS,
          json: errorJson(404, 'playlistNotFound'),
        });
        return;
      }
      playlist.title = update.snippet.title;
      playlist.description = update.snippet.description;
      await route.fulfill({
        headers: CORS_HEADERS,
        json: {
          kind: 'youtube#playlist',
          id: playlist.id,
          snippet: {
            title: playlist.title,
            description: playlist.description,
            publishedAt: playlist.publishedAt,
            thumbnails: {},
          },
        },
      });
      return;
    }

    if (method === 'DELETE') {
      const id = url.searchParams.get('id');
      this.playlists = this.playlists.filter((item) => item.id !== id);
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    await route.fulfill({ status: 405, headers: CORS_HEADERS });
  }
}

export const test = base.extend<{ youtube: FakeYouTube }>({
  // auto: testy, które nie czytają `youtube`, i tak potrzebują zastąpionego Google
  youtube: [
    async ({ page }, use) => {
      const youtube = new FakeYouTube();
      await youtube.install(page);
      await use(youtube);
    },
    { auto: true },
  ],
});

export { expect };

export async function signIn(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Zaloguj przez Google' }).click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(
    /^Twoje playlisty \(\d+\)$/,
  );
}

// Wiersze z danymi, bez wiersza nagłówka tabeli
export function playlistRows(page: Page): Locator {
  return page.getByRole('rowgroup').nth(1).getByRole('row');
}

export function playlistTitles(page: Page): Promise<string[]> {
  return page.getByRole('rowheader').allTextContents();
}
