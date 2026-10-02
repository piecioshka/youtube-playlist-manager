import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makePlaylist } from '../test/playlistFactory';
import { renderWithI18n } from '../test/renderWithI18n';
import type { Locale } from '../i18n/messages';
import type { Playlist, PrivacyStatus } from '../youtube/types';
import { PlaylistRow } from './PlaylistRow';

function renderRow(overrides: Partial<Playlist> = {}, locale: Locale = 'pl') {
  const playlist = makePlaylist({
    id: 'PL1',
    title: 'Muzyka',
    itemCount: 3,
    privacyStatus: 'unlisted',
    publishedAt: '2026-03-01T12:00:00Z',
    ...overrides,
  });
  const onRename = vi
    .fn<(playlist: Playlist, newTitle: string) => Promise<void>>()
    .mockResolvedValue(undefined);
  const onDelete = vi
    .fn<(playlist: Playlist) => Promise<void>>()
    .mockResolvedValue(undefined);
  renderWithI18n(
    <table>
      <tbody>
        <PlaylistRow
          playlist={playlist}
          onRename={onRename}
          onDelete={onDelete}
        />
      </tbody>
    </table>,
    locale,
  );
  return { playlist, onRename, onDelete, user: userEvent.setup() };
}

describe('PlaylistRow', () => {
  it('shows the playlist details in table cells', () => {
    renderRow();

    const rowHeader = screen.getByRole('rowheader');
    const link = screen.getByRole('link', { name: 'Muzyka' });
    expect(rowHeader).toContainElement(link);
    // Tytuł prowadzi do profilu playlisty w aplikacji, link do YouTube jest na profilu
    expect(link).toHaveAttribute('href', '#/playlists/PL1');
    expect(link).not.toHaveAttribute('target');
    expect(link).toHaveAttribute('title', 'Muzyka');
    const cells = screen.getAllByRole('cell').map((cell) => cell.textContent);
    expect(cells.slice(0, 3)).toEqual(['3', 'Niepubliczna', '2026-03-01']);
  });

  it('marks a private playlist with a decorative lock', () => {
    renderRow({ privacyStatus: 'private' });

    const cell = screen.getByRole('cell', { name: 'Prywatna' });
    const lock = cell.querySelector('.playlist-row__lock');
    expect(lock).toHaveAttribute('aria-hidden', 'true');
    expect(lock).toHaveTextContent('🔒');
    expect(cell).toHaveTextContent('🔒 Prywatna');
  });

  const coloredStatuses: [PrivacyStatus, string, string][] = [
    ['public', 'Publiczna', 'privacy-status--public'],
    ['unlisted', 'Niepubliczna', 'privacy-status--unlisted'],
  ];

  it.each(coloredStatuses)(
    'colors the %s status so it stands out in the column',
    (privacyStatus, label, className) => {
      renderRow({ privacyStatus });

      expect(screen.getByText(label)).toHaveClass('privacy-status', className);
    },
  );

  it('gives Rename its own color, different from the red Delete next to it', () => {
    renderRow();

    expect(screen.getByRole('button', { name: /^Zmień nazwę/ })).toHaveClass(
      'button--rename',
    );
    expect(screen.getByRole('button', { name: /^Usuń playlistę/ })).toHaveClass(
      'button--danger',
    );
  });

  it('leaves the private status in the default color, marked by its lock', () => {
    renderRow({ privacyStatus: 'private' });

    expect(screen.getByText('Prywatna')).toHaveClass('privacy-status');
    expect(screen.getByText('Prywatna')).not.toHaveClass(
      'privacy-status--public',
      'privacy-status--unlisted',
    );
  });

  it('shows no lock for an unlisted playlist', () => {
    renderRow({ privacyStatus: 'unlisted' });

    expect(document.querySelector('.playlist-row__lock')).toBeNull();
  });

  it('shows a tiny thumbnail before the title link', () => {
    renderRow({ thumbnailUrl: 'https://img.example/pl1.jpg' });

    const rowHeader = screen.getByRole('rowheader');
    const image = rowHeader.querySelector('img');
    expect(image).toHaveAttribute('src', 'https://img.example/pl1.jpg');
    expect(image).toHaveAttribute('alt', '');
    expect(image).toHaveAttribute('width', '32');
    expect(image).toHaveAttribute('height', '18');
    const link = screen.getByRole('link', { name: 'Muzyka' });
    expect(image?.compareDocumentPosition(link) ?? 0).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(image?.parentElement).toBe(link.parentElement);
    expect(image?.parentElement).toHaveClass('playlist-row__name');
  });

  it('shows an empty placeholder when there is no thumbnail', () => {
    renderRow({ thumbnailUrl: null });

    const rowHeader = screen.getByRole('rowheader');
    expect(rowHeader.querySelector('img')).toBeNull();
    const placeholder = rowHeader.querySelector(
      '.playlist-row__thumbnail--empty',
    );
    expect(placeholder).toHaveAttribute('aria-hidden', 'true');
  });

  it('labels every data cell for the stacked phone layout', () => {
    renderRow();

    const labels = screen
      .getAllByRole('cell')
      .map((cell) => cell.getAttribute('data-label'));
    expect(labels.slice(0, 3)).toEqual(['Filmy', 'Widoczność', 'Utworzona']);
  });

  it('renames with Enter and returns focus to the rename button', async () => {
    const { user, onRename, playlist } = renderRow();

    await user.click(screen.getByRole('button', { name: /^Zmień nazwę/ }));
    const input = screen.getByRole('textbox', { name: 'Nowa nazwa playlisty' });
    expect(input).toHaveValue('Muzyka');
    expect(input).toHaveFocus();

    await user.clear(input);
    await user.type(input, 'Muzyka do pracy{Enter}');

    expect(onRename).toHaveBeenCalledWith(playlist, 'Muzyka do pracy');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Zmień nazwę/ })).toHaveFocus();
  });

  it('trims the title and skips the API when nothing changed', async () => {
    const { user, onRename } = renderRow();

    await user.click(screen.getByRole('button', { name: /^Zmień nazwę/ }));
    const input = screen.getByRole('textbox', { name: 'Nowa nazwa playlisty' });
    await user.clear(input);
    await user.type(input, '  Muzyka  {Enter}');

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('does not re-save a title that only differs by surrounding spaces', async () => {
    const { user, onRename } = renderRow({ title: '  Muzyka  ' });

    await user.click(screen.getByRole('button', { name: /^Zmień nazwę/ }));
    await user.type(
      screen.getByRole('textbox', { name: 'Nowa nazwa playlisty' }),
      '{Enter}',
    );

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('cancels editing with Escape', async () => {
    const { user, onRename } = renderRow();

    await user.click(screen.getByRole('button', { name: /^Zmień nazwę/ }));
    await user.type(
      screen.getByRole('textbox', { name: 'Nowa nazwa playlisty' }),
      'xyz{Escape}',
    );

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Muzyka' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Zmień nazwę/ })).toHaveFocus();
  });

  it('rejects an empty title', async () => {
    const { user, onRename } = renderRow();

    await user.click(screen.getByRole('button', { name: /^Zmień nazwę/ }));
    const input = screen.getByRole('textbox', { name: 'Nowa nazwa playlisty' });
    await user.clear(input);
    await user.type(input, '   {Enter}');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Nazwa nie może być pusta.',
    );
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(onRename).not.toHaveBeenCalled();
  });

  it('rejects a title longer than 150 characters', async () => {
    const { user, onRename } = renderRow();

    await user.click(screen.getByRole('button', { name: /^Zmień nazwę/ }));
    const input = screen.getByRole('textbox', { name: 'Nowa nazwa playlisty' });
    await user.clear(input);
    await user.click(input);
    await user.paste('a'.repeat(151));
    await user.keyboard('{Enter}');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Nazwa może mieć najwyżej 150 znaków.',
    );
    expect(onRename).not.toHaveBeenCalled();
  });

  it('shows the error from onRename and stays in edit mode', async () => {
    const { user, onRename } = renderRow();
    onRename.mockRejectedValueOnce(new Error('Brak połączenia z YouTube.'));

    await user.click(screen.getByRole('button', { name: /^Zmień nazwę/ }));
    const input = screen.getByRole('textbox', { name: 'Nowa nazwa playlisty' });
    await user.clear(input);
    await user.type(input, 'Nowa{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Brak połączenia z YouTube.',
    );
    expect(input).toHaveValue('Nowa');
  });

  it('calls onRename once while the request is pending', async () => {
    const { user, onRename } = renderRow();
    let finish: () => void = () => undefined;
    onRename.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );

    await user.click(screen.getByRole('button', { name: /^Zmień nazwę/ }));
    const input = screen.getByRole('textbox', { name: 'Nowa nazwa playlisty' });
    await user.clear(input);
    await user.type(input, 'Nowa{Enter}');

    const saveButton = screen.getByRole('button', { name: 'Zapisywanie...' });
    expect(saveButton).toBeDisabled();
    await user.type(input, '{Enter}');
    await user.click(saveButton);
    expect(onRename).toHaveBeenCalledTimes(1);

    finish();
    expect(
      await screen.findByRole('button', { name: /^Zmień nazwę/ }),
    ).toBeInTheDocument();
  });

  it('asks for confirmation before deleting', async () => {
    const { user, onDelete, playlist } = renderRow();

    await user.click(screen.getByRole('button', { name: /^Usuń playlistę/ }));

    expect(
      screen.getByRole('group', {
        name: 'Potwierdzenie usunięcia playlisty Muzyka',
      }),
    ).toHaveTextContent('Usunąć na stałe?');
    expect(screen.getByRole('button', { name: 'Anuluj' })).toHaveFocus();
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Usuń na stałe' }));
    expect(onDelete).toHaveBeenCalledWith(playlist);
  });

  it('cancels deleting and returns focus to the delete button', async () => {
    const { user, onDelete } = renderRow();

    await user.click(screen.getByRole('button', { name: /^Usuń playlistę/ }));
    await user.click(screen.getByRole('button', { name: 'Anuluj' }));

    expect(screen.queryByText(/na stałe\?$/)).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^Usuń playlistę/ }),
    ).toHaveFocus();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('shows the error from onDelete and keeps the confirmation', async () => {
    const { user, onDelete } = renderRow();
    onDelete.mockRejectedValueOnce(
      new Error('Wyczerpano dzienny limit YouTube API. Spróbuj jutro.'),
    );

    await user.click(screen.getByRole('button', { name: /^Usuń playlistę/ }));
    await user.click(screen.getByRole('button', { name: 'Usuń na stałe' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Wyczerpano dzienny limit YouTube API.',
    );
    expect(screen.getByRole('button', { name: 'Usuń na stałe' })).toBeEnabled();
  });

  describe('in English', () => {
    it('labels cells, buttons and the privacy status', () => {
      renderRow({ privacyStatus: 'private' }, 'en');

      const labels = screen
        .getAllByRole('cell')
        .map((cell) => cell.getAttribute('data-label'));
      expect(labels.slice(0, 3)).toEqual(['Videos', 'Visibility', 'Created']);
      expect(screen.getByRole('cell', { name: 'Private' })).toBeVisible();
      expect(
        screen.getByRole('button', { name: 'Rename playlist Muzyka' }),
      ).toBeVisible();
      expect(
        screen.getByRole('button', { name: 'Delete playlist Muzyka' }),
      ).toBeVisible();
    });

    it('validates the new title', async () => {
      const { user } = renderRow({}, 'en');

      await user.click(screen.getByRole('button', { name: /^Rename/ }));
      const input = screen.getByRole('textbox', { name: 'New playlist name' });
      await user.clear(input);
      await user.type(input, '   {Enter}');
      expect(screen.getByRole('alert')).toHaveTextContent(
        'The name cannot be empty.',
      );

      await user.click(input);
      await user.paste('a'.repeat(151));
      await user.keyboard('{Enter}');
      expect(screen.getByRole('alert')).toHaveTextContent(
        'The name can have at most 150 characters.',
      );
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible();
    });

    it('asks for confirmation before deleting', async () => {
      const { user } = renderRow({}, 'en');

      await user.click(
        screen.getByRole('button', { name: /^Delete playlist/ }),
      );

      expect(
        screen.getByRole('group', { name: 'Confirm deleting playlist Muzyka' }),
      ).toHaveTextContent('Delete permanently?');
    });
  });
});
