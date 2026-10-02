import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { useGoogleAuth, type GoogleAuth } from './auth/useGoogleAuth';
import { getGoogleClientId } from './config';
import { makePlaylist } from './test/playlistFactory';
import { renderWithI18n } from './test/renderWithI18n';
import {
  deletePlaylist,
  getMyChannel,
  listMyPlaylists,
  listPlaylistVideos,
  updatePlaylist,
} from './youtube/api';
import { ApiError } from './youtube/types';

vi.mock('./config', () => ({
  getGoogleClientId: vi.fn(),
  YOUTUBE_SCOPE: 'scope',
}));
vi.mock('./auth/useGoogleAuth', () => ({ useGoogleAuth: vi.fn() }));
vi.mock('./youtube/api', () => ({
  getMyChannel: vi.fn(),
  listMyPlaylists: vi.fn(),
  listPlaylistVideos: vi.fn(),
  updatePlaylist: vi.fn(),
  deletePlaylist: vi.fn(),
  removePlaylistItem: vi.fn(),
  movePlaylistItem: vi.fn(),
  addPlaylistItem: vi.fn(),
}));

const zupa = makePlaylist({
  id: 'a',
  title: 'Zupa',
  publishedAt: '2026-01-01T00:00:00Z',
});
const joga = makePlaylist({
  id: 'b',
  title: 'Joga',
  publishedAt: '2026-02-01T00:00:00Z',
});

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

function setHash(hash: string) {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  window.location.hash = '';
  vi.mocked(getGoogleClientId).mockReturnValue('client-1');
  vi.mocked(useGoogleAuth).mockReturnValue(auth());
  vi.mocked(getMyChannel).mockResolvedValue(null);
  vi.mocked(listMyPlaylists).mockResolvedValue([zupa, joga]);
  vi.mocked(listPlaylistVideos).mockResolvedValue([]);
});

afterEach(() => {
  window.location.hash = '';
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

    expect(
      await screen.findByRole('table', { name: 'Twoje playlisty (2)' }),
    ).toBeInTheDocument();
    expect(listMyPlaylists).toHaveBeenCalledWith('tok-1');
    await userEvent.click(screen.getByRole('button', { name: 'Wyloguj' }));
    expect(state.signOut).toHaveBeenCalledWith();
  });

  it('opens a playlist profile from its hash and goes back to the table', async () => {
    vi.mocked(useGoogleAuth).mockReturnValue(
      auth({ status: 'signedIn', token: 'tok-1' }),
    );
    window.location.hash = '#/playlists/a';
    renderWithI18n(<App />);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Zupa' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Wszystkie playlisty' }),
    ).toHaveAttribute('href', '#/');
    // Lista playlist jest wspólna dla obu widoków i nie wczytuje się drugi raz
    expect(listMyPlaylists).toHaveBeenCalledTimes(1);

    setHash('#/');

    expect(
      await screen.findByRole('table', { name: 'Twoje playlisty (2)' }),
    ).toBeInTheDocument();
    expect(listMyPlaylists).toHaveBeenCalledTimes(1);
  });

  it('explains a profile address of a playlist that is not on the list', async () => {
    vi.mocked(useGoogleAuth).mockReturnValue(
      auth({ status: 'signedIn', token: 'tok-1' }),
    );
    window.location.hash = '#/playlists/unknown';
    renderWithI18n(<App />);

    expect(
      await screen.findByText(/^Nie znaleziono playlisty\./),
    ).toBeInTheDocument();
  });

  it('returns to the list with a notice when the saved playlist is gone', async () => {
    vi.mocked(useGoogleAuth).mockReturnValue(
      auth({ status: 'signedIn', token: 'tok-1' }),
    );
    vi.mocked(updatePlaylist).mockRejectedValue(
      new ApiError('notFound', 'gone', 404),
    );
    window.location.hash = '#/playlists/a';
    const user = userEvent.setup();
    renderWithI18n(<App />);
    await screen.findByRole('heading', { level: 2, name: 'Zupa' });

    await user.type(screen.getByRole('textbox', { name: 'Opis' }), '!');
    await user.click(screen.getByRole('button', { name: 'Zapisz' }));

    expect(
      await screen.findByRole('table', { name: 'Twoje playlisty (1)' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Tej playlisty już nie ma.')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Zupa' }),
    ).not.toBeInTheDocument();
  });

  it('drops the list notice once another playlist profile is opened', async () => {
    vi.mocked(useGoogleAuth).mockReturnValue(
      auth({ status: 'signedIn', token: 'tok-1' }),
    );
    vi.mocked(deletePlaylist).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithI18n(<App />);
    await screen.findByRole('table');

    await user.click(
      screen.getByRole('button', { name: /^Usuń playlistę Zupa/ }),
    );
    await user.click(screen.getByRole('button', { name: 'Usuń na stałe' }));
    expect(
      await screen.findByText('Usunięto playlistę „Zupa”.'),
    ).toBeInTheDocument();

    setHash('#/playlists/b');
    await screen.findByRole('heading', { level: 2, name: 'Joga' });
    setHash('#/');

    await screen.findByRole('table');
    expect(
      screen.queryByText('Usunięto playlistę „Zupa”.'),
    ).not.toBeInTheDocument();
  });

  it('links each playlist title in the table to its profile', async () => {
    vi.mocked(useGoogleAuth).mockReturnValue(
      auth({ status: 'signedIn', token: 'tok-1' }),
    );
    renderWithI18n(<App />);

    const link = await screen.findByRole('link', { name: 'Joga' });
    expect(link).toHaveAttribute('href', '#/playlists/b');

    setHash('#/playlists/b');

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Joga' }),
    ).toBeInTheDocument();
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
    vi.mocked(listMyPlaylists).mockRejectedValue(
      new ApiError('unauthorized', 'expired', 401),
    );
    renderWithI18n(<App />);

    await vi.waitFor(() =>
      expect(state.signOut).toHaveBeenCalledWith('sessionExpired'),
    );
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

  it('shows the channel chip in the header and the account section on the list', async () => {
    vi.mocked(useGoogleAuth).mockReturnValue(
      auth({ status: 'signedIn', token: 'tok-1' }),
    );
    vi.mocked(getMyChannel).mockResolvedValue({
      id: 'UC-me',
      title: 'Kanał testowy',
      handle: '@kanaltestowy',
      thumbnailUrl: null,
      publishedAt: '2012-03-04T10:00:00Z',
      subscriberCount: 1234,
      videoCount: 56,
      viewCount: 7890123,
    });
    renderWithI18n(<App />);

    const chip = await screen.findByRole('link', { name: 'Kanał testowy' });
    expect(chip).toHaveAttribute(
      'href',
      'https://www.youtube.com/channel/UC-me',
    );
    expect(chip.closest('header')).not.toBeNull();
    expect(
      await screen.findByRole('region', { name: 'Twój kanał' }),
    ).toBeVisible();
    expect(getMyChannel).toHaveBeenCalledWith('tok-1');
  });

  it('explains a missing client id in English', () => {
    vi.mocked(getGoogleClientId).mockReturnValue(null);
    renderWithI18n(<App />, 'en');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Missing the VITE_GOOGLE_CLIENT_ID variable. Setup instructions are in CONTRIBUTING.md.',
    );
  });
});
