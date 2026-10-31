import type { VisibilityFilter } from '../playlists/filterPlaylists';
import type { SortOption } from '../playlists/sortPlaylists';
import type { VideoSortOption } from '../profile/sortVideos';
import type { ApiErrorKind, PrivacyStatus } from '../youtube/types';

export type Locale = 'pl' | 'en';

export const LOCALES: readonly Locale[] = ['pl', 'en'];

export const DEFAULT_LOCALE: Locale = 'pl';

export type AuthMessage =
  'signInFailed' | 'popupFailed' | 'scriptFailed' | 'sessionExpired';

// Polska odmiana: 1 film, 2-4 filmy (poza 12-14, także 22-24 itd.), reszta filmów
function polishPlural(
  count: number,
  one: string,
  few: string,
  many: string,
): string {
  const lastDigit = count % 10;
  const lastTwo = count % 100;
  if (count === 1) {
    return one;
  }
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    return few;
  }
  return many;
}

function polishMoreVideos(count: number): string {
  return `i jeszcze ${count} ${polishPlural(count, 'pasujący film', 'pasujące filmy', 'pasujących filmów')}`;
}

function englishPlural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

const pl = {
  appTitle: 'YouTube Playlist Manager',
  languageLabel: 'Zmień język na angielski',
  themeLabel: 'Przełącz motyw',
  githubLabel: 'Kod źródłowy na GitHubie',
  signOut: 'Wyloguj',
  accountLabel: 'Twój kanał',
  openChannel: 'Otwórz kanał na YouTube',
  statSubscribers: 'Subskrypcje',
  statVideos: 'Filmy',
  statViews: 'Wyświetlenia',
  statPlaylists: 'Playlisty',
  statCreated: 'Kanał od',
  thousandsSeparator: '\u00a0',
  retry: 'Spróbuj ponownie',
  renderError: 'Coś poszło nie tak i nie da się wyświetlić strony.',
  reloadPage: 'Odśwież stronę',
  loading: 'Wczytywanie...',
  genericError: 'Coś poszło nie tak.',

  missingClientIdBefore: 'Brakuje zmiennej ',
  missingClientIdAfter:
    '. Instrukcja konfiguracji jest w pliku CONTRIBUTING.md.',

  footerNoServer: 'Bez serwera: dane zostają w tej karcie',
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

  sortLabel: 'Sortowanie',
  sortOptions: {
    'title-asc': 'Tytuł: A-Z',
    'title-desc': 'Tytuł: Z-A',
    'itemCount-desc': 'Filmy: od największej liczby',
    'itemCount-asc': 'Filmy: od najmniejszej liczby',
    'privacy-asc': 'Widoczność: od publicznych',
    'privacy-desc': 'Widoczność: od prywatnych',
    'publishedAt-desc': 'Utworzona: od najnowszych',
    'publishedAt-asc': 'Utworzona: od najstarszych',
  } satisfies Record<SortOption, string>,

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
  openOnYouTube: 'Otwórz na YouTube',
  playlistNotFound: 'Nie znaleziono playlisty.',
  videoCount: (count: number) =>
    `${count} ${polishPlural(count, 'film', 'filmy', 'filmów')}`,
  playlistSettings: 'Ustawienia playlisty',
  titleLabel: 'Nazwa',
  descriptionLabel: 'Opis',
  visibilityLabel: 'Widoczność',
  reset: 'Przywróć',
  playlistSaved: 'Zapisano zmiany.',
  deletePlaylist: 'Usuń playlistę',
  videosHeading: (count: number) => `Filmy (${count})`,
  loadingVideos: 'Wczytywanie filmów...',
  playlistEmpty: 'Ta playlista jest pusta.',
  videoTarget: (title: string) => `„${title}”`,
  editPlaylist: 'Edytuj playlistę',
  videoSortOptions: {
    'position-asc': 'Kolejność na playliście',
    'position-desc': 'Kolejność na playliście: od końca',
    'title-asc': 'Tytuł: A-Z',
    'title-desc': 'Tytuł: Z-A',
    'channel-asc': 'Kanał: A-Z',
    'channel-desc': 'Kanał: Z-A',
    'published-desc': 'Opublikowano: od najnowszych',
    'published-asc': 'Opublikowano: od najstarszych',
    'duration-desc': 'Długość: od najdłuższych',
    'duration-asc': 'Długość: od najkrótszych',
  } satisfies Record<VideoSortOption, string>,
  reorderNeedsPlaylistOrder:
    'Zmiana kolejności działa w kolejności z playlisty (Nr rosnąco)',
  clearSorting: 'Wyczyść sortowanie',
  videoColumnOrder: 'Kolejność',
  videoColumnNumber: 'Nr',
  videoColumnThumbnail: 'Miniatura',
  videoColumnChannel: 'Kanał',
  videoColumnPublished: 'Opublikowano',
  videoColumnDuration: 'Długość',
  removeVideoShort: 'Usunąć z playlisty?',
  videoPublishedTitle: 'Data publikacji na YouTube',
  moveVideo: 'Przenieś',
  dragToReorder:
    'Przeciągnij albo użyj strzałek w górę i w dół, aby zmienić kolejność',
  videoMoved: (title: string, position: number) =>
    `Przeniesiono „${title}” na pozycję ${position}.`,
  removeVideoQuestion: (title: string) => `Usunąć film „${title}” z playlisty?`,
  remove: 'Usuń',
  working: 'Pracuję...',
  addVideoLabel: 'Dodaj film',
  addVideoPlaceholder: 'Link do filmu albo jego ID',
  addVideo: 'Dodaj',
  invalidVideo: 'To nie wygląda na link do filmu z YouTube.',
  videoAdded: 'Dodano film.',
  videoNotFound: 'Nie znaleziono takiego filmu na YouTube.',
  videoUnavailable: 'Film niedostępny (usunięty albo prywatny)',
  unavailableVideoName: (number: number) => `niedostępny nr ${number}`,
  removeUnavailable: (count: number) => `Usuń niedostępne (${count})`,
  removeUnavailableQuestion: (count: number) =>
    `Usunąć ${count} ${polishPlural(count, 'niedostępny film', 'niedostępne filmy', 'niedostępnych filmów')} z playlisty?`,
  removingUnavailable: (done: number, total: number) =>
    `Usuwanie niedostępnych filmów: ${done}/${total}`,
};

