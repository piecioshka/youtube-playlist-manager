# Memory

Facts about THIS repository: architecture, traps, decisions that the code and git history do not already state.

## Rules

- One fact per bullet, format: `- [YYYY-MM-DD] [category] fact`
- Categories: `project`, `reference`, `preference`
- Check for an existing entry before adding one, update instead of duplicating
- Delete a fact once it stops being true
- Newest entries first

## Facts

- [2026-10-02] [project] `updatePlaylist` in `api.ts` answers with `itemCount` copied from the playlist passed in (the PUT response has no `contentDetails`). The playlist list therefore keeps its own `itemCount` when a save finishes; the profile corrects it through `setItemCount` after the videos load and after every change.
- [2026-10-02] [project] `useGoogleAuth.signOut('sessionExpired')` does nothing when the token it was created for is no longer current. Without it a late 401 from a session the user already left shows "session expired" after a manual sign-out or signs out a fresh session. The guard cannot live in `App.tsx`: `react-hooks/refs` rejects a ref-reading callback passed to `createYouTubeSession` inside `useMemo`.
- [2026-10-02] [project] Specs replace YouTube with `makeFakeYouTube()` passed through `renderWithYouTube` / `youTubeWrapper` (`src/test/`). Only `session.spec.ts` and `App.spec.tsx` use `vi.mock` on `youtube/api`, because they exercise the real session; the 401 rule is tested once, in `session.spec.ts`.
- [2026-10-02] [project] The session object must stay the same for one token (`useMemo` in `App.tsx`): every data hook has it in its effect dependencies, so a new object refetches the playlist list, the channel and the videos.

- [2026-10-02] [project] With `html { scrollbar-gutter: stable }` and classic scrollbars (the Linux CI runner) `scrollWidth - clientWidth` is `-15` on a page that fits, and the gutter hides a real overflow of up to 15 px. E2E tests check horizontal overflow with `horizontalScroll()` from `e2e/fixtures.ts` (scrolls and reads `scrollX`); macOS headless has 0 px overlay scrollbars and never shows the difference.
- [2026-10-02] [project] GitHub Pages deploy (`pages.yml`) needs the repository variable `GOOGLE_CLIENT_ID` and Pages with `build_type=workflow`; both are set. The repo is private, the published site is public.
- [2026-10-02] [project] Both pages render several `role="status"` live regions: the list has two (the notice in `PlaylistsView`, the indexing status in `SearchField`), the profile has four (`PlaylistForm`, `AddVideoForm`, `UnavailableBar`, the move announcement in `PlaylistVideos`). Tests must pick one by text or scope (`within(form)`), never a bare `getByRole('status')`.
- [2026-10-02] [project] `playlistItems.update` (moving a video) needs `snippet.playlistId` and `snippet.resourceId` besides `snippet.position`, otherwise YouTube answers 400.
- [2026-10-02] [project] `PUT playlists?part=snippet,status` replaces the whole snippet and status: the current `title`, `description`, `defaultLanguage` and `privacyStatus` must be sent with every change, otherwise YouTube clears them.
- [2026-10-02] [project] OAuth Authorized JavaScript origins must match exactly. `npm run dev` takes the first free port from 3000, so CONTRIBUTING lists 3000-3002.
