import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makePlaylist } from '../test/playlistFactory';
import {
  deletePlaylist,
  listMyPlaylists,
  renamePlaylist,
} from '../youtube/api';
import { ApiError } from '../youtube/types';
import { PlaylistsView } from './PlaylistsView';

vi.mock('../youtube/api', () => ({
  listMyPlaylists: vi.fn(),
  renamePlaylist: vi.fn(),
  deletePlaylist: vi.fn(),
}));

const zupa = makePlaylist({
  id: 'a',
  title: 'Zupa',
  publishedAt: '2026-01-01T00:00:00Z',
});
const cwiczenia = makePlaylist({
  id: 'b',
  title: 'Ćwiczenia',
  publishedAt: '2026-03-01T00:00:00Z',
});
const algorytmy = makePlaylist({
  id: 'c',
  title: 'Algorytmy',
  publishedAt: '2025-12-01T00:00:00Z',
});
const playlists = [zupa, cwiczenia, algorytmy];

const VISIBILITY_KEY = 'youtube-playlist-manager.visibility';
const privateOne = makePlaylist({
  id: 'p',
  title: 'Tajna',
  privacyStatus: 'private',
  publishedAt: '2026-02-01T00:00:00Z',
});
const unlistedOne = makePlaylist({
  id: 'u',
  title: 'Z linkiem',
  privacyStatus: 'unlisted',
  publishedAt: '2026-02-02T00:00:00Z',
});
const mixed = [zupa, cwiczenia, privateOne, unlistedOne];

function filterButton(name: RegExp): HTMLElement {
  return within(
    screen.getByRole('group', { name: 'Filtruj po widoczności' }),
  ).getByRole('button', { name });
}

function rowTitles(): string[] {
  return screen.getAllByRole('rowheader').map((cell) => cell.textContent ?? '');
}

const SORT_KEY = 'youtube-playlist-manager.sort';

function columnHeader(name: string): HTMLElement {
  const header = screen
    .getAllByRole('columnheader')
    .find((item) => item.textContent?.startsWith(name));
  if (!header) {
    throw new Error(`No column header ${name}`);
  }
  return header;
}

function rowOf(title: string): HTMLElement {
  const row = screen
    .getAllByRole('row')
    .find((item) => item.textContent?.includes(title));
  if (!row) {
    throw new Error(`No row for ${title}`);
  }
  return row;
}

function renderView() {
  const onUnauthorized = vi.fn();
  render(<PlaylistsView token="tok" onUnauthorized={onUnauthorized} />);
  return { onUnauthorized, user: userEvent.setup() };
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(listMyPlaylists).mockReset();
  vi.mocked(renamePlaylist).mockReset();
  vi.mocked(deletePlaylist).mockReset();
});