export type Messages = typeof pl;

const en: Messages = {
  appTitle: 'YouTube Playlist Manager',
  languageLabel: 'Switch the language to Polish',
  themeLabel: 'Toggle theme',
  githubLabel: 'Source code on GitHub',
  signOut: 'Sign out',
  accountLabel: 'Your channel',
  openChannel: 'Open the channel on YouTube',
  statSubscribers: 'Subscribers',
  statVideos: 'Videos',
  statViews: 'Views',
  statPlaylists: 'Playlists',
  statCreated: 'Channel since',
  thousandsSeparator: ',',
  retry: 'Try again',
  renderError: 'Something went wrong and the page cannot be shown.',
  reloadPage: 'Reload the page',
  loading: 'Loading...',
  genericError: 'Something went wrong.',

  missingClientIdBefore: 'Missing the ',
  missingClientIdAfter: ' variable. Setup instructions are in CONTRIBUTING.md.',

  footerNoServer: 'No server: your data stays in this tab',
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

  sortLabel: 'Sort by',
  sortOptions: {
    'title-asc': 'Title: A-Z',
    'title-desc': 'Title: Z-A',
    'itemCount-desc': 'Videos: most first',
    'itemCount-asc': 'Videos: fewest first',
    'privacy-asc': 'Visibility: public first',
    'privacy-desc': 'Visibility: private first',
    'publishedAt-desc': 'Created: newest first',
    'publishedAt-asc': 'Created: oldest first',
  },

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
  openOnYouTube: 'Open on YouTube',
  playlistNotFound: 'Playlist not found.',
  videoCount: (count) => `${count} ${englishPlural(count, 'video', 'videos')}`,
  playlistSettings: 'Playlist settings',
  titleLabel: 'Title',
  descriptionLabel: 'Description',
  visibilityLabel: 'Visibility',
  reset: 'Reset',
  playlistSaved: 'Changes saved.',
  deletePlaylist: 'Delete playlist',
  videosHeading: (count) => `Videos (${count})`,
  loadingVideos: 'Loading videos...',
  playlistEmpty: 'This playlist is empty.',
  videoTarget: (title) => `"${title}"`,
  editPlaylist: 'Edit playlist',
  videoSortOptions: {
    'position-asc': 'Playlist order',
    'position-desc': 'Playlist order: reversed',
    'title-asc': 'Title: A-Z',
    'title-desc': 'Title: Z-A',
    'channel-asc': 'Channel: A-Z',
    'channel-desc': 'Channel: Z-A',
    'published-desc': 'Published: newest first',
    'published-asc': 'Published: oldest first',
    'duration-desc': 'Duration: longest first',
    'duration-asc': 'Duration: shortest first',
  },
  reorderNeedsPlaylistOrder:
    'Reordering works in the playlist order (No. ascending)',
  clearSorting: 'Clear sorting',
  videoColumnOrder: 'Order',
  videoColumnNumber: 'No.',
  videoColumnThumbnail: 'Thumbnail',
  videoColumnChannel: 'Channel',
  videoColumnPublished: 'Published',
  videoColumnDuration: 'Duration',
  removeVideoShort: 'Remove from playlist?',
  videoPublishedTitle: 'Published on YouTube',
  moveVideo: 'Move',
  dragToReorder: 'Drag, or use the up and down arrow keys, to reorder',
  videoMoved: (title, position) => `Moved "${title}" to position ${position}.`,
  removeVideoQuestion: (title) => `Remove video "${title}" from the playlist?`,
  remove: 'Remove',
  working: 'Working...',
  addVideoLabel: 'Add a video',
  addVideoPlaceholder: 'Video link or ID',
  addVideo: 'Add',
  invalidVideo: 'This does not look like a YouTube video link.',
  videoAdded: 'Video added.',
  videoNotFound: 'No such video on YouTube.',
  videoUnavailable: 'Unavailable video (deleted or private)',
  unavailableVideoName: (number) => `unavailable #${number}`,
  removeUnavailable: (count) => `Remove unavailable (${count})`,
  removeUnavailableQuestion: (count) =>
    `Remove ${count} unavailable ${englishPlural(count, 'video', 'videos')} from the playlist?`,
  removingUnavailable: (done, total) =>
    `Removing unavailable videos: ${done}/${total}`,
};

export const messages: Record<Locale, Messages> = { pl, en };
