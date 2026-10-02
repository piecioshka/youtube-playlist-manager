import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makePlaylist } from '../test/playlistFactory';
import type { Playlist } from '../youtube/types';
import { PlaylistRow } from './PlaylistRow';

function renderRow(overrides: Partial<Playlist> = {}) {
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
  render(
    <ul>
      <PlaylistRow
        playlist={playlist}
        onRename={onRename}
        onDelete={onDelete}
      />
    </ul>,
  );
  return { playlist, onRename, onDelete, user: userEvent.setup() };
}

describe('PlaylistRow', () => {
  it('shows the playlist details', () => {
    renderRow({ thumbnailUrl: 'https://i.ytimg.com/PL1/mq.jpg' });

    const link = screen.getByRole('link', { name: 'Muzyka' });
    expect(link).toHaveAttribute(
      'href',
      'https://www.youtube.com/playlist?list=PL1',
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(
      screen.getByText('3 filmy · Niepubliczna · utworzona 2026-03-01'),
    ).toBeInTheDocument();
    expect(document.querySelector('img')).toHaveAttribute(
      'src',
      'https://i.ytimg.com/PL1/mq.jpg',
    );
  });

  it('renders an empty thumbnail box when there is no thumbnail', () => {
    renderRow({ thumbnailUrl: null });
    expect(document.querySelector('img')).toBeNull();
    expect(
      document.querySelector('.playlist-row__thumbnail--empty'),
    ).not.toBeNull();
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
      screen.getByText('Usunąć playlistę „Muzyka” na stałe?'),
    ).toBeInTheDocument();
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
});
