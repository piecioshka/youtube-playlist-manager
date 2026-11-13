/*
 * Captures the README screenshots of the playlist list in both themes into
 * `docs/screenshots/`, on made-up data: Google sign-in and YouTube Data API
 * are replaced by the same fake as the e2e tests (`e2e/fixtures.ts`).
 *
 * Build first, then run it against a preview server:
 *   VITE_GOOGLE_CLIENT_ID=demo npm run build
 *   npx vite preview --port 4173 --host 127.0.0.1
 *   BASE_URL=http://127.0.0.1:4173 node scripts/screenshots.ts
 */
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import {
  FakeYouTube,
  SEED_CHANNEL,
  type FakePlaylist,
} from '../e2e/fixtures.ts';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:4173';
const OUTPUT_DIR = 'docs/screenshots';

Object.assign(SEED_CHANNEL, {
  title: 'Demo Channel',
  handle: '@demochannel',
  subscribers: '12400',
  videos: '318',
  views: '2486130',
});

const PLAYLISTS: FakePlaylist[] = [
  {
    id: 'PL-cooking',
    title: 'Weekend cooking ideas',
    description: 'Quick recipes for Saturday mornings',
    publishedAt: '2026-10-28T09:00:00Z',
    itemCount: 24,
    privacyStatus: 'public',
  },
  {
    id: 'PL-talks',
    title: 'Conference talks to watch',
    description: 'Saved from this year',
    publishedAt: '2026-09-14T09:00:00Z',
    itemCount: 37,
    privacyStatus: 'unlisted',
  },
  {
    id: 'PL-guitar',
    title: 'Guitar practice',
    description: '',
    publishedAt: '2026-07-02T09:00:00Z',
    itemCount: 12,
    privacyStatus: 'private',
  },
  {
    id: 'PL-roadtrip',
    title: 'Road trip music',
    description: 'Long drives, loud songs',
    publishedAt: '2026-05-19T09:00:00Z',
    itemCount: 58,
    privacyStatus: 'public',
  },
  {
    id: 'PL-workout',
    title: 'Home workout',
    description: '20 minutes or less',
    publishedAt: '2026-03-08T09:00:00Z',
    itemCount: 15,
    privacyStatus: 'private',
  },
  {
    id: 'PL-typescript',
    title: 'Learning TypeScript',
    description: 'From basics to generics',
    publishedAt: '2025-12-01T09:00:00Z',
    itemCount: 21,
    privacyStatus: 'public',
  },
  {
    id: 'PL-space',
    title: 'Space documentaries',
    description: '',
    publishedAt: '2025-08-22T09:00:00Z',
    itemCount: 9,
    privacyStatus: 'unlisted',
  },
  {
    id: 'PL-garden',
    title: 'Gardening basics',
    description: 'Balcony and backyard',
    publishedAt: '2025-04-11T09:00:00Z',
    itemCount: 17,
    privacyStatus: 'public',
  },
];

mkdirSync(OUTPUT_DIR, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const theme of ['light', 'dark'] as const) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: theme,
  });
  await context.addInitScript(() => {
    localStorage.setItem('youtube-playlist-manager.locale', 'en');
  });
  const page = await context.newPage();
  const youtube = new FakeYouTube();
  youtube.playlists = structuredClone(PLAYLISTS);
  youtube.videos = {};
  await youtube.install(page);
  await page.goto(`${BASE_URL}/`);
  await page.getByRole('button', { name: 'Sign in with Google' }).click();
  await page
    .getByRole('heading', { level: 2, name: /Your playlists/ })
    .waitFor();
  await page.evaluate(() => document.fonts.ready);
  const output = `${OUTPUT_DIR}/playlists-${theme}.png`;
  await page.screenshot({ path: output });
  console.log(output);
  await context.close();
}
await browser.close();
