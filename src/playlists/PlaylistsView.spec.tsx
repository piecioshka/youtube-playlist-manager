import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChannelState } from '../account/useChannel';
import { useI18n } from '../i18n/LocaleProvider';
import type { Locale } from '../i18n/messages';
import { useVideoIndex } from '../search/useVideoIndex';
import { makePlaylist } from '../test/playlistFactory';
import { makeVideo } from '../test/videoFactory';
import { renderWithI18n } from '../test/renderWithI18n';
import {
  deletePlaylist,
  listMyPlaylists,
  listPlaylistVideos,
  renamePlaylist,
} from '../youtube/api';
import { ApiError, type PlaylistVideo } from '../youtube/types';
import { PlaylistsView } from './PlaylistsView';
import { usePlaylists } from './usePlaylists';

vi.mock('../youtube/api', () => ({
  listMyPlaylists: vi.fn(),
  renamePlaylist: vi.fn(),
  deletePlaylist: vi.fn(),
  listPlaylistVideos: vi.fn(),
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

const NO_CHANNEL: ChannelState = { status: 'unavailable', channel: null };

// Lista i indeks filmów żyją w AuthenticatedApp; tutaj ten sam układ w miniaturze
function Harness({
  onUnauthorized,
  channel = NO_CHANNEL,
}: {
  onUnauthorized: () => void;
  channel?: ChannelState;
}) {
  const { t } = useI18n();
  const list = usePlaylists({ token: 'tok', onUnauthorized, t });
  const index = useVideoIndex({
    token: 'tok',
    playlists: list.playlists,
    onUnauthorized,
  });
  return <PlaylistsView list={list} index={index} channel={channel} />;
}

function renderView(locale: Locale = 'pl', channel?: ChannelState) {
  const onUnauthorized = vi.fn();
  renderWithI18n(
    <Harness onUnauthorized={onUnauthorized} channel={channel} />,
    locale,
  );
  return { onUnauthorized, user: userEvent.setup() };
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(listMyPlaylists).mockReset();
  vi.mocked(renamePlaylist).mockReset();
  vi.mocked(deletePlaylist).mockReset();
  vi.mocked(listPlaylistVideos).mockReset();
  vi.mocked(listPlaylistVideos).mockResolvedValue([]);
});

describe('PlaylistsView', () => {
  it('shows the account section with the number of loaded playlists', async () => {
    vi.mocked(listMyPlaylists).mockResolvedValue(playlists);
    renderView('pl', {
      status: 'ready',
      channel: {
        id: 'UC-me',
        title: 'Kanał testowy',
        handle: null,
        thumbnailUrl: null,
        publishedAt: '2012-03-04T10:00:00Z',
        subscriberCount: 5,
        videoCount: 6,
        viewCount: 7,
      },
    });
    const section = screen.getByRole('region', { name: 'Twój kanał' });
    expect(within(section).queryByText('Playlisty')).not.toBeInTheDocument();
    await screen.findByText('Zupa');
    expect(
      within(section).getByText('Playlisty').nextSibling,
    ).toHaveTextContent('3');
  });

  it('renders no account section when the channel is unavailable', async () => {
    vi.mocked(listMyPlaylists).mockResolvedValue(playlists);
    renderView();
    await screen.findByText('Zupa');
    expect(
      screen.queryByRole('region', { name: 'Twój kanał' }),
    ).not.toBeInTheDocument();
  });

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
    expect(
      await screen.findByText('Usunięto playlistę „Zupa”.'),
    ).toHaveAttribute('role', 'status');
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

    expect(
      await screen.findByText('Tej playlisty już nie ma.'),
    ).toHaveAttribute('role', 'status');
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

  describe('in English', () => {
    it('labels the heading, columns, cells, filter and search', async () => {
      vi.mocked(listMyPlaylists).mockResolvedValue(mixed);
      renderView('en');

      expect(screen.getByText('Loading playlists...')).toBeInTheDocument();
      const table = await screen.findByRole('table', {
        name: 'Your playlists (4)',
      });
      const headers = within(table).getAllByRole('columnheader');
      ['Title', 'Videos', 'Visibility', 'Created', 'Actions'].forEach(
        (name, index) => expect(headers[index]).toHaveAccessibleName(name),
      );
      expect(within(rowOf('Tajna')).getByText('Private')).toBeInTheDocument();
      expect(
        screen.getByRole('searchbox', { name: 'Search playlists and videos' }),
      ).toHaveAttribute('placeholder', 'Search playlists and videos...');

      const filter = screen.getByRole('group', {
        name: 'Filter by visibility',
      });
      await userEvent.click(
        within(filter).getByRole('button', { name: /^Private/ }),
      );
      expect(
        screen.getByRole('heading', {
          level: 2,
          name: 'Your playlists (1 of 4)',
        }),
      ).toBeInTheDocument();
    });

    it('announces a deleted playlist', async () => {
      vi.mocked(listMyPlaylists).mockResolvedValue(playlists);
      vi.mocked(deletePlaylist).mockResolvedValue(undefined);
      const { user } = renderView('en');
      await screen.findByRole('table');

      const row = rowOf('Zupa');
      await user.click(
        within(row).getByRole('button', { name: /^Delete playlist/ }),
      );
      await user.click(
        within(row).getByRole('button', { name: 'Delete permanently' }),
      );

      expect(
        await screen.findByText('Playlist "Zupa" deleted.'),
      ).toHaveAttribute('role', 'status');
    });

    it('explains a missing channel and an empty account', async () => {
      vi.mocked(listMyPlaylists).mockRejectedValueOnce(
        new ApiError('notFound', 'x', 404),
      );
      vi.mocked(listMyPlaylists).mockResolvedValueOnce([]);
      const { user } = renderView('en');

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'No YouTube channel found on this account.',
      );
      await user.click(screen.getByRole('button', { name: 'Try again' }));
      expect(
        await screen.findByText('You have no playlists yet.'),
      ).toBeInTheDocument();
    });
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

  describe('search', () => {
    function video(
      videoId: string,
      title: string,
      channelTitle = 'Kanał',
    ): PlaylistVideo {
      return makeVideo({ videoId, title, channelTitle });
    }

    const videosByPlaylist: Record<string, PlaylistVideo[]> = {
      a: [video('v-zupa', 'Pomidorowa w 10 minut', 'Kuchnia Lidla')],
      b: [video('v-joga', 'Joga na dzień dobry')],
      c: [
        video('v-qs', 'Quicksort in 4 minutes', 'Michael Sambol'),
        video('v-ms', 'Merge sort', 'Michael Sambol'),
      ],
    };

    function mockVideos(byPlaylist: Record<string, PlaylistVideo[]>) {
      vi.mocked(listPlaylistVideos).mockImplementation(
        async (_token, playlistId) => byPlaylist[playlistId] ?? [],
      );
    }

    function searchBox(): HTMLElement {
      return screen.getByRole('searchbox', {
        name: 'Szukaj playlist i filmów',
      });
    }

    async function renderLoaded() {
      vi.mocked(listMyPlaylists).mockResolvedValue(playlists);
      mockVideos(videosByPlaylist);
      const rendered = renderView();
      await screen.findByRole('table');
      return rendered;
    }

    it('focuses the field with Cmd+K and with Ctrl+K', async () => {
      const { user } = await renderLoaded();

      await user.keyboard('{Meta>}k{/Meta}');
      expect(searchBox()).toHaveFocus();

      searchBox().blur();
      await user.keyboard('{Control>}k{/Control}');
      expect(searchBox()).toHaveFocus();
    });

    it('announces the shortcut and shows the hint', async () => {
      await renderLoaded();

      expect(searchBox()).toHaveAttribute(
        'aria-keyshortcuts',
        'Meta+K Control+K',
      );
      expect(screen.getByText('Ctrl+K')).toHaveAttribute('aria-hidden', 'true');
    });

    it('does not fetch videos before the field is used', async () => {
      const { user } = await renderLoaded();
      expect(listPlaylistVideos).not.toHaveBeenCalled();

      await user.click(searchBox());

      await vi.waitFor(() =>
        expect(listPlaylistVideos).toHaveBeenCalledTimes(3),
      );
      expect(listPlaylistVideos).toHaveBeenCalledWith('tok', 'a');
    });

    it('filters rows by the playlist title', async () => {
      const { user } = await renderLoaded();

      await user.type(searchBox(), 'zup');

      expect(rowTitles()).toEqual(['Zupa']);
    });

    it('shows a playlist with its matching video', async () => {
      const { user } = await renderLoaded();

      await user.type(searchBox(), 'quicksort');

      const link = await screen.findByRole('link', {
        name: 'Quicksort in 4 minutes',
      });
      expect(link).toHaveAttribute(
        'href',
        'https://www.youtube.com/watch?v=v-qs&list=c',
      );
      expect(link).toHaveAttribute('target', '_blank');
      expect(rowTitles()).toEqual(['Algorytmy']);
      const list = screen.getByRole('list', {
        name: 'Pasujące filmy z playlisty Algorytmy',
      });
      expect(within(list).getAllByRole('listitem')).toHaveLength(1);
      expect(within(list).getByText('Michael Sambol')).toBeInTheDocument();
    });

    it('matches the channel title', async () => {
      const { user } = await renderLoaded();

      await user.type(searchBox(), 'sambol');

      await screen.findByRole('link', { name: 'Merge sort' });
      expect(rowTitles()).toEqual(['Algorytmy']);
    });

    it('ignores diacritics and letter case', async () => {
      const { user } = await renderLoaded();

      await user.type(searchBox(), 'CWICZ');
      expect(rowTitles()).toEqual(['Ćwiczenia']);

      await user.clear(searchBox());
      await user.type(searchBox(), 'dzien dobry');
      expect(
        await screen.findByRole('link', { name: 'Joga na dzień dobry' }),
      ).toBeInTheDocument();
    });

    it('waits for two characters before searching', async () => {
      const { user } = await renderLoaded();

      await user.type(searchBox(), 'z');

      expect(rowTitles()).toHaveLength(3);
    });

    it('clears the query with Escape and keeps focus', async () => {
      const { user } = await renderLoaded();

      await user.type(searchBox(), 'zupa');
      await user.keyboard('{Escape}');

      expect(searchBox()).toHaveValue('');
      expect(searchBox()).toHaveFocus();
      expect(rowTitles()).toHaveLength(3);
    });

    it('explains an empty result and keeps the field and filter', async () => {
      const { user } = await renderLoaded();

      await user.type(searchBox(), 'brak takiej');

      expect(
        await screen.findByText('Brak wyników dla „brak takiej”.'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(searchBox()).toBeInTheDocument();
      expect(filterButton(/^Wszystkie/)).toBeInTheDocument();
    });

    it('counts the found playlists in the heading', async () => {
      const { user } = await renderLoaded();

      await user.type(searchBox(), 'zupa');

      expect(
        screen.getByRole('heading', {
          level: 2,
          name: 'Twoje playlisty (1 z 3)',
        }),
      ).toBeInTheDocument();
    });

    it('searches inside the visibility filter', async () => {
      vi.mocked(listMyPlaylists).mockResolvedValue(mixed);
      mockVideos({});
      const { user } = renderView();
      await screen.findByRole('table');

      await user.click(filterButton(/^Publiczne/));
      await user.type(searchBox(), 'zu');

      expect(rowTitles()).toEqual(['Zupa']);
      expect(
        screen.getByRole('heading', {
          level: 2,
          name: 'Twoje playlisty (1 z 4)',
        }),
      ).toBeInTheDocument();
    });

    it('shows indexing progress and failures', async () => {
      vi.mocked(listMyPlaylists).mockResolvedValue(playlists);
      let resolveLast: (videos: PlaylistVideo[]) => void = () => {};
      vi.mocked(listPlaylistVideos).mockImplementation(
        async (_token, playlistId) => {
          if (playlistId === 'a') {
            throw new ApiError('unknown', 'x', 500);
          }
          if (playlistId === 'c') {
            return new Promise((resolve) => {
              resolveLast = resolve;
            });
          }
          return [];
        },
      );
      const { user } = renderView();
      await screen.findByRole('table');

      await user.click(searchBox());

      expect(
        await screen.findByText('Indeksowanie filmów: 2/3 playlist'),
      ).toHaveAttribute('role', 'status');

      resolveLast([]);

      expect(
        await screen.findByText('Nie udało się pobrać filmów z 1 playlist.'),
      ).toBeInTheDocument();
    });

    it('links to the playlist when more than 5 videos match', async () => {
      vi.mocked(listMyPlaylists).mockResolvedValue(playlists);
      mockVideos({
        c: Array.from({ length: 8 }, (_, index) =>
          video(`v${index}`, `Sortowanie ${index}`),
        ),
      });
      const { user } = renderView();
      await screen.findByRole('table');

      await user.type(searchBox(), 'sortowanie');

      const list = await screen.findByRole('list', {
        name: 'Pasujące filmy z playlisty Algorytmy',
      });
      const items = within(list).getAllByRole('listitem');
      expect(items).toHaveLength(6);
      const more = within(list).getByRole('link', {
        name: 'i jeszcze 3 pasujące filmy',
      });
      expect(more).toHaveAttribute(
        'href',
        'https://www.youtube.com/playlist?list=c',
      );
    });

    it('keeps rename working while searching', async () => {
      vi.mocked(renamePlaylist).mockResolvedValue({
        ...zupa,
        title: 'Zupa krem',
      });
      const { user } = await renderLoaded();
      await user.type(searchBox(), 'zupa');

      const row = rowOf('Zupa');
      await user.click(
        within(row).getByRole('button', { name: /^Zmień nazwę/ }),
      );
      const input = within(row).getByRole('textbox', {
        name: 'Nowa nazwa playlisty',
      });
      await user.clear(input);
      await user.type(input, 'Zupa krem{Enter}');

      expect(
        await screen.findByRole('link', { name: 'Zupa krem' }),
      ).toBeInTheDocument();
      expect(rowTitles()).toEqual(['Zupa krem']);
    });
  });
});
