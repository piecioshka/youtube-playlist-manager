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
  videoPublishedAt: '2016-08-11T12:00:00Z',
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

// Panel edycji jest schowany, dopóki ktoś nie kliknie „Edytuj”
async function renderEditing(options: RenderOptions = {}) {
  const rendered = await renderLoaded(options);
  await rendered.user.click(
    screen.getByRole('button', { name: 'Edytuj playlistę' }),
  );
  return rendered;
}

function meta(): Element | null {
  return document.querySelector('.profile__meta');
}

async function renderLoaded(options: RenderOptions = {}) {
  const rendered = renderProfile(options);
  await screen.findByRole('table', { name: /^Filmy/ });
  return rendered;
}

function videoTitles(): string[] {
  const list = screen.getByRole('table', { name: /^Filmy/ });
  return within(list)
    .getAllByRole('link')
    .map((link) => link.textContent ?? '');
}

function item(title: string): HTMLElement {
  const found = screen
    .getAllByRole('row')
    .find((element) => element.textContent?.includes(title));
  if (!found) {
    throw new Error(`No video ${title}`);
  }
  return found;
}

// Uchwyt filmu: przeciąga się go myszą albo palcem, a z klawiatury przesuwa strzałkami
function handleOf(name: string): HTMLElement {
  return screen.getByRole('button', { name: `Przenieś „${name}”` });
}

