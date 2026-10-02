import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Locale } from '../i18n/messages';
import type { PlaylistChanges } from '../youtube/api';
import { PlaylistGoneError } from '../playlists/usePlaylists';
import type { Route } from '../routing/route';
import { makeFakeYouTube, type FakeYouTube } from '../test/fakeYouTube';
import { makePlaylist } from '../test/playlistFactory';
import { renderWithYouTube } from '../test/renderWithYouTube';
import { makeVideo } from '../test/videoFactory';
import { ApiError, type Playlist, type PlaylistVideo } from '../youtube/types';
import { PlaylistProfile } from './PlaylistProfile';

let youtube: FakeYouTube;

const algo = makePlaylist({
  id: 'PL-algo',
  title: 'Algorytmy',
  description: 'Wykłady',
  itemCount: 3,
  privacyStatus: 'unlisted',
  publishedAt: '2023-03-05T09:00:00Z',
  thumbnailUrl: 'https://i.ytimg.com/algo/mq.jpg',
});

const quicksort = makeVideo({
  itemId: 'item-qs',
  videoId: 'v-qs',
  title: 'Quicksort',
  channelTitle: 'Michael Sambol',
  position: 0,
  thumbnailUrl: 'https://i.ytimg.com/vi/v-qs/mq.jpg',
});
const bigO = makeVideo({
  itemId: 'item-bigo',
  videoId: 'v-bigo',
  title: 'Big O',
  channelTitle: 'CS Dojo',
  position: 1,
});
const graphs = makeVideo({
  itemId: 'item-graphs',
  videoId: 'v-graphs',
  title: 'Grafy',
  channelTitle: 'WikiBooks',
  position: 2,
});
const videos = [quicksort, bigO, graphs];

type RenderOptions = {
  playlist?: Playlist;
  locale?: Locale;
};

function renderProfile(options: RenderOptions = {}) {
  const { playlist = algo, locale = 'pl' } = options;
  const props = {
    onSave: vi.fn<
      (playlist: Playlist, changes: PlaylistChanges) => Promise<Playlist>
    >(async (target, changes) => ({ ...target, ...changes })),
    onDelete: vi.fn<(playlist: Playlist) => Promise<void>>(async () => {}),
    onCountChange: vi.fn<(playlistId: string, count: number) => void>(),
    onNavigate: vi.fn<(route: Route) => void>(),
    replaceVideos: vi.fn<(id: string, videos: PlaylistVideo[]) => void>(),
  };
  // Jak w App: zmieniona playlista i poprawiona liczba filmów wracają do profilu jako nowy prop
  function Harness() {
    const [current, setCurrent] = useState(playlist);
    return (
      <PlaylistProfile
        playlist={current}
        videoIndex={{ replaceVideos: props.replaceVideos }}
        onSave={async (target, changes) => {
          const saved = await props.onSave(target, changes);
          setCurrent(saved);
          return saved;
        }}
        onDelete={props.onDelete}
        onCountChange={(playlistId, count) => {
          props.onCountChange(playlistId, count);
          setCurrent((previous) => ({ ...previous, itemCount: count }));
        }}
        onNavigate={props.onNavigate}
      />
    );
  }
  renderWithYouTube(<Harness />, youtube, locale);
  return { ...props, user: userEvent.setup() };
}

function meta(): Element | null {
  return document.querySelector('.profile__meta');
}

async function renderLoaded(options: RenderOptions = {}) {
  const rendered = renderProfile(options);
  await screen.findByRole('list', { name: /^Filmy/ });
  return rendered;
}

function videoTitles(): string[] {
  const list = screen.getByRole('list', { name: /^Filmy/ });
  return within(list)
    .getAllByRole('link')
    .map((link) => link.textContent ?? '');
}

function item(title: string): HTMLElement {
  const found = screen
    .getAllByRole('listitem')
    .find((element) => element.textContent?.includes(title));
  if (!found) {
    throw new Error(`No video ${title}`);
  }
  return found;
}

function form(): HTMLElement {
  return screen.getByRole('form', { name: 'Ustawienia playlisty' });
}

const unauthorized = () => new ApiError('unauthorized', 'expired', 401);

beforeEach(() => {
  youtube = makeFakeYouTube();
  youtube.listPlaylistVideos.mockResolvedValue(videos);
});

