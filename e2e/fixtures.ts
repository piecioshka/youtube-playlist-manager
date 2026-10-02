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
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

export const SEED_CHANNEL = {
  id: 'UC-e2e',
  title: 'Kanał testowy',
  handle: '@kanaltestowy',
  subscribers: '1234',
  videos: '56',
  views: '7890123',
  publishedAt: '2012-03-04T10:00:00Z',
};

// Poprawny format ID, ale takiego filmu „nie ma” na YouTube
export const MISSING_VIDEO_ID = '00000000000';

export const LONG_TITLE =
  'Superdlugatytulowanazwaplaylistybezzadnychspacji'.repeat(3);

const SEED_PLAYLISTS: FakePlaylist[] = [
  {
    id: 'PL-music',
    title: 'Muzyka do pracy',
    description: 'Spokojne kawałki',
    publishedAt: '2024-01-10T09:00:00Z',
    itemCount: 4,
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

// Pusty `channelTitle` oznacza film usunięty albo prywatny
export type FakeVideo = {
  itemId: string;
  videoId: string;
  title: string;
  channelTitle: string;
};

const SEED_VIDEOS: Record<string, FakeVideo[]> = {
  'PL-music': [
    {
      itemId: 'item-lofi',
      videoId: 'vid-lofi',
      title: 'Lofi beats to study',
      channelTitle: 'Lofi Girl',
    },
    {
      itemId: 'item-jazz',
      videoId: 'vid-jazz',
      title: 'Jazz for focus and study',
      channelTitle: 'Cafe Music BGM',
    },
    // Usunięty film: YouTube zostawia element bez kanału właściciela
    {
      itemId: 'item-deleted',
      videoId: 'vid-deleted',
      title: 'Deleted video',
      channelTitle: '',
    },
    {
      itemId: 'item-rain',
      videoId: 'vid-rain',
      title: 'Rain sounds',
      channelTitle: 'Relaxing White Noise',
    },
  ],
  'PL-algo': [
    {
      itemId: 'item-quicksort',
      videoId: 'vid-quicksort',
      title: 'Quicksort in 4 minutes',
      channelTitle: 'Michael Sambol',
    },
    {
      itemId: 'item-bigo',
      videoId: 'vid-bigo',
      title: 'Big O notation for beginners',
      channelTitle: 'CS Dojo',
    },
    {
      itemId: 'item-dijkstra',
      videoId: 'vid-dijkstra',
      title: "Dijkstra's algorithm explained",
      channelTitle: 'Computerphile',
    },
  ],
};

const putBodySchema = z.object({
  id: z.string(),
  snippet: z.object({
    title: z.string(),
    description: z.string(),
    defaultLanguage: z.string().optional(),
  }),
  status: z.object({
    privacyStatus: z.enum(['public', 'unlisted', 'private']),
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

const itemPutBodySchema = z.object({
  id: z.string(),
  snippet: z.object({
    playlistId: z.string(),
    resourceId: z.object({ kind: z.string(), videoId: z.string() }),
    position: z.number().int().nonnegative(),
  }),
});

const itemPostBodySchema = z.object({
  snippet: z.object({
    playlistId: z.string(),
    resourceId: z.object({ kind: z.string(), videoId: z.string() }),
  }),
});

function toPlaylistItem(video: FakeVideo, position: number) {
  return {
    kind: 'youtube#playlistItem',
    id: video.itemId,
    snippet: {
      title: video.title,
      position,
      thumbnails: {},
      ...(video.channelTitle !== '' && {
        videoOwnerChannelTitle: video.channelTitle,
      }),
      resourceId: { kind: 'youtube#video', videoId: video.videoId },
    },
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
  videos: Record<string, FakeVideo[]> = structuredClone(SEED_VIDEOS);
  requests: RecordedRequest[] = [];
  private nextFailureStatus: number | null = null;
  private addedCount = 0;

  failNextRequestWith(status: number): void {
    this.nextFailureStatus = status;
  }

  async install(page: Page): Promise<void> {
    await page.route('https://accounts.google.com/gsi/client', (route) =>
      route.fulfill({ contentType: 'text/javascript', body: GIS_STUB }),
    );
    await page.route(
      'https://www.googleapis.com/youtube/v3/channels**',
      (route) => this.handleChannels(route),
    );
    await page.route(
      'https://www.googleapis.com/youtube/v3/playlists**',
      (route) => this.handle(route),
    );
    await page.route(
      'https://www.googleapis.com/youtube/v3/playlistItems**',
      (route) => this.handleItems(route),
    );
  }

  private async handleChannels(route: Route): Promise<void> {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    await route.fulfill({
      headers: CORS_HEADERS,
      json: {
        kind: 'youtube#channelListResponse',
        items: [
          {
            kind: 'youtube#channel',
            id: SEED_CHANNEL.id,
            snippet: {
              title: SEED_CHANNEL.title,
              customUrl: SEED_CHANNEL.handle,
              publishedAt: SEED_CHANNEL.publishedAt,
              thumbnails: {},
            },
            statistics: {
              viewCount: SEED_CHANNEL.views,
              videoCount: SEED_CHANNEL.videos,
              subscriberCount: SEED_CHANNEL.subscribers,
              hiddenSubscriberCount: false,
            },
          },
        ],
      },
    });
  }

  private async handleItems(route: Route): Promise<void> {
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

    if (method === 'GET') {
      const playlistId = url.searchParams.get('playlistId') ?? '';
      await route.fulfill({
        headers: CORS_HEADERS,
        json: {
          kind: 'youtube#playlistItemListResponse',
          items: (this.videos[playlistId] ?? []).map(toPlaylistItem),
        },
      });
      return;
    }

    if (method === 'DELETE') {
      const itemId = url.searchParams.get('id');
      const owner = this.findItemOwner(itemId);
      if (owner === null) {
        await this.fail(route, 404, 'playlistItemNotFound');
        return;
      }
      this.videos[owner] = (this.videos[owner] ?? []).filter(
        (video) => video.itemId !== itemId,
      );
      this.changeItemCount(owner, -1);
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    if (method === 'PUT') {
      // Jak YouTube: bez playlistId i resourceId sama pozycja kończy się 400
      const parsed = itemPutBodySchema.safeParse(body);
      if (!parsed.success) {
        await this.fail(route, 400, 'invalidArgument');
        return;
      }
      const { id, snippet } = parsed.data;
      const list = this.videos[snippet.playlistId] ?? [];
      const moved = list.find((video) => video.itemId === id);
      if (moved === undefined) {
        await this.fail(route, 404, 'playlistItemNotFound');
        return;
      }
      const rest = list.filter((video) => video.itemId !== id);
      rest.splice(snippet.position, 0, moved);
      this.videos[snippet.playlistId] = rest;
      await route.fulfill({
        headers: CORS_HEADERS,
        json: toPlaylistItem(moved, rest.indexOf(moved)),
      });
      return;
    }

    if (method === 'POST') {
      const parsed = itemPostBodySchema.safeParse(body);
      if (!parsed.success) {
        await this.fail(route, 400, 'invalidArgument');
        return;
      }
      const { playlistId, resourceId } = parsed.data.snippet;
      if (resourceId.videoId === MISSING_VIDEO_ID) {
        await this.fail(route, 404, 'videoNotFound');
        return;
      }
      this.addedCount += 1;
      const added: FakeVideo = {
        itemId: `item-added-${this.addedCount}`,
        videoId: resourceId.videoId,
        title: `Added video ${resourceId.videoId}`,
        channelTitle: 'E2E channel',
      };
      const list = [...(this.videos[playlistId] ?? []), added];
      this.videos[playlistId] = list;
      this.changeItemCount(playlistId, 1);
      // Świeżo dodany element YouTube zwraca czasem bez kanału właściciela
      await route.fulfill({
        headers: CORS_HEADERS,
        json: {
          kind: 'youtube#playlistItem',
          id: added.itemId,
          snippet: {
            title: added.title,
            position: list.length - 1,
            thumbnails: {},
            resourceId: { kind: 'youtube#video', videoId: added.videoId },
          },
        },
      });
      return;
    }

    await route.fulfill({ status: 405, headers: CORS_HEADERS });
  }

  private findItemOwner(itemId: string | null): string | null {
    for (const [playlistId, list] of Object.entries(this.videos)) {
      if (list.some((video) => video.itemId === itemId)) {
        return playlistId;
      }
    }
    return null;
  }

  private changeItemCount(playlistId: string, delta: number): void {
    const playlist = this.playlists.find((item) => item.id === playlistId);
    if (playlist) {
      playlist.itemCount += delta;
    }
  }

  private async fail(route: Route, status: number, reason: string) {
    await route.fulfill({
      status,
      headers: CORS_HEADERS,
      json: errorJson(status, reason),
    });
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
      // `id=` pyta o jedną playlistę (profil otwarty z adresu), `mine=true` o całą listę
      const id = url.searchParams.get('id');
      const playlists =
        id === null
          ? this.playlists
          : this.playlists.filter((item) => item.id === id);
      await route.fulfill({
        headers: CORS_HEADERS,
        json: {
          kind: 'youtube#playlistListResponse',
          items: playlists.map(toResource),
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
      playlist.privacyStatus = update.status.privacyStatus;
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
          status: { privacyStatus: playlist.privacyStatus },
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

/*
 * O ile pikseli strona daje się przewinąć w poziomie. Różnica `scrollWidth`
 * i `clientWidth` się do tego nie nadaje: przy `scrollbar-gutter: stable`
 * i klasycznych paskach przewijania (Linux) jest ujemna na stronie, która
 * mieści się w oknie.
 */
export function horizontalScroll(page: Page): Promise<number> {
  return page.evaluate(() => {
    window.scrollTo({ left: 10_000, behavior: 'instant' });
    return window.scrollX;
  });
}

// Wiersze z danymi, bez wiersza nagłówka tabeli
export function playlistRows(page: Page): Locator {
  return page.getByRole('rowgroup').nth(1).getByRole('row');
}

export function playlistTitles(page: Page): Promise<string[]> {
  return page.getByRole('rowheader').allTextContents();
}
