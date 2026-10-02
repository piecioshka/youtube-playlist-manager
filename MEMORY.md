# Memory

Facts about THIS repository: architecture, traps, decisions that the code and git history do not already state.

## Rules

- One fact per bullet, format: `- [YYYY-MM-DD] [category] fact`
- Categories: `project`, `reference`, `preference`
- Check for an existing entry before adding one, update instead of duplicating
- Delete a fact once it stops being true
- Newest entries first

## Facts

- [2026-10-02] [project] `PlaylistsView` has two `role="status"` live regions (action notice and search indexing status), so tests must pick one by text instead of a bare `getByRole('status')`.
- [2026-10-02] [project] `PUT playlists?part=snippet` replaces the whole snippet: the current `description` and `defaultLanguage` must be sent with the new title, otherwise YouTube clears them.
- [2026-10-02] [project] OAuth Authorized JavaScript origins must match exactly. `npm run dev` takes the first free port from 3000, so CONTRIBUTING lists 3000-3002.