describe('PlaylistProfile', () => {
  describe('header', () => {
    it('shows the playlist details with links back and to YouTube', async () => {
      renderProfile();

      expect(
        screen.getByRole('heading', { level: 2, name: 'Algorytmy' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'Wszystkie playlisty' }),
      ).toHaveAttribute('href', '#/');
      const youtube = screen.getByRole('link', { name: 'Otwórz na YouTube' });
      expect(youtube).toHaveAttribute(
        'href',
        'https://www.youtube.com/playlist?list=PL-algo',
      );
      expect(youtube).toHaveAttribute('target', '_blank');
      expect(youtube).toHaveAttribute('rel', 'noreferrer');
      expect(meta()).toHaveTextContent('3 filmy · Niepubliczna · 2023-03-05');
      const thumbnail = document.querySelector('.profile__thumbnail');
      expect(thumbnail).toHaveAttribute('src', algo.thumbnailUrl);
      expect(thumbnail).toHaveAttribute('alt', '');
      await screen.findByRole('list', { name: /^Filmy/ });
    });

    it('shows a placeholder without a thumbnail', async () => {
      renderProfile({ playlist: { ...algo, thumbnailUrl: null } });
      expect(document.querySelector('img.profile__thumbnail')).toBeNull();
      expect(
        document.querySelector('.profile__thumbnail--empty'),
      ).toBeInTheDocument();
      await screen.findByRole('list', { name: /^Filmy/ });
    });
  });

  describe('edit form', () => {
    it('starts with the current values and nothing to save', async () => {
      await renderLoaded();

      expect(screen.getByRole('textbox', { name: 'Nazwa' })).toHaveValue(
        'Algorytmy',
      );
      expect(screen.getByRole('textbox', { name: 'Opis' })).toHaveValue(
        'Wykłady',
      );
      expect(screen.getByRole('combobox', { name: 'Widoczność' })).toHaveValue(
        'unlisted',
      );
      expect(screen.getByRole('button', { name: 'Zapisz' })).toBeDisabled();
    });

    it('saves only the changed title and announces it', async () => {
      const renamed = { ...algo, title: 'Algorytmy i struktury' };
      const { user, onSave } = await renderLoaded();
      onSave.mockResolvedValue(renamed);

      const title = screen.getByRole('textbox', { name: 'Nazwa' });
      await user.clear(title);
      await user.type(title, '  Algorytmy i struktury  ');
      await user.click(screen.getByRole('button', { name: 'Zapisz' }));

      expect(onSave).toHaveBeenCalledWith(algo, {
        title: 'Algorytmy i struktury',
      });
      expect(await within(form()).findByRole('status')).toHaveTextContent(
        'Zapisano zmiany.',
      );
      expect(title).toHaveValue('Algorytmy i struktury');
    });

    it('saves the description and the visibility', async () => {
      const changed: Playlist = {
        ...algo,
        description: 'Nowy opis',
        privacyStatus: 'private',
      };
      const { user, onSave } = await renderLoaded();
      onSave.mockResolvedValue(changed);

      const description = screen.getByRole('textbox', { name: 'Opis' });
      await user.clear(description);
      await user.type(description, 'Nowy opis');
      await user.selectOptions(
        screen.getByRole('combobox', { name: 'Widoczność' }),
        '🔒 Prywatna',
      );
      await user.click(screen.getByRole('button', { name: 'Zapisz' }));

      expect(onSave).toHaveBeenCalledWith(algo, {
        description: 'Nowy opis',
        privacyStatus: 'private',
      });
      expect(screen.getByRole('combobox', { name: 'Widoczność' })).toHaveValue(
        'private',
      );
    });

    it('shows Saving... and blocks the form while the request runs', async () => {
      let finish: (playlist: Playlist) => void = () => {};
      const { user, onSave } = await renderLoaded();
      onSave.mockImplementation(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );

      await user.type(screen.getByRole('textbox', { name: 'Opis' }), '!');
      await user.click(screen.getByRole('button', { name: 'Zapisz' }));

      expect(
        screen.getByRole('button', { name: 'Zapisywanie...' }),
      ).toBeDisabled();
      finish({ ...algo, description: 'Wykłady!' });
      expect(
        await screen.findByRole('button', { name: 'Zapisz' }),
      ).toBeDisabled();
    });

    it('resets the fields', async () => {
      const { user } = await renderLoaded();
      const title = screen.getByRole('textbox', { name: 'Nazwa' });

      await user.type(title, ' 2');
      expect(screen.getByRole('button', { name: 'Zapisz' })).toBeEnabled();
      await user.click(screen.getByRole('button', { name: 'Przywróć' }));

      expect(title).toHaveValue('Algorytmy');
      expect(screen.getByRole('button', { name: 'Zapisz' })).toBeDisabled();
    });

    it('rejects an empty title', async () => {
      const { user, onSave } = await renderLoaded();
      const title = screen.getByRole('textbox', { name: 'Nazwa' });

      await user.clear(title);
      await user.type(title, '   ');
      await user.click(screen.getByRole('button', { name: 'Zapisz' }));

      expect(within(form()).getByRole('alert')).toHaveTextContent(
        'Nazwa nie może być pusta.',
      );
      expect(title).toHaveAttribute('aria-invalid', 'true');
      expect(onSave).not.toHaveBeenCalled();
    });

    it('rejects a title longer than 150 characters', async () => {
      const { user, onSave } = await renderLoaded();
      const title = screen.getByRole('textbox', { name: 'Nazwa' });

      await user.clear(title);
      await user.click(title);
      await user.paste('a'.repeat(151));
      await user.click(screen.getByRole('button', { name: 'Zapisz' }));

      expect(within(form()).getByRole('alert')).toHaveTextContent(
        'Nazwa może mieć najwyżej 150 znaków.',
      );
      expect(onSave).not.toHaveBeenCalled();
    });

    it('limits the description to 5000 characters', async () => {
      await renderLoaded();
      expect(screen.getByRole('textbox', { name: 'Opis' })).toHaveAttribute(
        'maxlength',
        '5000',
      );
    });

    it('shows an API error under the form', async () => {
      const { user, onSave } = await renderLoaded();
      onSave.mockRejectedValue(
        new Error('Wyczerpano dzienny limit YouTube API. Spróbuj jutro.'),
      );

      await user.type(screen.getByRole('textbox', { name: 'Opis' }), '!');
      await user.click(screen.getByRole('button', { name: 'Zapisz' }));

      expect(await within(form()).findByRole('alert')).toHaveTextContent(
        'Wyczerpano dzienny limit YouTube API. Spróbuj jutro.',
      );
    });

    it('leaves the profile when the saved playlist is gone', async () => {
      const { user, onSave, onNavigate } = await renderLoaded();
      onSave.mockRejectedValue(
        new PlaylistGoneError('Tej playlisty już nie ma.'),
      );

      await user.type(screen.getByRole('textbox', { name: 'Opis' }), '!');
      await user.click(screen.getByRole('button', { name: 'Zapisz' }));

      await waitFor(() =>
        expect(onNavigate).toHaveBeenCalledWith({ name: 'list' }),
      );
    });
  });

  describe('delete', () => {
    it('deletes after confirmation and goes back to the list', async () => {
      const { user, onDelete, onNavigate } = await renderLoaded();

      await user.click(screen.getByRole('button', { name: 'Usuń playlistę' }));
      const group = screen.getByRole('group', {
        name: 'Potwierdzenie usunięcia playlisty Algorytmy',
      });
      expect(group).toHaveTextContent('Usunąć na stałe?');
      await user.click(
        within(group).getByRole('button', { name: 'Usuń na stałe' }),
      );

      expect(onDelete).toHaveBeenCalledWith(algo);
      await waitFor(() =>
        expect(onNavigate).toHaveBeenCalledWith({ name: 'list' }),
      );
    });

    it('cancels the confirmation', async () => {
      const { user, onDelete } = await renderLoaded();

      await user.click(screen.getByRole('button', { name: 'Usuń playlistę' }));
      await user.click(screen.getByRole('button', { name: 'Anuluj' }));

      expect(
        screen.getByRole('button', { name: 'Usuń playlistę' }),
      ).toHaveFocus();
      expect(onDelete).not.toHaveBeenCalled();
    });

    it('shows a delete error and stays on the profile', async () => {
      const { user, onDelete, onNavigate } = await renderLoaded();
      onDelete.mockRejectedValue(
        new Error('YouTube odmówił dostępu do tej operacji.'),
      );

      await user.click(screen.getByRole('button', { name: 'Usuń playlistę' }));
      await user.click(screen.getByRole('button', { name: 'Usuń na stałe' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'YouTube odmówił dostępu do tej operacji.',
      );
      expect(onNavigate).not.toHaveBeenCalled();
    });

    it('leaves the profile when the deleted playlist is already gone', async () => {
      const { user, onDelete, onNavigate } = await renderLoaded();
      onDelete.mockRejectedValue(
        new PlaylistGoneError('Tej playlisty już nie ma.'),
      );

      await user.click(screen.getByRole('button', { name: 'Usuń playlistę' }));
      await user.click(screen.getByRole('button', { name: 'Usuń na stałe' }));

      await waitFor(() =>
        expect(onNavigate).toHaveBeenCalledWith({ name: 'list' }),
      );
      expect(onNavigate).toHaveBeenCalledTimes(1);
    });
  });

  describe('videos', () => {
    it('lists the videos with positions, thumbnails and links', async () => {
      const { replaceVideos } = await renderLoaded();

      expect(
        screen.getByRole('heading', { level: 3, name: 'Filmy (3)' }),
      ).toBeInTheDocument();
      expect(youtube.listPlaylistVideos).toHaveBeenCalledWith('PL-algo', {
        includeUnavailable: true,
      });
      // Pobrane filmy trafiają do indeksu wyszukiwania i przy powrocie na profil
      expect(replaceVideos).toHaveBeenCalledWith('PL-algo', videos);
      expect(videoTitles()).toEqual(['Quicksort', 'Big O', 'Grafy']);
      const first = item('Quicksort');
      expect(first).toHaveTextContent(/^1/);
      expect(first).toHaveTextContent('Michael Sambol');
      expect(
        within(first).getByRole('link', { name: 'Quicksort' }),
      ).toHaveAttribute(
        'href',
        'https://www.youtube.com/watch?v=v-qs&list=PL-algo',
      );
      expect(
        within(first).getByRole('link', { name: 'Quicksort' }),
      ).toHaveAttribute('target', '_blank');
      expect(first.querySelector('img')).toHaveAttribute('alt', '');
      expect(
        within(first).getByRole('button', { name: 'W górę „Quicksort”' }),
      ).toBeDisabled();
      expect(
        within(item('Grafy')).getByRole('button', { name: 'W dół „Grafy”' }),
      ).toBeDisabled();
    });

    it('shows a loading state, then an empty playlist', async () => {
      youtube.listPlaylistVideos.mockResolvedValue([]);
      renderProfile();

      expect(screen.getByText('Wczytywanie filmów...')).toBeInTheDocument();
      expect(
        await screen.findByText('Ta playlista jest pusta.'),
      ).toBeInTheDocument();
    });

    it('shows a load error and retries', async () => {
      youtube.listPlaylistVideos
        .mockRejectedValueOnce(new ApiError('network', 'offline'))
        .mockResolvedValueOnce(videos);
      const { user } = renderProfile();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Brak połączenia z YouTube.',
      );
      await user.click(
        screen.getByRole('button', { name: 'Spróbuj ponownie' }),
      );

      await screen.findByRole('list', { name: /^Filmy/ });
      expect(videoTitles()).toEqual(['Quicksort', 'Big O', 'Grafy']);
    });

    it('moves a video down at once and saves its new position', async () => {
      youtube.movePlaylistItem.mockResolvedValue(undefined);
      const { user, replaceVideos } = await renderLoaded();

      await user.click(
        within(item('Quicksort')).getByRole('button', {
          name: 'W dół „Quicksort”',
        }),
      );

      expect(videoTitles()).toEqual(['Big O', 'Quicksort', 'Grafy']);
      expect(youtube.movePlaylistItem).toHaveBeenCalledWith(
        'PL-algo',
        quicksort,
        1,
      );
      await waitFor(() =>
        expect(replaceVideos).toHaveBeenCalledWith('PL-algo', [
          { ...bigO, position: 0 },
          { ...quicksort, position: 1 },
          graphs,
        ]),
      );
      expect(item('Big O')).toHaveTextContent(/^1/);
    });

    it('moves a video up', async () => {
      youtube.movePlaylistItem.mockResolvedValue(undefined);
      const { user } = await renderLoaded();

      await user.click(
        within(item('Grafy')).getByRole('button', { name: 'W górę „Grafy”' }),
      );

      expect(videoTitles()).toEqual(['Quicksort', 'Grafy', 'Big O']);
      expect(youtube.movePlaylistItem).toHaveBeenCalledWith(
        'PL-algo',
        graphs,
        1,
      );
    });

    it('shows Working... on the moving video and blocks other moves', async () => {
      let finish: () => void = () => {};
      youtube.movePlaylistItem.mockImplementation(
        () =>
          new Promise((resolve) => {
            finish = () => resolve(undefined);
          }),
      );
      const { user } = await renderLoaded();

      await user.click(
        within(item('Quicksort')).getByRole('button', {
          name: 'W dół „Quicksort”',
        }),
      );

      expect(item('Quicksort')).toHaveTextContent('Pracuję...');
      expect(
        within(item('Grafy')).getByRole('button', { name: 'W górę „Grafy”' }),
      ).toBeDisabled();
      finish();
      await waitFor(() =>
        expect(
          within(item('Grafy')).getByRole('button', {
            name: 'W górę „Grafy”',
          }),
        ).toBeEnabled(),
      );
    });

    it('reverts a failed move and explains it in the item', async () => {
      youtube.movePlaylistItem.mockRejectedValue(
        new ApiError('unknown', 'boom', 500),
      );
      const { user, replaceVideos } = await renderLoaded();

      await user.click(
        within(item('Quicksort')).getByRole('button', {
          name: 'W dół „Quicksort”',
        }),
      );

      expect(
        await within(item('Quicksort')).findByRole('alert'),
      ).toHaveTextContent('Coś poszło nie tak (HTTP 500).');
      expect(videoTitles()).toEqual(['Quicksort', 'Big O', 'Grafy']);
      // Jedyny wpis do indeksu to lista z pierwszego wczytania
      expect(replaceVideos).toHaveBeenCalledTimes(1);
      expect(replaceVideos).toHaveBeenLastCalledWith('PL-algo', videos);
    });

    it('removes a video after confirmation', async () => {
      youtube.removePlaylistItem.mockResolvedValue(undefined);
      const { user, onCountChange, replaceVideos } = await renderLoaded();

      await user.click(
        within(item('Big O')).getByRole('button', {
          name: 'Usuń z playlisty „Big O”',
        }),
      );
      const group = screen.getByRole('group', {
        name: 'Usunąć film „Big O” z playlisty?',
      });
      expect(videoTitles()).toEqual(['Quicksort', 'Big O', 'Grafy']);
      await user.click(within(group).getByRole('button', { name: 'Usuń' }));

      expect(youtube.removePlaylistItem).toHaveBeenCalledWith('item-bigo');
      await waitFor(() =>
        expect(videoTitles()).toEqual(['Quicksort', 'Grafy']),
      );
      expect(item('Grafy')).toHaveTextContent(/^2/);
      expect(onCountChange).toHaveBeenLastCalledWith('PL-algo', 2);
      expect(replaceVideos).toHaveBeenCalledWith('PL-algo', [
        quicksort,
        { ...graphs, position: 1 },
      ]);
      expect(
        screen.getByRole('heading', { level: 3, name: 'Filmy (2)' }),
      ).toBeInTheDocument();
    });

    it('cancels removing a video', async () => {
      const { user } = await renderLoaded();

      await user.click(
        within(item('Big O')).getByRole('button', {
          name: 'Usuń z playlisty „Big O”',
        }),
      );
      await user.click(
        within(item('Big O')).getByRole('button', { name: 'Anuluj' }),
      );

      expect(
        within(item('Big O')).getByRole('button', {
          name: 'Usuń z playlisty „Big O”',
        }),
      ).toHaveFocus();
      expect(youtube.removePlaylistItem).not.toHaveBeenCalled();
    });

    it('keeps the video when removing fails', async () => {
      youtube.removePlaylistItem.mockRejectedValue(
        new ApiError('forbidden', 'no', 403),
      );
      const { user, onCountChange } = await renderLoaded();

      await user.click(
        within(item('Big O')).getByRole('button', {
          name: 'Usuń z playlisty „Big O”',
        }),
      );
      await user.click(
        within(item('Big O')).getByRole('button', { name: 'Usuń' }),
      );

      expect(await within(item('Big O')).findByRole('alert')).toHaveTextContent(
        'YouTube odmówił dostępu do tej operacji.',
      );
      expect(videoTitles()).toEqual(['Quicksort', 'Big O', 'Grafy']);
      expect(onCountChange).toHaveBeenLastCalledWith('PL-algo', 3);
    });
  });

  describe('unavailable videos', () => {
    const deleted = makeVideo({
      itemId: 'item-deleted',
      videoId: 'v-deleted',
      title: 'Deleted video',
      channelTitle: '',
      position: 1,
      available: false,
    });
    const hidden = makeVideo({
      itemId: 'item-private',
      videoId: 'v-private',
      title: 'Private video',
      channelTitle: '',
      position: 3,
      available: false,
    });
    const withUnavailable = [
      quicksort,
      deleted,
      { ...bigO, position: 2 },
      hidden,
    ];

    function unavailableItems(): HTMLElement[] {
      return screen
        .getAllByRole('listitem')
        .filter((element) =>
          element.classList.contains('video-item--unavailable'),
        );
    }

    it('lists them without a link and counts every item', async () => {
      youtube.listPlaylistVideos.mockResolvedValue(withUnavailable);
      const { replaceVideos } = await renderLoaded({
        playlist: { ...algo, itemCount: 12 },
      });

      const items = unavailableItems();
      expect(items).toHaveLength(2);
      expect(items[0]).toHaveTextContent(
        'Film niedostępny (usunięty albo prywatny)',
      );
      expect(items[0]?.querySelector('a')).toBeNull();
      expect(items[0]).not.toHaveTextContent('Deleted video');
      expect(videoTitles()).toEqual(['Quicksort', 'Big O']);
      expect(
        screen.getByRole('heading', { level: 3, name: 'Filmy (4)' }),
      ).toBeInTheDocument();
      // Po wczytaniu nagłówek liczy załadowane elementy, a nie itemCount z listy
      expect(meta()).toHaveTextContent('4 filmy · Niepubliczna');
      // Indeks wyszukiwania dostaje tylko dostępne filmy
      expect(replaceVideos).toHaveBeenCalledWith('PL-algo', [
        quicksort,
        { ...bigO, position: 2 },
      ]);
    });

    it('uses the playlist count in the header while the list loads', () => {
      youtube.listPlaylistVideos.mockReturnValue(new Promise(() => {}));
      renderProfile({ playlist: { ...algo, itemCount: 12 } });
      expect(meta()).toHaveTextContent('12 filmów · Niepubliczna');
    });

    it('removes one unavailable video', async () => {
      youtube.listPlaylistVideos.mockResolvedValue(withUnavailable);
      youtube.removePlaylistItem.mockResolvedValue(undefined);
      const { user } = await renderLoaded();

      await user.click(
        screen.getByRole('button', {
          name: 'Usuń z playlisty „niedostępny nr 2”',
        }),
      );
      await user.click(
        within(
          screen.getByRole('group', {
            name: 'Usunąć film „niedostępny nr 2” z playlisty?',
          }),
        ).getByRole('button', { name: 'Usuń' }),
      );

      expect(youtube.removePlaylistItem).toHaveBeenCalledWith('item-deleted');
      await waitFor(() => expect(unavailableItems()).toHaveLength(1));
      expect(
        screen.getByRole('heading', { level: 3, name: 'Filmy (3)' }),
      ).toBeInTheDocument();
    });

    it('moves an unavailable video', async () => {
      youtube.listPlaylistVideos.mockResolvedValue(withUnavailable);
      youtube.movePlaylistItem.mockResolvedValue(undefined);
      const { user } = await renderLoaded();

      await user.click(
        screen.getByRole('button', { name: 'W dół „niedostępny nr 2”' }),
      );

      expect(youtube.movePlaylistItem).toHaveBeenCalledWith(
        'PL-algo',
        deleted,
        2,
      );
      expect(videoTitles()).toEqual(['Quicksort', 'Big O']);
      expect(screen.getAllByRole('listitem')[2]).toHaveClass(
        'video-item--unavailable',
      );
    });

    it('hides the bulk button when every video is available', async () => {
      await renderLoaded();
      expect(
        screen.queryByRole('button', { name: /^Usuń niedostępne/ }),
      ).not.toBeInTheDocument();
    });

    it('removes all unavailable videos one by one after confirmation', async () => {
      youtube.listPlaylistVideos.mockResolvedValue(withUnavailable);
      const calls: { itemId: string; resolve: () => void }[] = [];
      youtube.removePlaylistItem.mockImplementation(
        (itemId) =>
          new Promise((resolve) => {
            calls.push({ itemId, resolve: () => resolve(undefined) });
          }),
      );
      const { user, onCountChange, replaceVideos } = await renderLoaded();

      await user.click(
        screen.getByRole('button', { name: 'Usuń niedostępne (2)' }),
      );
      const group = screen.getByRole('group', {
        name: 'Usunąć 2 niedostępne filmy z playlisty?',
      });
      await user.click(within(group).getByRole('button', { name: 'Usuń' }));

      // Kolejno: drugie żądanie dopiero po odpowiedzi na pierwsze
      expect(calls.map((call) => call.itemId)).toEqual(['item-deleted']);
      expect(
        screen.getByText('Usuwanie niedostępnych filmów: 0/2'),
      ).toBeInTheDocument();
      calls[0]?.resolve();
      await waitFor(() => expect(calls).toHaveLength(2));
      expect(calls[1]?.itemId).toBe('item-private');
      expect(
        await screen.findByText('Usuwanie niedostępnych filmów: 1/2'),
      ).toBeInTheDocument();
      calls[1]?.resolve();

      await waitFor(() => expect(unavailableItems()).toHaveLength(0));
      expect(videoTitles()).toEqual(['Quicksort', 'Big O']);
      expect(
        screen.queryByRole('button', { name: /^Usuń niedostępne/ }),
      ).not.toBeInTheDocument();
      expect(onCountChange).toHaveBeenLastCalledWith('PL-algo', 2);
      expect(replaceVideos).toHaveBeenLastCalledWith('PL-algo', [
        quicksort,
        { ...bigO, position: 1 },
      ]);
      expect(
        screen.getByRole('heading', { level: 3, name: 'Filmy (2)' }),
      ).toHaveFocus();
    });

    it('stops the bulk removal at the first error', async () => {
      youtube.listPlaylistVideos.mockResolvedValue(withUnavailable);
      youtube.removePlaylistItem
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new ApiError('forbidden', 'no', 403));
      const { user } = await renderLoaded();

      await user.click(
        screen.getByRole('button', { name: 'Usuń niedostępne (2)' }),
      );
      await user.click(screen.getByRole('button', { name: 'Usuń' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'YouTube odmówił dostępu do tej operacji.',
      );
      expect(youtube.removePlaylistItem).toHaveBeenCalledTimes(2);
      expect(unavailableItems()).toHaveLength(1);
      expect(
        screen.getByRole('button', { name: 'Usuń niedostępne (1)' }),
      ).toBeEnabled();
    });

    it('cancels the bulk removal', async () => {
      youtube.listPlaylistVideos.mockResolvedValue(withUnavailable);
      const { user } = await renderLoaded();

      await user.click(
        screen.getByRole('button', { name: 'Usuń niedostępne (2)' }),
      );
      await user.click(screen.getByRole('button', { name: 'Anuluj' }));

      expect(
        screen.getByRole('button', { name: 'Usuń niedostępne (2)' }),
      ).toHaveFocus();
      expect(youtube.removePlaylistItem).not.toHaveBeenCalled();
    });

    it('stops the bulk removal on 401', async () => {
      youtube.listPlaylistVideos.mockResolvedValue(withUnavailable);
      youtube.removePlaylistItem.mockRejectedValue(unauthorized());
      const { user } = await renderLoaded();

      await user.click(
        screen.getByRole('button', { name: 'Usuń niedostępne (2)' }),
      );
      await user.click(screen.getByRole('button', { name: 'Usuń' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Sesja wygasła, zaloguj się ponownie.',
      );
      expect(youtube.removePlaylistItem).toHaveBeenCalledTimes(1);
    });

    it('labels unavailable videos in English', async () => {
      youtube.listPlaylistVideos.mockResolvedValue(withUnavailable);
      renderProfile({ locale: 'en' });
      await screen.findByRole('list', { name: 'Videos (4)' });

      expect(
        screen.getAllByText('Unavailable video (deleted or private)'),
      ).toHaveLength(2);
      expect(
        screen.getByRole('button', { name: 'Remove unavailable (2)' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {
          name: 'Remove from playlist "unavailable #2"',
        }),
      ).toBeInTheDocument();
    });
  });

  describe('add video', () => {
    const added = makeVideo({
      itemId: 'item-new',
      videoId: 'dQw4w9WgXcQ',
      title: 'Never Gonna Give You Up',
      channelTitle: '',
      position: 3,
    });

    it.each([
      ['a link', 'https://youtu.be/dQw4w9WgXcQ'],
      ['a bare id', 'dQw4w9WgXcQ'],
    ])('adds a video by %s', async (_label, input) => {
      youtube.addPlaylistItem.mockResolvedValue(added);
      const { user, onCountChange, replaceVideos } = await renderLoaded();

      const field = screen.getByRole('textbox', { name: 'Dodaj film' });
      expect(field).toHaveAttribute(
        'placeholder',
        'Link do filmu albo jego ID',
      );
      await user.type(field, input);
      await user.click(screen.getByRole('button', { name: 'Dodaj' }));

      expect(youtube.addPlaylistItem).toHaveBeenCalledWith(
        'PL-algo',
        'dQw4w9WgXcQ',
      );
      await waitFor(() =>
        expect(videoTitles()).toEqual([
          'Quicksort',
          'Big O',
          'Grafy',
          'Never Gonna Give You Up',
        ]),
      );
      expect(field).toHaveValue('');
      expect(screen.getByText('Dodano film.')).toBeInTheDocument();
      expect(onCountChange).toHaveBeenLastCalledWith('PL-algo', 4);
      expect(replaceVideos).toHaveBeenCalledWith('PL-algo', [...videos, added]);
    });

    it('explains input that is not a YouTube video', async () => {
      const { user } = await renderLoaded();
      const field = screen.getByRole('textbox', { name: 'Dodaj film' });

      await user.type(field, 'https://vimeo.com/123');
      await user.click(screen.getByRole('button', { name: 'Dodaj' }));

      expect(screen.getByRole('alert')).toHaveTextContent(
        'To nie wygląda na link do filmu z YouTube.',
      );
      expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(youtube.addPlaylistItem).not.toHaveBeenCalled();
    });

    it.each([
      ['videoNotFound', 'Nie znaleziono takiego filmu na YouTube.'],
      // Inny powód 404 przy dodawaniu to też najpewniej brakujący film
      [null, 'Nie znaleziono takiego filmu na YouTube.'],
      ['playlistNotFound', 'Tej playlisty już nie ma.'],
    ])('explains a 404 with reason %s', async (reason, message) => {
      youtube.addPlaylistItem.mockRejectedValue(
        new ApiError('notFound', 'Not found', 404, reason),
      );
      const { user, onCountChange } = await renderLoaded();

      await user.type(
        screen.getByRole('textbox', { name: 'Dodaj film' }),
        '00000000000',
      );
      await user.click(screen.getByRole('button', { name: 'Dodaj' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(videoTitles()).toEqual(['Quicksort', 'Big O', 'Grafy']);
      expect(onCountChange).toHaveBeenLastCalledWith('PL-algo', 3);
    });

    it('explains a missing video in English', async () => {
      youtube.addPlaylistItem.mockRejectedValue(
        new ApiError('notFound', 'Not found', 404, 'videoNotFound'),
      );
      const user = userEvent.setup();
      renderProfile({ locale: 'en' });
      await screen.findByRole('list', { name: /^Videos/ });

      await user.type(
        screen.getByRole('textbox', { name: 'Add a video' }),
        '00000000000',
      );
      await user.click(screen.getByRole('button', { name: 'Add' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'No such video on YouTube.',
      );
    });
  });

  it('translates the profile to English', async () => {
    renderProfile({ locale: 'en' });
    await screen.findByRole('list', { name: 'Videos (3)' });

    expect(
      screen.getByRole('link', { name: 'All playlists' }),
    ).toBeInTheDocument();
    expect(meta()).toHaveTextContent('3 videos · Unlisted · 2023-03-05');
    expect(screen.getByRole('textbox', { name: 'Title' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Move up "Quicksort"' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Delete playlist' }),
    ).toBeInTheDocument();
  });
});
