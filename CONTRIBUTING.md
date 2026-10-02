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
- Rename uses `PUT playlists?part=snippet`. The request carries the current description and default language, because the API replaces the whole snippet.
- UI: `src/playlists/PlaylistsView.tsx` (loading, sorting, list state) and `src/playlists/PlaylistRow.tsx` (inline rename and delete confirmation).
- Search: `src/search/` filters by playlist titles and by the titles and channels of the videos inside. Video titles come from `playlistItems`, fetched lazily the first time the search field gets focus (at most 4 playlists at once), and stay in memory only. Indexing costs 1 quota unit per 50 videos of every playlist.
- Languages: `src/i18n/messages.ts` holds every UI string in Polish (`pl`, the default) and English (`en`). The `Messages` type comes from the `pl` object and `en` is typed with it, so to add a string you add the key to `pl` and TypeScript makes you add it to `en`. Strings with parameters are functions (English plurals included). `LocaleProvider` keeps the chosen language in `localStorage`, sets `<html lang>` and gives components `useI18n()`; code outside components (`errorMessage`) takes the messages as an argument, and `useGoogleAuth` returns message keys that the sign-in screen translates.
- Theme: `src/theme/` keeps the light/dark choice in `localStorage` (dark by default) and sets `data-theme` on `<html>`; `src/styles/app.css` defines the color tokens per theme. A small inline script in `index.html` sets the attribute before React mounts, so the page never flashes the wrong theme.
- Quota: YouTube Data API allows 10 000 units a day. A list page costs 1 unit (playlists and `playlistItems` alike), a rename or a delete 50.

## Tests

- Unit and component tests sit next to the code (`src/**/*.spec.ts(x)`).
- E2E tests (`e2e/`) never reach Google: Playwright serves a stub instead of `https://accounts.google.com/gsi/client` and answers `https://www.googleapis.com/youtube/v3/playlists` and `playlistItems` from in-memory data (`e2e/fixtures.ts`).

## Deployment

`.github/workflows/pages.yml` builds with `BASE_PATH` from `actions/configure-pages` and publishes `dist/` to GitHub Pages on every push to `main`. Enable it once with **Settings > Pages > Source: GitHub Actions**.

## Conventions

- Identifiers in English. UI copy lives in `src/i18n/messages.ts` (pl + en), never inline in components.
- No `as` type assertions, no inline styles, CSS targets classes only.
- Dates in the UI as `YYYY-MM-DD`.
- Conventional Commits in English.
