# YouTube Playlist Manager

@MEMORY.md

## What this is

Static React SPA that signs in to a YouTube account with Google Identity Services and lists, sorts, renames and deletes the user's playlists through YouTube Data API v3. There is no backend: the access token is kept in `sessionStorage` of the current tab only.

## Layout

- `src/youtube/` API client: zod schemas, `api.ts`, `ApiError`, user-facing error messages
- `src/auth/` Google Identity Services loader, `useGoogleAuth`, `LoginScreen`
- `src/playlists/` sorting, formatting, `PlaylistsView`, `PlaylistRow`, `SortControl`
- `src/**/*.spec.ts(x)` Vitest next to the code, `e2e/` Playwright against a stubbed Google
- `tmp/` takes logs, screenshots and throwaway scripts, and is ignored by git

## Conventions

- Identifiers in English, UI copy in Polish
- No `as` type assertions, no inline styles, CSS targets classes only
- Dates in the UI as `YYYY-MM-DD`
- Commit messages in English, Conventional Commits, no `Co-Authored-By`

## Before calling a task done

```bash
npm run format:check && npm run lint && npm run typecheck && npm test && npm run e2e
```