async function pressOnHandle(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  key: 'ArrowUp' | 'ArrowDown',
) {
  handleOf(name).focus();
  await user.keyboard(`{${key}}`);
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
      await screen.findByRole('table', { name: /^Filmy/ });
    });

    it('shows a placeholder without a thumbnail', async () => {
      renderProfile({ playlist: { ...algo, thumbnailUrl: null } });
      expect(document.querySelector('img.profile__thumbnail')).toBeNull();
      expect(
        document.querySelector('.profile__thumbnail--empty'),
      ).toBeInTheDocument();
      await screen.findByRole('table', { name: /^Filmy/ });
    });
  });

  describe('edit form', () => {
    it('stays hidden until Edit is clicked and hides again on a second click', async () => {
      const { user } = await renderLoaded();
      const toggle = screen.getByRole('button', { name: 'Edytuj playlistę' });

      // Własny kolor odróżnia edycję od czerwonego usuwania obok
      expect(toggle).toHaveClass('button--edit');
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(
        screen.queryByRole('form', { name: 'Ustawienia playlisty' }),
      ).not.toBeInTheDocument();

      await user.click(toggle);

      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(toggle).toHaveAttribute('aria-controls', form().id);
      // Fokus idzie do pierwszego pola, żeby od razu dało się pisać
      expect(screen.getByRole('textbox', { name: 'Nazwa' })).toHaveFocus();

      await user.click(toggle);

      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(
        screen.queryByRole('form', { name: 'Ustawienia playlisty' }),
      ).not.toBeInTheDocument();
    });

    it('forgets an unsaved draft once the panel is closed', async () => {
      const { user } = await renderEditing();

      await user.type(screen.getByRole('textbox', { name: 'Opis' }), ' szkic');
      await user.click(
        screen.getByRole('button', { name: 'Edytuj playlistę' }),
      );
      await user.click(
        screen.getByRole('button', { name: 'Edytuj playlistę' }),
      );

      expect(screen.getByRole('textbox', { name: 'Opis' })).toHaveValue(
        'Wykłady',
      );
    });

    it('starts with the current values and nothing to save', async () => {
      await renderEditing();

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
      const { user, onSave } = await renderEditing();
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
      const { user, onSave } = await renderEditing();
      onSave.mockResolvedValue(changed);

      const description = screen.getByRole('textbox', { name: 'Opis' });
      await user.clear(description);
      await user.type(description, 'Nowy opis');
      await user.selectOptions(
        screen.getByRole('combobox', { name: 'Widoczność' }),
        'Prywatna',
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
      const { user, onSave } = await renderEditing();
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
      const { user } = await renderEditing();
      const title = screen.getByRole('textbox', { name: 'Nazwa' });

      await user.type(title, ' 2');
      expect(screen.getByRole('button', { name: 'Zapisz' })).toBeEnabled();
      await user.click(screen.getByRole('button', { name: 'Przywróć' }));

      expect(title).toHaveValue('Algorytmy');
      expect(screen.getByRole('button', { name: 'Zapisz' })).toBeDisabled();
    });

    it('rejects an empty title', async () => {
      const { user, onSave } = await renderEditing();
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
      const { user, onSave } = await renderEditing();
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
      await renderEditing();
      expect(screen.getByRole('textbox', { name: 'Opis' })).toHaveAttribute(
        'maxlength',
        '5000',
      );
    });

    it('shows an API error under the form', async () => {
      const { user, onSave } = await renderEditing();
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
      const { user, onSave, onNavigate } = await renderEditing();
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
    it('offers Delete playlist next to Edit in the profile header', async () => {
      await renderLoaded();
      const edit = screen.getByRole('button', { name: 'Edytuj playlistę' });
      const remove = screen.getByRole('button', { name: 'Usuń playlistę' });

      expect(remove.closest('.profile__actions')).toBe(
        edit.closest('.profile__actions'),
      );
      expect(remove.closest('.profile__actions')).not.toBeNull();
      // Edycja stoi przed usuwaniem
      expect(
        edit.compareDocumentPosition(remove) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

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
      // Data publikacji filmu na YouTube stoi przy kanale; film bez daty jej nie ma
      expect(within(first).getByRole('rowheader')).toHaveTextContent(
        'Quicksort',
      );
      expect(
        within(first)
          .getAllByRole('cell')
          .map((cell) => cell.textContent),
      ).toEqual([
        '',
        '1',
        '',
        'Michael Sambol',
        '2016-08-11',
        'Usuń „Quicksort”',
      ]);
      expect(
        screen.getAllByRole('columnheader').map((header) => header.textContent),
      ).toEqual([
        'Kolejność',
        'Nr',
        'Miniatura',
        'Tytuł',
        'Kanał',
        'Opublikowano',
        'Akcje',
      ]);
      expect(first.querySelector('time')).toHaveAttribute(
        'datetime',
        '2016-08-11',
      );
      expect(first.querySelector('time')).toHaveAttribute(
        'title',
        'Data publikacji na YouTube',
      );
      expect(item('Big O').querySelector('time')).toBeNull();
      expect(item('Big O')).toHaveTextContent('CS Dojo');
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
      expect(handleOf('Quicksort')).toHaveAttribute(
        'title',
        'Przeciągnij albo użyj strzałek w górę i w dół, aby zmienić kolejność',
      );
      // Kolejność zmienia tylko uchwyt: osobnych przycisków w górę i w dół już nie ma
      expect(
        screen.queryByRole('button', { name: /^W (górę|dół)/ }),
      ).not.toBeInTheDocument();
    });

    it('ignores an arrow that would move a video past the edge of the list', async () => {
      const { user } = await renderLoaded();

      await pressOnHandle(user, 'Quicksort', 'ArrowUp');
      await pressOnHandle(user, 'Grafy', 'ArrowDown');

      expect(videoTitles()).toEqual(['Quicksort', 'Big O', 'Grafy']);
      expect(youtube.movePlaylistItem).not.toHaveBeenCalled();
    });

    it('keeps the focus on the handle after a keyboard move', async () => {
      youtube.movePlaylistItem.mockResolvedValue(undefined);
      const { user } = await renderLoaded();

      await pressOnHandle(user, 'Quicksort', 'ArrowDown');

      await waitFor(() => expect(handleOf('Quicksort')).toHaveFocus());
      expect(handleOf('Quicksort')).not.toHaveAttribute('aria-disabled');
    });

    describe('sorting', () => {
      function header(name: string): HTMLElement {
        const found = screen
          .getAllByRole('columnheader')
          .find((item) => item.textContent === name);
        if (!found) {
          throw new Error(`No column header ${name}`);
        }
        return found;
      }

      // Komórka z numerem ma własną klasę: kolumna uchwytów znika przy sortowaniu po innej kolumnie
      function numbers(): string[] {
        return [...document.querySelectorAll('.video-item__cell--number')].map(
          (cell) => cell.textContent ?? '',
        );
      }

      it('starts in the playlist order with a sort icon on every sortable column', async () => {
        await renderLoaded();

        expect(header('Nr')).toHaveAttribute('aria-sort', 'ascending');
        for (const name of ['Nr', 'Tytuł', 'Kanał', 'Opublikowano']) {
          expect(header(name).querySelector('.sort-icon')).not.toBeNull();
        }
        for (const name of ['Kolejność', 'Miniatura', 'Akcje']) {
          expect(header(name).querySelector('.sort-icon')).toBeNull();
        }
        expect(header('Nr').querySelector('.sort-icon')).toHaveClass(
          'sort-icon--asc',
        );
      });

      it('sorts by a clicked header and keeps the playlist numbers', async () => {
        const { user } = await renderLoaded();

        await user.click(within(header('Tytuł')).getByRole('button'));

        expect(videoTitles()).toEqual(['Big O', 'Grafy', 'Quicksort']);
        expect(numbers()).toEqual(['2', '3', '1']);
        expect(header('Tytuł')).toHaveAttribute('aria-sort', 'ascending');
        expect(header('Nr')).not.toHaveAttribute('aria-sort');

        await user.click(within(header('Tytuł')).getByRole('button'));

        expect(videoTitles()).toEqual(['Quicksort', 'Grafy', 'Big O']);
        expect(header('Tytuł')).toHaveAttribute('aria-sort', 'descending');
      });

      it('removes the drag handles while the table is sorted by another column', async () => {
        youtube.movePlaylistItem.mockResolvedValue(undefined);
        const { user } = await renderLoaded();

        await user.click(within(header('Tytuł')).getByRole('button'));

        // Bez kolejności z playlisty przenoszenie nie ma sensu, więc uchwytów i ich kolumny nie ma wcale
        expect(
          screen.queryByRole('button', { name: /^Przenieś/ }),
        ).not.toBeInTheDocument();
        expect(
          screen.getAllByRole('columnheader').map((item) => item.textContent),
        ).toEqual([
          'Nr',
          'Miniatura',
          'Tytuł',
          'Kanał',
          'Opublikowano',
          'Akcje',
        ]);
        expect(within(item('Big O')).getAllByRole('cell')).toHaveLength(5);

        await user.click(within(header('Nr')).getByRole('button'));

        expect(videoTitles()).toEqual(['Quicksort', 'Big O', 'Grafy']);
        expect(handleOf('Big O')).not.toHaveAttribute('aria-disabled');
        await pressOnHandle(user, 'Big O', 'ArrowDown');
        expect(youtube.movePlaylistItem).toHaveBeenCalledTimes(1);
      });

      it('keeps the handles but switches them off in the reversed playlist order', async () => {
        const { user } = await renderLoaded();

        await user.click(within(header('Nr')).getByRole('button'));

        expect(header('Nr')).toHaveAttribute('aria-sort', 'descending');
        expect(handleOf('Big O')).toHaveAttribute('aria-disabled', 'true');
        expect(handleOf('Big O')).toHaveAttribute(
          'title',
          'Zmiana kolejności działa w kolejności z playlisty (Nr rosnąco)',
        );
        await pressOnHandle(user, 'Big O', 'ArrowDown');
        expect(youtube.movePlaylistItem).not.toHaveBeenCalled();
      });

      it('offers Clear sorting only while sorted and goes back to the playlist order', async () => {
        const { user } = await renderLoaded();
        expect(
          screen.queryByRole('button', { name: 'Wyczyść sortowanie' }),
        ).not.toBeInTheDocument();

        await user.click(within(header('Kanał')).getByRole('button'));
        await user.click(
          screen.getByRole('button', { name: 'Wyczyść sortowanie' }),
        );

        expect(videoTitles()).toEqual(['Quicksort', 'Big O', 'Grafy']);
        expect(header('Nr')).toHaveAttribute('aria-sort', 'ascending');
        expect(handleOf('Big O')).not.toHaveAttribute('aria-disabled');
        expect(
          screen.queryByRole('button', { name: 'Wyczyść sortowanie' }),
        ).not.toBeInTheDocument();
        // Przycisk zniknął, więc fokus przechodzi na nagłówek listy filmów
        expect(
          screen.getByRole('heading', { level: 3, name: 'Filmy (3)' }),
        ).toHaveFocus();
      });

      it('sorts through the select that replaces the headers on a phone', async () => {
        const { user } = await renderLoaded();
        const select = screen.getByRole('combobox', { name: 'Sortowanie' });

        expect(select).toHaveValue('position-asc');
        expect(
          within(select)
            .getAllByRole('option')
            .map((option) => option.textContent),
        ).toEqual([
          'Kolejność na playliście',
          'Kolejność na playliście: od końca',
          'Tytuł: A-Z',
          'Tytuł: Z-A',
          'Kanał: A-Z',
          'Kanał: Z-A',
          'Opublikowano: od najnowszych',
          'Opublikowano: od najstarszych',
        ]);

        await user.selectOptions(select, 'Kolejność na playliście: od końca');

        expect(videoTitles()).toEqual(['Grafy', 'Big O', 'Quicksort']);
        expect(header('Nr')).toHaveAttribute('aria-sort', 'descending');
      });

      it('moves the focus to the next row of the sorted view after a removal', async () => {
        youtube.removePlaylistItem.mockResolvedValue(undefined);
        const { user } = await renderLoaded();
        await user.click(within(header('Tytuł')).getByRole('button'));

        // W widoku posortowanym po tytule za „Big O” stoi „Grafy”
        await user.click(
          within(item('Big O')).getByRole('button', {
            name: 'Usuń „Big O”',
          }),
        );
        await user.click(
          within(item('Big O')).getByRole('button', { name: 'Usuń' }),
        );

        await waitFor(() =>
          expect(
            within(item('Grafy')).getByRole('button', {
              name: 'Usuń „Grafy”',
            }),
          ).toHaveFocus(),
        );
      });
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

      await screen.findByRole('table', { name: /^Filmy/ });
      expect(videoTitles()).toEqual(['Quicksort', 'Big O', 'Grafy']);
    });

    it('moves a video down at once and saves its new position', async () => {
      youtube.movePlaylistItem.mockResolvedValue(undefined);
      const { user, replaceVideos } = await renderLoaded();

      await pressOnHandle(user, 'Quicksort', 'ArrowDown');

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

      await pressOnHandle(user, 'Grafy', 'ArrowUp');

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

      await pressOnHandle(user, 'Quicksort', 'ArrowDown');

      expect(item('Quicksort')).toHaveTextContent('Pracuję...');
      expect(handleOf('Grafy')).toHaveAttribute('aria-disabled', 'true');
      await pressOnHandle(user, 'Grafy', 'ArrowUp');
      expect(youtube.movePlaylistItem).toHaveBeenCalledTimes(1);
      finish();
      await waitFor(() =>
        expect(handleOf('Grafy')).not.toHaveAttribute('aria-disabled'),
      );
    });

    it('reverts a failed move and explains it in the item', async () => {
      youtube.movePlaylistItem.mockRejectedValue(
        new ApiError('unknown', 'boom', 500),
      );
      const { user, replaceVideos } = await renderLoaded();

      await pressOnHandle(user, 'Quicksort', 'ArrowDown');

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
          name: 'Usuń „Big O”',
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
      // Fokus zostaje w miejscu usuniętego filmu, a nie skacze na nagłówek nad listą
      await waitFor(() =>
        expect(
          within(item('Grafy')).getByRole('button', {
            name: 'Usuń „Grafy”',
          }),
        ).toHaveFocus(),
      );
    });

    it('moves the focus to the previous video after removing the last one', async () => {
      youtube.removePlaylistItem.mockResolvedValue(undefined);
      const { user } = await renderLoaded();

      await user.click(
        within(item('Grafy')).getByRole('button', {
          name: 'Usuń „Grafy”',
        }),
      );
      await user.click(
        within(item('Grafy')).getByRole('button', { name: 'Usuń' }),
      );

      await waitFor(() =>
        expect(
          within(item('Big O')).getByRole('button', {
            name: 'Usuń „Big O”',
          }),
        ).toHaveFocus(),
      );
    });

    it('moves the focus to the heading after removing the only video', async () => {
      youtube.listPlaylistVideos.mockResolvedValue([quicksort]);
      youtube.removePlaylistItem.mockResolvedValue(undefined);
      const { user } = await renderLoaded();

      await user.click(
        within(item('Quicksort')).getByRole('button', {
          name: 'Usuń „Quicksort”',
        }),
      );
      await user.click(
        within(item('Quicksort')).getByRole('button', { name: 'Usuń' }),
      );

      await waitFor(() =>
        expect(
          screen.getByRole('heading', { level: 3, name: 'Filmy (0)' }),
        ).toHaveFocus(),
      );
    });

    it('cancels removing a video', async () => {
      const { user } = await renderLoaded();

      await user.click(
        within(item('Big O')).getByRole('button', {
          name: 'Usuń „Big O”',
        }),
      );
      await user.click(
        within(item('Big O')).getByRole('button', { name: 'Anuluj' }),
      );

      expect(
        within(item('Big O')).getByRole('button', {
          name: 'Usuń „Big O”',
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
          name: 'Usuń „Big O”',
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
        .getAllByRole('row')
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
          name: 'Usuń „niedostępny nr 2”',
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

      await pressOnHandle(user, 'niedostępny nr 2', 'ArrowDown');

      expect(youtube.movePlaylistItem).toHaveBeenCalledWith(
        'PL-algo',
        deleted,
        2,
      );
      expect(videoTitles()).toEqual(['Quicksort', 'Big O']);
      // Wiersz 0 to nagłówki tabeli, więc trzeci film ma indeks 3
      expect(screen.getAllByRole('row')[3]).toHaveClass(
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
      await screen.findByRole('table', { name: 'Videos (4)' });

      expect(
        screen.getAllByText('Unavailable video (deleted or private)'),
      ).toHaveLength(2);
      expect(
        screen.getByRole('button', { name: 'Remove unavailable (2)' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {
          name: 'Remove "unavailable #2"',
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
      await screen.findByRole('table', { name: /^Videos/ });

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
    await screen.findByRole('table', { name: 'Videos (3)' });

    expect(
      screen.getByRole('link', { name: 'All playlists' }),
    ).toBeInTheDocument();
    expect(meta()).toHaveTextContent('3 videos · Unlisted · 2023-03-05');
    await userEvent.click(
      screen.getByRole('button', { name: 'Edit playlist' }),
    );
    expect(screen.getByRole('textbox', { name: 'Title' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Move "Quicksort"' }),
    ).toHaveAttribute(
      'title',
      'Drag, or use the up and down arrow keys, to reorder',
    );
    expect(
      screen.getByRole('button', { name: 'Delete playlist' }),
    ).toBeInTheDocument();
  });
});
