import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { useGoogleAuth, type GoogleAuth } from './auth/useGoogleAuth';
import { getGoogleClientId } from './config';

vi.mock('./config', () => ({
  getGoogleClientId: vi.fn(),
  YOUTUBE_SCOPE: 'scope',
}));
vi.mock('./auth/useGoogleAuth', () => ({ useGoogleAuth: vi.fn() }));
vi.mock('./playlists/PlaylistsView', () => ({
  PlaylistsView: ({
    token,
    onUnauthorized,
  }: {
    token: string;
    onUnauthorized: () => void;
  }) => (
    <div>
      <p>Lista dla {token}</p>
      <button type="button" onClick={onUnauthorized}>
        Symuluj 401
      </button>
    </div>
  ),
}));

function auth(overrides: Partial<GoogleAuth> = {}): GoogleAuth {
  return {
    status: 'signedOut',
    token: null,
    message: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    retry: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getGoogleClientId).mockReturnValue('client-1');
  vi.mocked(useGoogleAuth).mockReturnValue(auth());
});

describe('App', () => {
  it('renders the app title', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'YouTube Playlist Manager',
      }),
    ).toBeInTheDocument();
  });

  it('explains a missing client id', () => {
    vi.mocked(getGoogleClientId).mockReturnValue(null);
    render(<App />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'VITE_GOOGLE_CLIENT_ID',
    );
    expect(useGoogleAuth).not.toHaveBeenCalled();
  });

  it('signs in from the login screen', async () => {
    const state = auth();
    vi.mocked(useGoogleAuth).mockReturnValue(state);
    render(<App />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Zaloguj przez Google' }),
    );

    expect(useGoogleAuth).toHaveBeenCalledWith('client-1');
    expect(state.signIn).toHaveBeenCalledTimes(1);
  });

  it('disables sign-in while Google is loading', () => {
    vi.mocked(useGoogleAuth).mockReturnValue(auth({ status: 'loading' }));
    render(<App />);
    expect(
      screen.getByRole('button', { name: 'Wczytywanie...' }),
    ).toBeDisabled();
  });

  it('offers a retry when the Google script failed to load', async () => {
    const state = auth({ status: 'error', message: 'Nie udało się wczytać.' });
    vi.mocked(useGoogleAuth).mockReturnValue(state);
    render(<App />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Nie udało się wczytać.',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Spróbuj ponownie' }),
    );

    expect(state.retry).toHaveBeenCalledTimes(1);
  });

  it('shows the auth message', () => {
    vi.mocked(useGoogleAuth).mockReturnValue(
      auth({ message: 'Sesja wygasła, zaloguj się ponownie.' }),
    );
    render(<App />);
    expect(
      screen.getByText('Sesja wygasła, zaloguj się ponownie.'),
    ).toBeInTheDocument();
  });

  it('shows playlists and signs out when signed in', async () => {
    const state = auth({ status: 'signedIn', token: 'tok-1' });
    vi.mocked(useGoogleAuth).mockReturnValue(state);
    render(<App />);

    expect(screen.getByText('Lista dla tok-1')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Wyloguj' }));
    expect(state.signOut).toHaveBeenCalledWith();
  });

  it('signs out with a message when the session expires', async () => {
    const state = auth({ status: 'signedIn', token: 'tok-1' });
    vi.mocked(useGoogleAuth).mockReturnValue(state);
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Symuluj 401' }));
    expect(state.signOut).toHaveBeenCalledWith(
      'Sesja wygasła, zaloguj się ponownie.',
    );
  });
});
