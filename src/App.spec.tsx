import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { useGoogleAuth, type GoogleAuth } from './auth/useGoogleAuth';
import { getGoogleClientId } from './config';
import { renderWithI18n } from './test/renderWithI18n';

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
    renderWithI18n(<App />);
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'YouTube Playlist Manager',
      }),
    ).toBeInTheDocument();
  });

  it('shows the app icon as a decorative image inside the title', () => {
    renderWithI18n(<App />);
    const heading = screen.getByRole('heading', { level: 1 });
    const logo = heading.querySelector('img');
    expect(logo).not.toBeNull();
    expect(logo).toHaveAttribute('alt', '');
    expect(logo?.getAttribute('src')).toMatch(/favicon\.svg$/);
  });

  it('renders a centered footer with attribution links on the login screen', () => {
    renderWithI18n(<App />);
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveTextContent(
      'Aplikacja nie ma serwera: Twoje playlisty i sesja zostają w tej karcie przeglądarki.',
    );
    expect(footer).toHaveTextContent(
      'Działa z YouTube · Autor: Piotr Kowalski · Licencja MIT',
    );
    const links = [
      ['YouTube', 'https://www.youtube.com'],
      ['Piotr Kowalski', 'https://piecioshka.pl/'],
      ['Licencja MIT', 'https://piecioshka.mit-license.org'],
    ];
    for (const [name, href] of links) {
      const link = within(footer).getByRole('link', { name });
      expect(link).toHaveAttribute('href', href);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noreferrer');
    }
  });

  it('explains a missing client id', () => {
    vi.mocked(getGoogleClientId).mockReturnValue(null);
    renderWithI18n(<App />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'VITE_GOOGLE_CLIENT_ID',
    );
    expect(useGoogleAuth).not.toHaveBeenCalled();
  });

  it('signs in from the login screen', async () => {
    const state = auth();
    vi.mocked(useGoogleAuth).mockReturnValue(state);
    renderWithI18n(<App />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Zaloguj przez Google' }),
    );

    expect(useGoogleAuth).toHaveBeenCalledWith('client-1');
    expect(state.signIn).toHaveBeenCalledTimes(1);
  });

  it('disables sign-in while Google is loading', () => {
    vi.mocked(useGoogleAuth).mockReturnValue(auth({ status: 'loading' }));
    renderWithI18n(<App />);
    expect(
      screen.getByRole('button', { name: 'Wczytywanie...' }),
    ).toBeDisabled();
  });

  it('offers a retry when the Google script failed to load', async () => {
    const state = auth({ status: 'error', message: 'scriptFailed' });
    vi.mocked(useGoogleAuth).mockReturnValue(state);
    renderWithI18n(<App />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Nie udało się wczytać logowania Google. Sprawdź połączenie.',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Spróbuj ponownie' }),
    );

    expect(state.retry).toHaveBeenCalledTimes(1);
  });

  it('shows the auth message', () => {
    vi.mocked(useGoogleAuth).mockReturnValue(
      auth({ message: 'sessionExpired' }),
    );
    renderWithI18n(<App />);
    expect(
      screen.getByText('Sesja wygasła, zaloguj się ponownie.'),
    ).toBeInTheDocument();
  });

  it('shows playlists and signs out when signed in', async () => {
    const state = auth({ status: 'signedIn', token: 'tok-1' });
    vi.mocked(useGoogleAuth).mockReturnValue(state);
    renderWithI18n(<App />);

    expect(screen.getByText('Lista dla tok-1')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Wyloguj' }));
    expect(state.signOut).toHaveBeenCalledWith();
  });

  it('switches between the dark and the light theme', async () => {
    localStorage.clear();
    renderWithI18n(<App />);
    const toggle = screen.getByRole('button', { name: 'Ciemny motyw' });

    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.dataset.theme).toBe('dark');

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement.dataset.theme).toBe('light');

    await userEvent.click(toggle);
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('offers the theme switch next to the sign-out button', () => {
    vi.mocked(useGoogleAuth).mockReturnValue(
      auth({ status: 'signedIn', token: 'tok-1' }),
    );
    renderWithI18n(<App />);
    expect(
      screen.getByRole('button', { name: 'Ciemny motyw' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wyloguj' })).toBeInTheDocument();
  });

  it('signs out with a message when the session expires', async () => {
    const state = auth({ status: 'signedIn', token: 'tok-1' });
    vi.mocked(useGoogleAuth).mockReturnValue(state);
    renderWithI18n(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Symuluj 401' }));
    expect(state.signOut).toHaveBeenCalledWith('sessionExpired');
  });

  it('starts in Polish', () => {
    renderWithI18n(<App />);
    expect(document.documentElement.lang).toBe('pl');
    expect(screen.getByRole('combobox', { name: 'Język' })).toHaveValue('pl');
    expect(
      screen.getByRole('button', { name: 'Zaloguj przez Google' }),
    ).toBeInTheDocument();
  });

  it('switches the interface to English and remembers it', async () => {
    localStorage.clear();
    renderWithI18n(<App />);

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Język' }),
      'English',
    );

    expect(
      screen.getByRole('button', { name: 'Sign in with Google' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Language' })).toHaveValue(
      'en',
    );
    expect(screen.getByRole('button', { name: 'Dark theme' })).toBeVisible();
    expect(localStorage.getItem('youtube-playlist-manager.locale')).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('labels each language in its own language', () => {
    renderWithI18n(<App />, 'en');
    const options = within(
      screen.getByRole('combobox', { name: 'Language' }),
    ).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'Polski',
      'English',
    ]);
    expect(options.map((option) => option.getAttribute('lang'))).toEqual([
      'pl',
      'en',
    ]);
  });

  it('translates the header, the footer and auth messages to English', () => {
    vi.mocked(useGoogleAuth).mockReturnValue(
      auth({ status: 'error', message: 'scriptFailed' }),
    );
    renderWithI18n(<App />, 'en');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not load Google sign-in. Check your connection.',
    );
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      'Works with YouTube · Author: Piotr Kowalski · MIT License',
    );
  });

  it('shows the sign-out button in English', () => {
    vi.mocked(useGoogleAuth).mockReturnValue(
      auth({ status: 'signedIn', token: 'tok-1' }),
    );
    renderWithI18n(<App />, 'en');
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeVisible();
  });

  it('explains a missing client id in English', () => {
    vi.mocked(getGoogleClientId).mockReturnValue(null);
    renderWithI18n(<App />, 'en');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Missing the VITE_GOOGLE_CLIENT_ID variable. Setup instructions are in CONTRIBUTING.md.',
    );
  });
});
