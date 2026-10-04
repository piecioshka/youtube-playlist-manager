# YouTube Playlist Manager

@MEMORY.md

## What this is

Static React SPA that signs in to a YouTube account with Google Identity Services and lists, sorts, renames and deletes the user's playlists through YouTube Data API v3. A playlist page edits its description and visibility and reorders, removes and adds its videos. There is no backend: the access token is kept in `sessionStorage` of the current tab only.

## Layout

- `src/youtube/` YouTube session (`session.ts`, `YouTubeProvider` with `useYouTube()`) over the fetch-level `api.ts`, zod schemas, `ApiError`, user-facing error messages
- `src/i18n/` UI strings in Polish and English (`messages.ts`), `LocaleProvider` with `useI18n()`
- `src/theme/` theme switch: system (default), light, dark
- `src/auth/` Google Identity Services loader, `useGoogleAuth`, `LoginScreen`
- `src/account/` the signed-in channel: `useChannel`, header chip, account section
- `src/playlists/` the playlist list (`usePlaylists`: load, update, delete, notice), sorting, filtering, `PlaylistsView`, `PlaylistRow`
- `src/search/` video index (`useVideoIndex`) and search across playlists and their videos
- `src/routing/` hash routes (`#/`, `#/playlists/<id>`) and `useRoute`
- `src/profile/` playlist profile: edit form, videos (`usePlaylistVideos`: move, remove, add, bulk removal), delete
- `src/test/` factories, the fake YouTube session and render helpers for specs
- `src/**/*.spec.ts(x)` Vitest next to the code, `e2e/` Playwright against a stubbed Google
- `CONTEXT.md` the domain vocabulary
- `tmp/` takes logs, screenshots and throwaway scripts, and is ignored by git

## Conventions

- Identifiers in English
- UI copy lives in `src/i18n/messages.ts` (pl + en), never inline in components
- No `as` type assertions, no inline styles, CSS targets classes only
- A link that leaves the app for YouTube is a `YouTubeLink` (`src/youtube/YouTubeLink.tsx`): new tab, dotted underline, icon at the end
- Dates in the UI as `YYYY-MM-DD`
- Commit messages in English, Conventional Commits, no `Co-Authored-By`

## Before calling a task done

```bash
npm run format:check && npm run lint && npm run typecheck && npm test && npm run e2e
```
