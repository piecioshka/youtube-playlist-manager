# Contributing

## Requirements

- Node.js from `.nvmrc` (`nvm use`)
- A Google account with a YouTube channel

## Google Cloud setup

The app needs an OAuth 2.0 Client ID. It is not a secret, but it only works for the origins you list.

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create a project (for example `youtube-playlist-manager`).
2. Go to **APIs & Services > Library**, find **YouTube Data API v3** and click **Enable**.
3. Go to **Google Auth Platform > Branding** and click **Get started**. The wizard asks for the app name and a support e-mail (**App Information**), the user type, choose **External** (**Audience**), a contact e-mail (**Contact Information**), and the policy agreement (**Finish**). Click **Create**.
4. In **Audience** keep the publishing status **Testing** and add your Google account under **Test users**. Only test users can sign in, and the app does not need Google verification in this mode.
5. In **Data Access** add the scope `https://www.googleapis.com/auth/youtube`.
6. In **Clients** create an **OAuth client ID** of type **Web application** with these **Authorized JavaScript origins**:
   - `http://localhost:3000`
   - `http://localhost:3001`
   - `http://localhost:3002`
   - `https://piecioshka.github.io`
7. Copy the Client ID:
   - locally: `cp .env.example .env` and set `VITE_GOOGLE_CLIENT_ID=...`
   - GitHub Pages: repository **Settings > Secrets and variables > Actions > Variables**, add `GOOGLE_CLIENT_ID`

On the first sign-in Google shows **Google hasn't verified this app**. That is expected in Testing mode: click **Continue**, and on the consent screen make sure the **Manage your YouTube account** permission is checked, otherwise every API call fails with `403`. With several channels (Brand Accounts) Google asks which one to use; the app shows the playlists of that channel only.

`npm run dev` takes the first free port from 3000. If it lands outside 3000-3002, Google rejects the sign-in with `origin_mismatch`: free a port or add the new origin.

## Scripts

```bash
npm install
npm run dev           # dev server on the first free port from 3000
npm run build         # typecheck + production build to dist/
npm run preview       # serve dist/
npm test              # Vitest unit and component tests
npm run coverage      # the same with a coverage report
npm run e2e           # Playwright against a fresh build, Google is stubbed
npm run lint          # ESLint
npm run typecheck     # tsc --noEmit
npm run format        # Prettier over the whole repository
```

## Architecture

- Static SPA (Vite + React + TypeScript), no backend.
- Sign-in: Google Identity Services token client (`src/auth/useGoogleAuth.ts`). The token is kept in `sessionStorage` for the current tab, so a refresh keeps the session, while closing the tab or expiry (~1 h) ends it; any `401` from the API brings back the sign-in screen.
- API: `src/youtube/api.ts` calls YouTube Data API v3 with `fetch` and validates responses with zod (`src/youtube/schemas.ts`). Errors are `ApiError` with a `kind`; `src/youtube/errorMessage.ts` turns them into UI copy in the current language.
- Rename and the playlist page form use `PUT playlists?part=snippet,status` (`updatePlaylist`). The request carries every writable field (title, description, default language, privacy status) merged with the changes, because the API replaces the whole snippet and status and clears whatever is left out.
- UI: `src/playlists/usePlaylists.ts` loads the playlists once and holds their mutations; `App.tsx` keeps it (and the video index) above both views, so switching between the table and a playlist page fetches nothing again. `src/playlists/PlaylistsView.tsx` adds sorting, filtering and search, `src/playlists/PlaylistRow.tsx` the inline rename and delete confirmation.
- Account: `src/account/useChannel.ts` loads the signed-in channel once per token with `channels.list?part=snippet,statistics&mine=true` (1 quota unit per sign-in, no extra scope, so no e-mail address). `App.tsx` shows it as a chip in the header and above the table; a failure other than `401` just hides it.
- Routing: `src/routing/` keeps the current view in the URL hash: `#/` is the table, `#/playlists/<id>` a playlist page. Hash routes need no server support, so a reload or a shared link works on GitHub Pages, which has no rewrites to `index.html`; Back and Forward work through `hashchange`, without a router library.
- Playlist page: `src/profile/` edits the title, description and visibility, deletes the playlist, and lists its videos with move up/down (optimistic, reverted on error), remove (after an inline confirmation) and add by link or ID (`src/youtube/videoId.ts` reads `watch?v=`, `youtu.be`, `shorts` and `embed` links). It always fetches its own list with `listPlaylistVideos(..., { includeUnavailable: true })`, so deleted and private videos show up as unavailable entries that can be removed one by one or in bulk (sequential `playlistItems.delete`, 50 units each, stopping at the first error); the search index keeps skipping them and gets only the available videos written back after every change. Videos reorder with native HTML5 drag and drop on a handle (no dependency; `src/profile/reorder.ts` holds the pure index math), while the up/down buttons stay the keyboard, screen reader and touch path; both go through one `moveVideo`, and every drop is one `playlistItems.update` (50 quota units). Moving sends the neighbor's position from YouTube, not the index in the list, because positions also count deleted and private videos the list hides.
- Search: `src/search/` filters by playlist titles and by the titles and channels of the videos inside. Video titles come from `playlistItems`, fetched lazily the first time the search field gets focus (at most 4 playlists at once), and stay in memory only. Indexing costs 1 quota unit per 50 videos of every playlist.
- Languages: `src/i18n/messages.ts` holds every UI string in Polish (`pl`, the default) and English (`en`). The `Messages` type comes from the `pl` object and `en` is typed with it, so to add a string you add the key to `pl` and TypeScript makes you add it to `en`. Strings with parameters are functions (English plurals included). `LocaleProvider` keeps the chosen language in `localStorage`, sets `<html lang>` and gives components `useI18n()`; code outside components (`errorMessage`) takes the messages as an argument, and `useGoogleAuth` returns message keys that the sign-in screen translates.
- Theme: `src/theme/` keeps the light/dark choice in `localStorage` (dark by default) and sets `data-theme` on `<html>`; `src/styles/app.css` defines the color tokens per theme. A small inline script in `index.html` sets the attribute before React mounts, so the page never flashes the wrong theme.
- Quota: YouTube Data API allows 10 000 units a day. A list page costs 1 unit (playlists and `playlistItems` alike), a playlist update or delete 50, and so does every `playlistItems.insert`, `playlistItems.update` (a move) and `playlistItems.delete` (50 each).

## Tests

- Unit and component tests sit next to the code (`src/**/*.spec.ts(x)`).
- E2E tests (`e2e/`) never reach Google: Playwright serves a stub instead of `https://accounts.google.com/gsi/client` and answers `https://www.googleapis.com/youtube/v3/playlists` and `playlistItems` (list, insert, update, delete) from in-memory data (`e2e/fixtures.ts`).

## Deployment

`.github/workflows/pages.yml` builds with `BASE_PATH` from `actions/configure-pages` and publishes `dist/` to GitHub Pages on every push to `main`. Enable it once with **Settings > Pages > Source: GitHub Actions**.

## Conventions

- Identifiers in English. UI copy lives in `src/i18n/messages.ts` (pl + en), never inline in components.
- No `as` type assertions, no inline styles, CSS targets classes only.
- Dates in the UI as `YYYY-MM-DD`.
- Conventional Commits in English.
