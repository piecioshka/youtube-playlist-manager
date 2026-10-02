import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../test/renderWithI18n';
import { ApiError } from '../youtube/types';
import { ProfileUnavailable } from './ProfileUnavailable';

describe('ProfileUnavailable', () => {
  it('waits for the playlist list', () => {
    renderWithI18n(
      <ProfileUnavailable
        loadState={{ status: 'loading' }}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText('Wczytywanie...')).toBeInTheDocument();
    expect(
      screen.queryByText(/^Nie znaleziono playlisty\./),
    ).not.toBeInTheDocument();
  });

  it('explains a playlist that is not on the list', () => {
    renderWithI18n(
      <ProfileUnavailable loadState={{ status: 'ready' }} onRetry={vi.fn()} />,
    );
    expect(screen.getByText(/^Nie znaleziono playlisty\./)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Wszystkie playlisty' }),
    ).toHaveAttribute('href', '#/');
  });

  it('shows the list error and retries', async () => {
    const onRetry = vi.fn();
    renderWithI18n(
      <ProfileUnavailable
        loadState={{
          status: 'error',
          error: new ApiError('network', 'offline'),
        }}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.queryByText(/^Nie znaleziono playlisty\./),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Spróbuj ponownie' }),
    );
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