describe('PlaylistsView', () => {
  it('loads playlists and shows them newest first', async () => {
    vi.mocked(listMyPlaylists).mockResolvedValue(playlists);
    renderView();

    expect(screen.getByText('Wczytywanie playlist...')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'Twoje playlisty (3)',
      }),
    ).toBeInTheDocument();
    expect(rowTitles()).toEqual(['Ćwiczenia', 'Zupa', 'Algorytmy']);
    expect(listMyPlaylists).toHaveBeenCalledWith('tok');
  });

  it('shows playlists as a table with labelled columns', async () => {
    vi.mocked(listMyPlaylists).mockResolvedValue(playlists);
    renderView();

    const table = await screen.findByRole('table', {
      name: 'Twoje playlisty (3)',
    });
    const headers = within(table).getAllByRole('columnheader');
    expect(headers).toHaveLength(5);
    ['Tytuł', 'Filmy', 'Widoczność', 'Utworzona', 'Akcje'].forEach(
      (name, index) => expect(headers[index]).toHaveAccessibleName(name),
    );
  });

  it('marks the default sort column as descending', async () => {
    vi.mocked(listMyPlaylists).mockResolvedValue(playlists);
    renderView();
    await screen.findByRole('table');

    expect(columnHeader('Utworzona')).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    expect(columnHeader('Tytuł')).not.toHaveAttribute('aria-sort');
    expect(columnHeader('Filmy')).not.toHaveAttribute('aria-sort');
    expect(columnHeader('Widoczność')).not.toHaveAttribute('aria-sort');
  });

  it('sorts by a clicked header, flips on a second click and remembers it', async () => {
    vi.mocked(listMyPlaylists).mockResolvedValue(playlists);
    const { user } = renderView();
    await screen.findByRole('table');

    await user.click(within(columnHeader('Tytuł')).getByRole('button'));

    expect(rowTitles()).toEqual(['Algorytmy', 'Ćwiczenia', 'Zupa']);
    expect(columnHeader('Tytuł')).toHaveAttribute('aria-sort', 'ascending');
    expect(columnHeader('Utworzona')).not.toHaveAttribute('aria-sort');
    expect(JSON.parse(localStorage.getItem(SORT_KEY) ?? 'null')).toEqual({
      key: 'title',
      direction: 'asc',
    });

    await user.click(within(columnHeader('Tytuł')).getByRole('button'));

    expect(rowTitles()).toEqual(['Zupa', 'Ćwiczenia', 'Algorytmy']);
    expect(columnHeader('Tytuł')).toHaveAttribute('aria-sort', 'descending');
    expect(JSON.parse(localStorage.getItem(SORT_KEY) ?? 'null')).toEqual({
      key: 'title',
      direction: 'desc',
    });
  });

  it('shows the arrow only on the active column', async () => {
    vi.mocked(listMyPlaylists).mockResolvedValue(playlists);
    const { user } = renderView();
    await screen.findByRole('table');

    expect(columnHeader('Utworzona')).toHaveTextContent('▼');
    expect(columnHeader('Tytuł')).not.toHaveTextContent(/[▲▼]/);

    await user.click(within(columnHeader('Tytuł')).getByRole('button'));

    expect(columnHeader('Tytuł')).toHaveTextContent('▲');
    expect(columnHeader('Utworzona')).not.toHaveTextContent(/[▲▼]/);
  });

  it('starts with the stored sort', async () => {
    localStorage.setItem(
      SORT_KEY,
      JSON.stringify({ key: 'title', direction: 'asc' }),
    );
    vi.mocked(listMyPlaylists).mockResolvedValue(playlists);
    renderView();

    await screen.findByRole('table');
    expect(columnHeader('Tytuł')).toHaveAttribute('aria-sort', 'ascending');
    expect(rowTitles()).toEqual(['Algorytmy', 'Ćwiczenia', 'Zupa']);
  });

  it('shows an empty state', async () => {
    vi.mocked(listMyPlaylists).mockResolvedValue([]);
    renderView();

    expect(
      await screen.findByText('Nie masz jeszcze żadnych playlist.'),
    ).toBeInTheDocument();
  });

  it('shows a load error and retries', async () => {
    vi.mocked(listMyPlaylists)
      .mockRejectedValueOnce(new ApiError('network', 'offline'))
      .mockResolvedValueOnce(playlists);
    const { user } = renderView();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Brak połączenia z YouTube.',
    );
    await user.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'Twoje playlisty (3)',
      }),
    ).toBeInTheDocument();
    expect(listMyPlaylists).toHaveBeenCalledTimes(2);
  });

  it('reports 401 on load as an expired session', async () => {
    vi.mocked(listMyPlaylists).mockRejectedValue(
      new ApiError('unauthorized', 'x', 401),
    );
    const { onUnauthorized } = renderView();

    await vi.waitFor(() => expect(onUnauthorized).toHaveBeenCalledTimes(1));
  });

  it('renames a playlist and re-sorts the list', async () => {
    localStorage.setItem(
      SORT_KEY,
      JSON.stringify({ key: 'title', direction: 'asc' }),
    );
    vi.mocked(listMyPlaylists).mockResolvedValue(playlists);
    vi.mocked(renamePlaylist).mockResolvedValue({
      ...algorytmy,
      title: 'Zadania',
    });
    const { user } = renderView();
    await screen.findByRole('heading', {
      level: 2,
      name: 'Twoje playlisty (3)',
    });

    const row = rowOf('Algorytmy');
    await user.click(within(row).getByRole('button', { name: /^Zmień nazwę/ }));
    const input = within(row).getByRole('textbox', {
      name: 'Nowa nazwa playlisty',
    });
    await user.clear(input);
    await user.type(input, 'Zadania{Enter}');

    expect(renamePlaylist).toHaveBeenCalledWith('tok', algorytmy, 'Zadania');
    expect(
      await screen.findByRole('link', { name: 'Zadania' }),
    ).toBeInTheDocument();
    expect(rowTitles()).toEqual(['Ćwiczenia', 'Zadania', 'Zupa']);
  });

  it('deletes a playlist, announces it and focuses the list heading', async () => {
    vi.mocked(listMyPlaylists).mockResolvedValue(playlists);
    vi.mocked(deletePlaylist).mockResolvedValue(undefined);
    const { user } = renderView();
    await screen.findByRole('heading', {
      level: 2,
      name: 'Twoje playlisty (3)',
    });

    const row = rowOf('Zupa');
    await user.click(
      within(row).getByRole('button', { name: /^Usuń playlistę/ }),
    );
    await user.click(
      within(row).getByRole('button', { name: 'Usuń na stałe' }),
    );

    expect(deletePlaylist).toHaveBeenCalledWith('tok', 'a');
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Usunięto playlistę „Zupa”.',
    );
    expect(rowTitles()).toEqual(['Ćwiczenia', 'Algorytmy']);
    const heading = screen.getByRole('heading', {
      level: 2,
      name: 'Twoje playlisty (2)',
    });
    expect(heading).toHaveFocus();
  });

  it('reports 401 on rename as an expired session', async () => {
    vi.mocked(listMyPlaylists).mockResolvedValue(playlists);
    vi.mocked(renamePlaylist).mockRejectedValue(
      new ApiError('unauthorized', 'x', 401),
    );
    const { user, onUnauthorized } = renderView();
    await screen.findByRole('heading', {
      level: 2,
      name: 'Twoje playlisty (3)',
    });

    const row = rowOf('Zupa');
    await user.click(within(row).getByRole('button', { name: /^Zmień nazwę/ }));
    await user.type(
      within(row).getByRole('textbox', { name: 'Nowa nazwa playlisty' }),
      '!{Enter}',
    );

    await vi.waitFor(() => expect(onUnauthorized).toHaveBeenCalledTimes(1));
  });

  it('drops a playlist that no longer exists on YouTube', async () => {
    vi.mocked(listMyPlaylists).mockResolvedValue(playlists);
    vi.mocked(deletePlaylist).mockRejectedValue(
      new ApiError('notFound', 'x', 404),
    );
    const { user } = renderView();
    await screen.findByRole('heading', {
      level: 2,
      name: 'Twoje playlisty (3)',
    });

    const row = rowOf('Zupa');
    await user.click(
      within(row).getByRole('button', { name: /^Usuń playlistę/ }),
    );
    await user.click(
      within(row).getByRole('button', { name: 'Usuń na stałe' }),
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Tej playlisty już nie ma.',
    );
    expect(rowTitles()).toEqual(['Ćwiczenia', 'Algorytmy']);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Twoje playlisty (2)' }),
    ).toHaveFocus();
  });

  it('explains a missing channel when loading returns not found', async () => {
    vi.mocked(listMyPlaylists).mockRejectedValue(
      new ApiError('notFound', 'x', 404),
    );
    renderView();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Nie znaleziono kanału YouTube na tym koncie.',
    );
  });

  describe('visibility filter', () => {
    it('shows the filter with counts of the full list', async () => {
      vi.mocked(listMyPlaylists).mockResolvedValue(mixed);
      renderView();
      await screen.findByRole('table');

      const buttons = within(
        screen.getByRole('group', { name: 'Filtruj po widoczności' }),
      ).getAllByRole('button');
      expect(buttons.map((button) => button.textContent?.trim())).toEqual([
        'Wszystkie (4)',
        'Publiczne (2)',
        'Niepubliczne (1)',
        '🔒 Prywatne (1)',
      ]);
      expect(filterButton(/^Wszystkie/)).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(filterButton(/^Prywatne/)).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    });

    it('filters rows, updates the heading and toggles aria-pressed', async () => {
      vi.mocked(listMyPlaylists).mockResolvedValue(mixed);
      const { user } = renderView();
      await screen.findByRole('table');

      await user.click(filterButton(/^Prywatne/));

      expect(rowTitles()).toEqual(['Tajna']);
      expect(
        screen.getByRole('heading', {
          level: 2,
          name: 'Twoje playlisty (1 z 4)',
        }),
      ).toBeInTheDocument();
      expect(filterButton(/^Prywatne/)).toHaveAttribute('aria-pressed', 'true');
      expect(filterButton(/^Wszystkie/)).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      expect(localStorage.getItem(VISIBILITY_KEY)).toBe('private');

      await user.click(filterButton(/^Wszystkie/));

      expect(rowTitles()).toHaveLength(4);
      expect(
        screen.getByRole('heading', { level: 2, name: 'Twoje playlisty (4)' }),
      ).toBeInTheDocument();
    });

    it('applies the stored preference on mount', async () => {
      localStorage.setItem(VISIBILITY_KEY, 'unlisted');
      vi.mocked(listMyPlaylists).mockResolvedValue(mixed);
      renderView();
      await screen.findByRole('table');

      expect(rowTitles()).toEqual(['Z linkiem']);
      expect(filterButton(/^Niepubliczne/)).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });

    it('keeps the sort order inside a filter', async () => {
      vi.mocked(listMyPlaylists).mockResolvedValue([
        ...mixed,
        makePlaylist({
          id: 'q',
          title: 'Druga tajna',
          privacyStatus: 'private',
          publishedAt: '2026-04-01T00:00:00Z',
        }),
      ]);
      const { user } = renderView();
      await screen.findByRole('table');

      await user.click(filterButton(/^Prywatne/));

      expect(rowTitles()).toEqual(['Druga tajna', 'Tajna']);
    });

    it('explains an empty result and keeps the filter visible', async () => {
      vi.mocked(listMyPlaylists).mockResolvedValue(playlists);
      const { user } = renderView();
      await screen.findByRole('table');

      await user.click(filterButton(/^Prywatne/));

      expect(
        screen.getByText('Brak playlist o tej widoczności.'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(filterButton(/^Wszystkie/)).toBeInTheDocument();
    });

    it('is hidden while loading and for an empty account', async () => {
      vi.mocked(listMyPlaylists).mockResolvedValue([]);
      renderView();

      expect(
        screen.queryByRole('group', { name: 'Filtruj po widoczności' }),
      ).not.toBeInTheDocument();
      await screen.findByText('Nie masz jeszcze żadnych playlist.');
      expect(
        screen.queryByRole('group', { name: 'Filtruj po widoczności' }),
      ).not.toBeInTheDocument();
    });
  });
});
