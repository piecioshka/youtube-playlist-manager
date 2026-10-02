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

function rowTitles(): string[] {
  return screen.getAllByRole('rowheader').map((cell) => cell.textContent ?? '');
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
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((header) => header.textContent);
    expect(headers).toEqual([
      'Tytuł',
      'Filmy',
      'Widoczność',
      'Utworzona',
      'Akcje',
    ]);
  });

  it('switches to alphabetical order and remembers it', async () => {
    vi.mocked(listMyPlaylists).mockResolvedValue(playlists);
    const { user } = renderView();
    await screen.findByRole('heading', {
      level: 2,
      name: 'Twoje playlisty (3)',
    });

    await user.click(screen.getByRole('radio', { name: 'Alfabetycznie' }));

    expect(rowTitles()).toEqual(['Algorytmy', 'Ćwiczenia', 'Zupa']);
    expect(localStorage.getItem('youtube-playlist-manager.sort')).toBe('alpha');
  });

  it('starts with the stored sort order', async () => {
    localStorage.setItem('youtube-playlist-manager.sort', 'alpha');
    vi.mocked(listMyPlaylists).mockResolvedValue(playlists);
    renderView();

    await screen.findByRole('heading', {
      level: 2,
      name: 'Twoje playlisty (3)',
    });
    expect(screen.getByRole('radio', { name: 'Alfabetycznie' })).toBeChecked();
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
    localStorage.setItem('youtube-playlist-manager.sort', 'alpha');
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
});
