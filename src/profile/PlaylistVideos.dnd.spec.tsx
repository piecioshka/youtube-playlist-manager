import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFakeYouTube, type FakeYouTube } from '../test/fakeYouTube';
import { makePlaylist } from '../test/playlistFactory';
import { renderWithYouTube } from '../test/renderWithYouTube';
import { makeVideo } from '../test/videoFactory';
import { ApiError, type PlaylistVideo } from '../youtube/types';
import { PlaylistVideos } from './PlaylistVideos';

let youtube: FakeYouTube;

const playlist = makePlaylist({ id: 'PL-algo', itemCount: 3 });
const quicksort = makeVideo({
  itemId: 'item-qs',
  videoId: 'v-qs',
  title: 'Quicksort',
  position: 0,
});
const bigO = makeVideo({
  itemId: 'item-bigo',
  videoId: 'v-bigo',
  title: 'Big O',
  position: 1,
});
const graphs = makeVideo({
  itemId: 'item-graphs',
  videoId: 'v-graphs',
  title: 'Grafy',
  position: 2,
});
const videos = [quicksort, bigO, graphs];

const POINTER_ID = 7;
const setPointerCapture = vi.fn<(pointerId: number) => void>();

async function renderVideos(list: PlaylistVideo[] = videos) {
  youtube.listPlaylistVideos.mockResolvedValue(list);
  renderWithYouTube(
    <PlaylistVideos
      playlist={playlist}
      videoIndex={{ replaceVideos: vi.fn() }}
      onCountChange={vi.fn()}
    />,
    youtube,
    'pl',
  );
  await screen.findByRole('list', { name: /^Filmy/ });
  return { user: userEvent.setup() };
}

