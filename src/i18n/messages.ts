import type { VisibilityFilter } from '../playlists/filterPlaylists';
import type { ApiErrorKind, PrivacyStatus } from '../youtube/types';

export type Locale = 'pl' | 'en';

export const LOCALES: readonly Locale[] = ['pl', 'en'];

export const DEFAULT_LOCALE: Locale = 'pl';

// Nazwa każdego języka w nim samym, niezależnie od bieżącego języka interfejsu
export const LOCALE_NAMES: Record<Locale, string> = {
  pl: 'Polski',
  en: 'English',
};

export type AuthMessage =
  'signInFailed' | 'popupFailed' | 'scriptFailed' | 'sessionExpired';

// 1 pasujący film, 2-4 pasujące filmy (poza 12-14), reszta pasujących filmów
function polishMoreVideos(count: number): string {
  const lastDigit = count % 10;
  const lastTwo = count % 100;
  if (count === 1) {
    return 'i jeszcze 1 pasujący film';
  }
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    return `i jeszcze ${count} pasujące filmy`;
  }
  return `i jeszcze ${count} pasujących filmów`;
}

function englishPlural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

const pl = {
  appTitle: 'YouTube Playlist Manager',
  languageLabel: 'Język',
  themeDark: 'Ciemny motyw',
  signOut: 'Wyloguj',
  retry: 'Spróbuj ponownie',
  loading: 'Wczytywanie...',
  genericError: 'Coś poszło nie tak.',

  missingClientIdBefore: 'Brakuje zmiennej ',
  missingClientIdAfter:
    '. Instrukcja konfiguracji jest w pliku CONTRIBUTING.md.',

  footerNoServer:
    'Aplikacja nie ma serwera: Twoje playlisty i sesja zostają w tej karcie przeglądarki.',
  footerWorksWith: 'Działa z',
  footerAuthor: 'Autor:',
  footerLicense: 'Licencja MIT',

  signInHeading: 'Zaloguj się',
  signInLead:
    'Połącz konto Google, żeby zobaczyć swoje playlisty na YouTube, posortować je, zmienić im nazwy albo je usunąć.',
  signInButton: 'Zaloguj przez Google',
  authMessage: {
    signInFailed: 'Nie udało się zalogować. Spróbuj ponownie.',
    popupFailed: 'Nie udało się otworzyć okna logowania Google.',
    scriptFailed: 'Nie udało się wczytać logowania Google. Sprawdź połączenie.',
    sessionExpired: 'Sesja wygasła, zaloguj się ponownie.',
  } satisfies Record<AuthMessage, string>,

  apiError: {
    unauthorized: 'Sesja wygasła, zaloguj się ponownie.',
    quotaExceeded: 'Wyczerpano dzienny limit YouTube API. Spróbuj jutro.',
    forbidden: 'YouTube odmówił dostępu do tej operacji.',
    notFound: 'Tej playlisty już nie ma.',
    network: 'Brak połączenia z YouTube.',
    unknown: 'Coś poszło nie tak.',
  } satisfies Record<ApiErrorKind, string>,
  apiErrorWithStatus: (status: number) =>
    `Coś poszło nie tak (HTTP ${status}).`,

  playlistsHeading: 'Twoje playlisty',
  playlistsHeadingAll: (total: number) => `Twoje playlisty (${total})`,
  playlistsHeadingFiltered: (shown: number, total: number) =>
    `Twoje playlisty (${shown} z ${total})`,
  loadingPlaylists: 'Wczytywanie playlist...',
  noChannel: 'Nie znaleziono kanału YouTube na tym koncie.',
  noPlaylists: 'Nie masz jeszcze żadnych playlist.',
  noPlaylistsWithVisibility: 'Brak playlist o tej widoczności.',
  noResults: (query: string) => `Brak wyników dla „${query}”.`,
  playlistDeleted: (title: string) => `Usunięto playlistę „${title}”.`,

  columnTitle: 'Tytuł',
  columnVideos: 'Filmy',
  columnPrivacy: 'Widoczność',
  columnCreated: 'Utworzona',
  columnActions: 'Akcje',

  privacy: {
    public: 'Publiczna',
    unlisted: 'Niepubliczna',
    private: 'Prywatna',
  } satisfies Record<PrivacyStatus, string>,

  visibilityFilterLabel: 'Filtruj po widoczności',
  visibilityFilter: {
    all: 'Wszystkie',
    public: 'Publiczne',
    unlisted: 'Niepubliczne',
    private: 'Prywatne',
  } satisfies Record<VisibilityFilter, string>,

  searchLabel: 'Szukaj playlist i filmów',
  searchPlaceholder: 'Szukaj playlist i filmów...',
  indexingVideos: (done: number, total: number) =>
    `Indeksowanie filmów: ${done}/${total} playlist`,
  indexFailed: (failed: number) =>
    `Nie udało się pobrać filmów z ${failed} playlist.`,
  matchingVideosLabel: (title: string) => `Pasujące filmy z playlisty ${title}`,
  moreMatchingVideos: polishMoreVideos,

  newTitleLabel: 'Nowa nazwa playlisty',
  save: 'Zapisz',
  saving: 'Zapisywanie...',
  cancel: 'Anuluj',
  rename: 'Zmień nazwę',
  renameTarget: (title: string) => `playlisty ${title}`,
  delete: 'Usuń',
  deleteTarget: (title: string) => `playlistę ${title}`,
  confirmDeleteLabel: (title: string) =>
    `Potwierdzenie usunięcia playlisty ${title}`,
  confirmDeleteQuestion: 'Usunąć na stałe?',
  deletePermanently: 'Usuń na stałe',
  deleting: 'Usuwanie...',
  titleEmpty: 'Nazwa nie może być pusta.',
  titleTooLong: (max: number) => `Nazwa może mieć najwyżej ${max} znaków.`,

  allPlaylists: 'Wszystkie playlisty',
};

