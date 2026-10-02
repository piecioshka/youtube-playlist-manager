# Contributing

## Requirements

- Node.js from `.nvmrc` (`nvm use`)
- A Google account with a YouTube channel

## Google Cloud setup

The app needs an OAuth 2.0 Client ID. It is not a secret, but it only works for the origins you list.

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create a project (for example `youtube-playlist-manager`).
2. Go to **APIs & Services > Library**, find **YouTube Data API v3** and click **Enable**.
3. Go to **Google Auth Platform > Branding** (OAuth consent screen): user type **External**, fill in the app name and your e-mail.
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
- Sign-in: Google Identity Services token client (`src/auth/useGoogleAuth.ts`). The access token stays in React state and expires after about an hour; any `401` from the API brings back the sign-in screen.
- API: `src/youtube/api.ts` calls YouTube Data API v3 with `fetch` and validates responses with zod (`src/youtube/schemas.ts`). Errors are `ApiError` with a `kind`; `src/youtube/errorMessage.ts` turns them into Polish UI copy.
- Rename uses `PUT playlists?part=snippet`. The request carries the current description and default language, because the API replaces the whole snippet.
- UI: `src/playlists/PlaylistsView.tsx` (loading, sorting, list state) and `src/playlists/PlaylistRow.tsx` (inline rename and delete confirmation).
- Quota: YouTube Data API allows 10 000 units a day. A list page costs 1 unit, a rename or a delete 50.

## Tests

- Unit and component tests sit next to the code (`src/**/*.spec.ts(x)`).
- E2E tests (`e2e/`) never reach Google: Playwright serves a stub instead of `https://accounts.google.com/gsi/client` and answers `https://www.googleapis.com/youtube/v3/playlists` from in-memory data (`e2e/fixtures.ts`).

## Deployment

`.github/workflows/pages.yml` builds with `BASE_PATH` from `actions/configure-pages` and publishes `dist/` to GitHub Pages on every push to `main`. Enable it once with **Settings > Pages > Source: GitHub Actions**.

## Conventions

- Identifiers in English, UI copy in Polish.
- No `as` type assertions, no inline styles, CSS targets classes only.
- Dates in the UI as `YYYY-MM-DD`.
- Conventional Commits in English.