function titles(): string[] {
  return within(screen.getByRole('list', { name: /^Filmy/ }))
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

function handle(title: string): HTMLElement {
  const found = item(title).querySelector<HTMLElement>('.video-item__handle');
  if (!found) {
    throw new Error(`No handle ${title}`);
  }
  return found;
}

// jsdom nie liczy układu: wiersze stoją jeden pod drugim, każdy ma 100 px wysokości
function layOutRows() {
  screen.getAllByRole('listitem').forEach((row, index) => {
    row.getBoundingClientRect = () => new DOMRect(0, index * 100, 300, 100);
  });
}

// Zwraca false, gdy ktoś wywołał preventDefault
function grab(title: string, button = 0): boolean {
  layOutRows();
  return fireEvent.pointerDown(handle(title), {
    pointerId: POINTER_ID,
    button,
    clientY: 0,
  });
}

// Uchwyt przechwytuje wskaźnik, więc kolejne zdarzenia trafiają do niego, a nie do wiersza pod palcem
function dragTo(title: string, clientY: number) {
  fireEvent.pointerMove(handle(title), { pointerId: POINTER_ID, clientY });
}

function release(title: string, clientY: number) {
  fireEvent.pointerUp(handle(title), { pointerId: POINTER_ID, clientY });
}

beforeEach(() => {
  youtube = makeFakeYouTube();
  setPointerCapture.mockClear();
  // jsdom nie ma przechwytywania wskaźnika ani przewijania okna
  Element.prototype.setPointerCapture = setPointerCapture;
  vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('drag and drop reordering', () => {
  it('starts a drag from the handle and captures the pointer', async () => {
    await renderVideos();

    const notPrevented = grab('Quicksort');

    // Bez preventDefault mysz zaznaczałaby tekst pod kursorem
    expect(notPrevented).toBe(false);
    expect(setPointerCapture).toHaveBeenCalledWith(POINTER_ID);
    expect(item('Quicksort')).toHaveClass('video-item--dragging');
  });

  it('moves the first video below the third and announces it', async () => {
    youtube.movePlaylistItem.mockResolvedValue(undefined);
    await renderVideos();

    grab('Quicksort');
    dragTo('Quicksort', 280);
    release('Quicksort', 280);

    expect(titles()).toEqual(['Big O', 'Grafy', 'Quicksort']);
    expect(youtube.movePlaylistItem).toHaveBeenCalledTimes(1);
    expect(youtube.movePlaylistItem).toHaveBeenCalledWith(
      'PL-algo',
      quicksort,
      2,
    );
    expect(
      await screen.findByText('Przeniesiono „Quicksort” na pozycję 3.'),
    ).toBeInTheDocument();
    expect(item('Quicksort')).not.toHaveClass('video-item--dragging');
  });

  it('drops before the target when the pointer is in its upper half', async () => {
    youtube.movePlaylistItem.mockResolvedValue(undefined);
    await renderVideos();

    grab('Quicksort');
    dragTo('Quicksort', 220);
    release('Quicksort', 220);

    expect(titles()).toEqual(['Big O', 'Quicksort', 'Grafy']);
    expect(youtube.movePlaylistItem).toHaveBeenCalledWith(
      'PL-algo',
      quicksort,
      1,
    );
  });

  it('does nothing when dropped on itself', async () => {
    await renderVideos();

    grab('Big O');
    dragTo('Big O', 120);
    expect(item('Big O')).not.toHaveClass('video-item--drop-before');
    release('Big O', 120);

    expect(titles()).toEqual(['Quicksort', 'Big O', 'Grafy']);
    expect(youtube.movePlaylistItem).not.toHaveBeenCalled();
    expect(item('Big O')).not.toHaveClass('video-item--dragging');
  });

  it('does nothing when the drop would not change the order', async () => {
    await renderVideos();

    grab('Quicksort');
    dragTo('Quicksort', 120);
    expect(item('Big O')).not.toHaveClass('video-item--drop-before');
    release('Quicksort', 120);

    expect(titles()).toEqual(['Quicksort', 'Big O', 'Grafy']);
    expect(youtube.movePlaylistItem).not.toHaveBeenCalled();
  });

  it('reverts a failed move and shows the error on that item', async () => {
    youtube.movePlaylistItem.mockRejectedValue(
      new ApiError('unknown', 'boom', 500),
    );
    await renderVideos();

    grab('Quicksort');
    dragTo('Quicksort', 280);
    release('Quicksort', 280);

    expect(
      await within(item('Quicksort')).findByRole('alert'),
    ).toHaveTextContent('Coś poszło nie tak (HTTP 500).');
    expect(titles()).toEqual(['Quicksort', 'Big O', 'Grafy']);
    expect(screen.queryByText(/^Przeniesiono/)).not.toBeInTheDocument();
  });

  it('shows the drop indicator while moving and clears it when the drag is cancelled', async () => {
    await renderVideos();

    grab('Quicksort');
    dragTo('Quicksort', 280);
    expect(item('Grafy')).toHaveClass('video-item--drop-after');
    dragTo('Quicksort', 220);
    expect(item('Grafy')).toHaveClass('video-item--drop-before');
    expect(item('Grafy')).not.toHaveClass('video-item--drop-after');

    fireEvent.pointerCancel(handle('Quicksort'), { pointerId: POINTER_ID });

    expect(item('Grafy')).not.toHaveClass('video-item--drop-before');
    expect(item('Quicksort')).not.toHaveClass('video-item--dragging');
    expect(youtube.movePlaylistItem).not.toHaveBeenCalled();
  });

  it('clears the indicator and drops nothing when the pointer leaves the list', async () => {
    await renderVideos();

    grab('Quicksort');
    dragTo('Quicksort', 280);
    dragTo('Quicksort', 400);

    expect(item('Grafy')).not.toHaveClass('video-item--drop-after');

    release('Quicksort', 400);

    expect(titles()).toEqual(['Quicksort', 'Big O', 'Grafy']);
    expect(youtube.movePlaylistItem).not.toHaveBeenCalled();
  });

  it('ignores a move without a grab and a grab with the secondary button', async () => {
    await renderVideos();
    layOutRows();

    dragTo('Quicksort', 280);
    expect(item('Grafy')).not.toHaveClass('video-item--drop-after');

    grab('Quicksort', 2);
    expect(item('Quicksort')).not.toHaveClass('video-item--dragging');
    expect(setPointerCapture).not.toHaveBeenCalled();
  });

  it('scrolls the page when the pointer nears the edge of the window', async () => {
    await renderVideos();

    grab('Quicksort');
    dragTo('Quicksort', 10);
    expect(window.scrollBy).toHaveBeenLastCalledWith(0, -14);

    dragTo('Quicksort', window.innerHeight - 10);
    expect(window.scrollBy).toHaveBeenLastCalledWith(0, 14);

    vi.mocked(window.scrollBy).mockClear();
    dragTo('Quicksort', window.innerHeight / 2);
    expect(window.scrollBy).not.toHaveBeenCalled();
  });

  it('disables the handles while an item is pending', async () => {
    let finish: () => void = () => {};
    youtube.movePlaylistItem.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve(undefined);
        }),
    );
    const { user } = await renderVideos();
    expect(handle('Grafy')).not.toHaveClass('video-item__handle--disabled');

    handle('Quicksort').focus();
    await user.keyboard('{ArrowDown}');

    expect(handle('Grafy')).toHaveClass('video-item__handle--disabled');
    grab('Grafy');
    expect(item('Grafy')).not.toHaveClass('video-item--dragging');

    finish();
    await waitFor(() =>
      expect(handle('Grafy')).not.toHaveClass('video-item__handle--disabled'),
    );
  });

  it('disables the handle of a single video', async () => {
    await renderVideos([quicksort]);

    expect(handle('Quicksort')).toHaveClass('video-item__handle--disabled');
    grab('Quicksort');
    expect(item('Quicksort')).not.toHaveClass('video-item--dragging');
  });

  it('names the handle for assistive technology', async () => {
    await renderVideos();

    expect(handle('Quicksort')).toBe(
      screen.getByRole('button', { name: 'Przenieś „Quicksort”' }),
    );
  });

  it('moves with the arrow keys on the handle and announces it', async () => {
    youtube.movePlaylistItem.mockResolvedValue(undefined);
    const { user } = await renderVideos();

    handle('Quicksort').focus();
    await user.keyboard('{ArrowDown}');

    expect(titles()).toEqual(['Big O', 'Quicksort', 'Grafy']);
    expect(youtube.movePlaylistItem).toHaveBeenCalledWith(
      'PL-algo',
      quicksort,
      1,
    );
    expect(
      await screen.findByText('Przeniesiono „Quicksort” na pozycję 2.'),
    ).toBeInTheDocument();
  });
});