export type Messages = typeof pl;

const en: Messages = {
  appTitle: 'YouTube Playlist Manager',
  languageLabel: 'Language',
  themeDark: 'Dark theme',
  signOut: 'Sign out',
  retry: 'Try again',
  loading: 'Loading...',
  genericError: 'Something went wrong.',

  missingClientIdBefore: 'Missing the ',
  missingClientIdAfter: ' variable. Setup instructions are in CONTRIBUTING.md.',

  footerNoServer:
    'This app has no server: your playlists and session stay in this browser tab.',
  footerWorksWith: 'Works with',
  footerAuthor: 'Author:',
  footerLicense: 'MIT License',

  signInHeading: 'Sign in',
  signInLead:
    'Connect your Google account to see your YouTube playlists, sort them, rename them or delete them.',
  signInButton: 'Sign in with Google',
  authMessage: {
    signInFailed: 'Could not sign in. Try again.',
    popupFailed: 'Could not open the Google sign-in window.',
    scriptFailed: 'Could not load Google sign-in. Check your connection.',
    sessionExpired: 'Your session has expired, sign in again.',
  },

  apiError: {
    unauthorized: 'Your session has expired, sign in again.',
    quotaExceeded:
      'The daily YouTube API quota is used up. Try again tomorrow.',
    forbidden: 'YouTube denied access to this operation.',
    notFound: 'This playlist no longer exists.',
    network: 'No connection to YouTube.',
    unknown: 'Something went wrong.',
  },
  apiErrorWithStatus: (status) => `Something went wrong (HTTP ${status}).`,

  playlistsHeading: 'Your playlists',
  playlistsHeadingAll: (total) => `Your playlists (${total})`,
  playlistsHeadingFiltered: (shown, total) =>
    `Your playlists (${shown} of ${total})`,
  loadingPlaylists: 'Loading playlists...',
  noChannel: 'No YouTube channel found on this account.',
  noPlaylists: 'You have no playlists yet.',
  noPlaylistsWithVisibility: 'No playlists with this visibility.',
  noResults: (query) => `No results for "${query}".`,
  playlistDeleted: (title) => `Playlist "${title}" deleted.`,

  columnTitle: 'Title',
  columnVideos: 'Videos',
  columnPrivacy: 'Visibility',
  columnCreated: 'Created',
  columnActions: 'Actions',

  privacy: {
    public: 'Public',
    unlisted: 'Unlisted',
    private: 'Private',
  },

  visibilityFilterLabel: 'Filter by visibility',
  visibilityFilter: {
    all: 'All',
    public: 'Public',
    unlisted: 'Unlisted',
    private: 'Private',
  },

  searchLabel: 'Search playlists and videos',
  searchPlaceholder: 'Search playlists and videos...',
  indexingVideos: (done, total) =>
    `Indexing videos: ${done}/${total} ${englishPlural(total, 'playlist', 'playlists')}`,
  indexFailed: (failed) =>
    `Could not fetch videos from ${failed} ${englishPlural(failed, 'playlist', 'playlists')}.`,
  matchingVideosLabel: (title) => `Matching videos from playlist ${title}`,
  moreMatchingVideos: (count) =>
    `and ${count} more matching ${englishPlural(count, 'video', 'videos')}`,

  newTitleLabel: 'New playlist name',
  save: 'Save',
  saving: 'Saving...',
  cancel: 'Cancel',
  rename: 'Rename',
  renameTarget: (title) => `playlist ${title}`,
  delete: 'Delete',
  deleteTarget: (title) => `playlist ${title}`,
  confirmDeleteLabel: (title) => `Confirm deleting playlist ${title}`,
  confirmDeleteQuestion: 'Delete permanently?',
  deletePermanently: 'Delete permanently',
  deleting: 'Deleting...',
  titleEmpty: 'The name cannot be empty.',
  titleTooLong: (max) => `The name can have at most ${max} characters.`,

  allPlaylists: 'All playlists',
};

export const messages: Record<Locale, Messages> = { pl, en };
