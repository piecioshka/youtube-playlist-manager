# Memory

Facts about THIS repository: architecture, traps, decisions that the code and git history do not already state.

## Rules

- One fact per bullet, format: `- [YYYY-MM-DD] [category] fact`
- Categories: `project`, `reference`, `preference`
- Check for an existing entry before adding one, update instead of duplicating
- Delete a fact once it stops being true
- Newest entries first

## Facts

- [2026-10-02] [project] With `html { scrollbar-gutter: stable }` and classic scrollbars (the Linux CI runner) `scrollWidth - clientWidth` is `-15` on a page that fits, and the gutter hides a real overflow of up to 15 px. E2E tests check horizontal overflow with `horizontalScroll()` from `e2e/fixtures.ts` (scrolls and reads `scrollX`); macOS headless has 0 px overlay scrollbars and never shows the difference.
- [2026-10-02] [project] GitHub Pages deploy (`pages.yml`) needs the repository variable `GOOGLE_CLIENT_ID` and Pages with `build_type=workflow`; both are set. The repo is private, the published site is public.
- [2026-10-02] [project] `PlaylistsView` has two `role="status"` live regions (action notice and search indexing status), so tests must pick one by text instead of a bare `getByRole('status')`.
- [2026-10-02] [project] `playlistItems.update` (moving a video) needs `snippet.playlistId` and `snippet.resourceId` besides `snippet.position`, otherwise YouTube answers 400.
- [2026-10-02] [project] `PUT playlists?part=snippet,status` replaces the whole snippet and status: the current `title`, `description`, `defaultLanguage` and `privacyStatus` must be sent with every change, otherwise YouTube clears them.
- [2026-10-02] [project] OAuth Authorized JavaScript origins must match exactly. `npm run dev` takes the first free port from 3000, so CONTRIBUTING lists 3000-3002.
