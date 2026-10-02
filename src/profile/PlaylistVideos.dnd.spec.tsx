import {
  createEvent,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makePlaylist } from '../test/playlistFactory';
import { renderWithI18n } from '../test/renderWithI18n';
import { makeVideo } from '../test/videoFactory';
import { listPlaylistVideos, movePlaylistItem } from '../youtube/api';
import { ApiError, type PlaylistVideo } from '../youtube/types';
import { PlaylistVideos } from './PlaylistVideos';

vi.mock('../youtube/api', () => ({
  addPlaylistItem: vi.fn(),
  listPlaylistVideos: vi.fn(),
  movePlaylistItem: vi.fn(),
  removePlaylistItem: vi.fn(),
}));

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

function dataTransfer() {
  return {
    effectAllowed: 'uninitialized',
    dropEffect: 'none',
    setData: vi.fn(),
    setDragImage: vi.fn(),
  };
}

async function renderVideos(list: PlaylistVideo[] = videos) {
  vi.mocked(listPlaylistVideos).mockResolvedValue(list);
  const onUnauthorized = vi.fn();
  renderWithI18n(
    <PlaylistVideos
      token="tok"
      playlist={playlist}
      videoIndex={{ replaceVideos: vi.fn() }}
      onUnauthorized={onUnauthorized}
      onUpdated={vi.fn()}
      onCountChange={vi.fn()}
    />,
    'pl',
  );
  await screen.findByRole('list', { name: /^Filmy/ });
  return { onUnauthorized, user: userEvent.setup() };
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

// Element zajmuje 0-100 px w pionie, więc środek to 50
function mockRect(element: HTMLElement) {
  element.getBoundingClientRect = () => new DOMRect(0, 0, 300, 100);
}

// jsdom nie ma DragEvent, więc clientY trzeba dopisać do zdarzenia ręcznie
function fireDrag(
  type: 'dragOver' | 'drop',
  title: string,
  clientY: number,
  transfer = dataTransfer(),
): boolean {
  const target = item(title);
  mockRect(target);
  const event = createEvent[type](target, { dataTransfer: transfer });
  Object.defineProperty(event, 'clientY', { value: clientY });
  return fireEvent(target, event);
}

function dragOver(title: string, clientY: number) {
  fireDrag('dragOver', title, clientY);
}

function dropOn(title: string, clientY: number) {
  fireDrag('drop', title, clientY);
}

beforeEach(() => {
  vi.mocked(listPlaylistVideos).mockReset();
  vi.mocked(movePlaylistItem).mockReset();
});

describe('drag and drop reordering', () => {
  it('starts a drag from the handle with move data and the row as the image', async () => {
    await renderVideos();
    const transfer = dataTransfer();

    fireEvent.dragStart(handle('Quicksort'), { dataTransfer: transfer });

    expect(transfer.effectAllowed).toBe('move');
    expect(transfer.setData).toHaveBeenCalledWith('text/plain', 'item-qs');
    expect(transfer.setDragImage).toHaveBeenCalledWith(
      item('Quicksort'),
      16,
      16,
    );
    expect(item('Quicksort')).toHaveClass('video-item--dragging');
  });

  it('moves the first video below the third and announces it', async () => {
    vi.mocked(movePlaylistItem).mockResolvedValue(undefined);
    await renderVideos();

    fireEvent.dragStart(handle('Quicksort'), { dataTransfer: dataTransfer() });
    dragOver('Grafy', 80);
    dropOn('Grafy', 80);

    expect(titles()).toEqual(['Big O', 'Grafy', 'Quicksort']);
    expect(movePlaylistItem).toHaveBeenCalledTimes(1);
    expect(movePlaylistItem).toHaveBeenCalledWith(
      'tok',
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
    vi.mocked(movePlaylistItem).mockResolvedValue(undefined);
    await renderVideos();

    fireEvent.dragStart(handle('Quicksort'), { dataTransfer: dataTransfer() });
    dragOver('Grafy', 20);
    dropOn('Grafy', 20);

    expect(titles()).toEqual(['Big O', 'Quicksort', 'Grafy']);
    expect(movePlaylistItem).toHaveBeenCalledWith(
      'tok',
      'PL-algo',
      quicksort,
      1,
    );
  });

  it('does nothing when dropped on itself', async () => {
    await renderVideos();

    fireEvent.dragStart(handle('Big O'), { dataTransfer: dataTransfer() });
    dragOver('Big O', 20);
    expect(item('Big O')).not.toHaveClass('video-item--drop-before');
    dropOn('Big O', 20);

    expect(titles()).toEqual(['Quicksort', 'Big O', 'Grafy']);
    expect(movePlaylistItem).not.toHaveBeenCalled();
  });

  it('does nothing when the drop would not change the order', async () => {
    await renderVideos();

    fireEvent.dragStart(handle('Quicksort'), { dataTransfer: dataTransfer() });
    dragOver('Big O', 20);
    expect(item('Big O')).not.toHaveClass('video-item--drop-before');
    dropOn('Big O', 20);

    expect(titles()).toEqual(['Quicksort', 'Big O', 'Grafy']);
    expect(movePlaylistItem).not.toHaveBeenCalled();
  });

  it('reverts a failed move and shows the error on that item', async () => {
    vi.mocked(movePlaylistItem).mockRejectedValue(
      new ApiError('unknown', 'boom', 500),
    );
    await renderVideos();

    fireEvent.dragStart(handle('Quicksort'), { dataTransfer: dataTransfer() });
    dragOver('Grafy', 80);
    dropOn('Grafy', 80);

    expect(
      await within(item('Quicksort')).findByRole('alert'),
    ).toHaveTextContent('Coś poszło nie tak (HTTP 500).');
    expect(titles()).toEqual(['Quicksort', 'Big O', 'Grafy']);
    expect(screen.queryByText(/^Przeniesiono/)).not.toBeInTheDocument();
  });

  it('reports an expired session on a failed drop', async () => {
    vi.mocked(movePlaylistItem).mockRejectedValue(
      new ApiError('unauthorized', 'expired', 401),
    );
    const { onUnauthorized } = await renderVideos();

    fireEvent.dragStart(handle('Quicksort'), { dataTransfer: dataTransfer() });
    dragOver('Grafy', 80);
    dropOn('Grafy', 80);

    await waitFor(() => expect(onUnauthorized).toHaveBeenCalled());
  });

  it('shows the drop indicator on dragover and clears it on dragend', async () => {
    await renderVideos();

    fireEvent.dragStart(handle('Quicksort'), { dataTransfer: dataTransfer() });
    dragOver('Grafy', 80);
    expect(item('Grafy')).toHaveClass('video-item--drop-after');
    dragOver('Grafy', 20);
    expect(item('Grafy')).toHaveClass('video-item--drop-before');
    expect(item('Grafy')).not.toHaveClass('video-item--drop-after');

    fireEvent.dragEnd(handle('Quicksort'));

    expect(item('Grafy')).not.toHaveClass('video-item--drop-before');
    expect(item('Quicksort')).not.toHaveClass('video-item--dragging');
  });

  it('clears the indicator when the pointer leaves the list', async () => {
    await renderVideos();

    fireEvent.dragStart(handle('Quicksort'), { dataTransfer: dataTransfer() });
    dragOver('Grafy', 80);
    fireEvent.dragLeave(screen.getByRole('list', { name: /^Filmy/ }));

    expect(item('Grafy')).not.toHaveClass('video-item--drop-after');
  });

  it('allows the drop only while a video is being dragged', async () => {
    await renderVideos();
    // fireEvent zwraca false, gdy ktoś wywołał preventDefault
    expect(fireDrag('dragOver', 'Grafy', 80)).toBe(true);

    fireEvent.dragStart(handle('Quicksort'), { dataTransfer: dataTransfer() });

    expect(fireDrag('dragOver', 'Grafy', 80)).toBe(false);
  });

  it('makes the handles draggable and disables them while an item is pending', async () => {
    let finish: () => void = () => {};
    vi.mocked(movePlaylistItem).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve(undefined);
        }),
    );
    const { user } = await renderVideos();
    expect(handle('Quicksort')).toHaveAttribute('draggable', 'true');

    await user.click(
      within(item('Quicksort')).getByRole('button', {
        name: 'W dół „Quicksort”',
      }),
    );

    expect(handle('Grafy')).toHaveAttribute('draggable', 'false');
    expect(handle('Grafy')).toHaveClass('video-item__handle--disabled');
    finish();
    await waitFor(() =>
      expect(handle('Grafy')).toHaveAttribute('draggable', 'true'),
    );
  });

  it('disables the handle of a single video', async () => {
    await renderVideos([quicksort]);

    expect(handle('Quicksort')).toHaveAttribute('draggable', 'false');
  });

  it('keeps the handle out of the accessibility tree', async () => {
    await renderVideos();

    expect(handle('Quicksort')).toHaveAttribute('aria-hidden', 'true');
  });

  it('keeps the buttons working and announces their moves', async () => {
    vi.mocked(movePlaylistItem).mockResolvedValue(undefined);
    const { user } = await renderVideos();

    await user.click(
      within(item('Quicksort')).getByRole('button', {
        name: 'W dół „Quicksort”',
      }),
    );

    expect(titles()).toEqual(['Big O', 'Quicksort', 'Grafy']);
    expect(movePlaylistItem).toHaveBeenCalledWith(
      'tok',
      'PL-algo',
      quicksort,
      1,
    );
    expect(
      await screen.findByText('Przeniesiono „Quicksort” na pozycję 2.'),
    ).toBeInTheDocument();
  });
});
