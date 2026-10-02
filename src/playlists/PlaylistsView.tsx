import {
  Fragment,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useI18n } from '../i18n/LocaleProvider';
import type { Messages } from '../i18n/messages';
import { normalizeText } from '../search/normalize';
import { SearchField } from '../search/SearchField';
import { searchPlaylists, type SearchResult } from '../search/searchPlaylists';
import { useVideoIndex, type VideoIndex } from '../search/useVideoIndex';
import {
  deletePlaylist,
  listMyPlaylists,
  renamePlaylist,
} from '../youtube/api';
import { errorMessage } from '../youtube/errorMessage';
import { ApiError, type Playlist } from '../youtube/types';
import {
  countByVisibility,
  filterByVisibility,
  type VisibilityFilter as Filter,
} from './filterPlaylists';
import { PlaylistRow } from './PlaylistRow';
import { PlaylistVideosRow } from './PlaylistVideosRow';
import {
  nextSort,
  sortPlaylists,
  type SortKey,
  type SortState,
} from './sortPlaylists';
import { readSort, writeSort } from './sortPreference';
import { VisibilityFilter } from './VisibilityFilter';
import {
  readVisibilityFilter,
  writeVisibilityFilter,
} from './visibilityPreference';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready' };

// Komunikat trzyma dane, a nie tekst, żeby zmiana języka tłumaczyła go od nowa
type Notice = { kind: 'deleted'; title: string } | { kind: 'missing' } | null;

type ColumnLabel =
  'columnTitle' | 'columnVideos' | 'columnPrivacy' | 'columnCreated';

type SortableColumn = { key: SortKey; label: ColumnLabel; numeric?: boolean };

const SORTABLE_COLUMNS: readonly SortableColumn[] = [
  { key: 'title', label: 'columnTitle' },
  { key: 'itemCount', label: 'columnVideos', numeric: true },
  { key: 'privacy', label: 'columnPrivacy' },
  { key: 'publishedAt', label: 'columnCreated' },
];

type PlaylistsViewProps = {
  token: string;
  onUnauthorized: () => void;
};

const MIN_QUERY_LENGTH = 2;

function isApiError(error: unknown, kind: ApiError['kind']): boolean {
  return error instanceof ApiError && error.kind === kind;
}

function indexStatus(index: VideoIndex, t: Messages): string {
  if (index.status === 'loading') {
    return t.indexingVideos(index.done, index.total);
  }
  if (index.status === 'ready' && index.failed > 0) {
    return t.indexFailed(index.failed);
  }
  return '';
}

function loadErrorMessage(error: unknown, t: Messages): string {
  // 404 przy wczytywaniu listy znaczy brak kanału, nie brak playlisty
  return isApiError(error, 'notFound') ? t.noChannel : errorMessage(error, t);
}

function noticeText(notice: Notice, t: Messages): string {
  if (notice === null) {
    return '';
  }
  return notice.kind === 'deleted'
    ? t.playlistDeleted(notice.title)
    : t.apiError.notFound;
}

export function PlaylistsView({ token, onUnauthorized }: PlaylistsViewProps) {
  const { t } = useI18n();
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [sort, setSort] = useState<SortState>(readSort);
  const [visibility, setVisibility] = useState<Filter>(readVisibilityFilter);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const notifyUnauthorized = useEffectEvent(() => onUnauthorized());
  const index = useVideoIndex({ token, playlists, onUnauthorized });

  useEffect(() => {
    let cancelled = false;
    listMyPlaylists(token).then(
      (items) => {
        if (cancelled) {
          return;
        }
        setPlaylists(items);
        setLoadState({ status: 'ready' });
      },
      (error: unknown) => {
        if (cancelled) {
          return;
        }
        if (isApiError(error, 'unauthorized')) {
          notifyUnauthorized();
          return;
        }
        setLoadState({ status: 'error', error });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [token, reloadKey]);

  const visibleCounts = useMemo(
    () => countByVisibility(playlists),
    [playlists],
  );
  const normalizedQuery = normalizeText(query);
  const searching = normalizedQuery.length >= MIN_QUERY_LENGTH;
  const videosByPlaylist = index.videosByPlaylist;
  // Kolejność: widoczność, wyszukiwanie, sortowanie
  const results = useMemo((): SearchResult[] => {
    const visible = filterByVisibility(playlists, visibility);
    const found = searching
      ? searchPlaylists(visible, normalizedQuery, videosByPlaylist)
      : visible.map((playlist) => ({ playlist, matchingVideos: [] }));
    const byId = new Map(found.map((result) => [result.playlist.id, result]));
    return sortPlaylists(
      found.map((result) => result.playlist),
      sort,
    ).flatMap((playlist) => byId.get(playlist.id) ?? []);
  }, [
    playlists,
    visibility,
    searching,
    normalizedQuery,
    videosByPlaylist,
    sort,
  ]);

  function handleSort(key: SortKey) {
    const next = nextSort(sort, key);
    setSort(next);
    writeSort(next);
  }

  function handleVisibility(next: Filter) {
    setVisibility(next);
    writeVisibilityFilter(next);
  }

  function handleRetry() {
    setLoadState({ status: 'loading' });
    setReloadKey((key) => key + 1);
  }

  function removePlaylist(id: string) {
    setPlaylists((current) => current.filter((item) => item.id !== id));
  }

  // Zwraca błąd do pokazania w wierszu, a przypadki dotyczące całego widoku obsługuje tutaj
  function toRowError(error: unknown, playlist: Playlist): Error {
    if (isApiError(error, 'unauthorized')) {
      onUnauthorized();
    }
    if (isApiError(error, 'notFound')) {
      removePlaylist(playlist.id);
      setNotice({ kind: 'missing' });
      headingRef.current?.focus();
    }
    return new Error(errorMessage(error, t));
  }

  async function handleRename(
    playlist: Playlist,
    newTitle: string,
  ): Promise<void> {
    try {
      const updated = await renamePlaylist(token, playlist, newTitle);
      setPlaylists((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setNotice(null);
    } catch (error) {
      throw toRowError(error, playlist);
    }
  }

  async function handleDelete(playlist: Playlist): Promise<void> {
    try {
      await deletePlaylist(token, playlist.id);
    } catch (error) {
      throw toRowError(error, playlist);
    }
    removePlaylist(playlist.id);
    setNotice({ kind: 'deleted', title: playlist.title });
    headingRef.current?.focus();
  }

  const heading =
    loadState.status !== 'ready'
      ? t.playlistsHeading
      : visibility === 'all' && !searching
        ? t.playlistsHeadingAll(playlists.length)
        : t.playlistsHeadingFiltered(results.length, playlists.length);

  return (
    <section className="playlists" aria-labelledby="playlists-heading">
      <div className="playlists__header">
        <h2
          id="playlists-heading"
          ref={headingRef}
          className="playlists__heading"
          tabIndex={-1}
        >
          {heading}
        </h2>
      </div>
      {loadState.status === 'ready' && playlists.length > 0 && (
        <SearchField
          value={query}
          status={indexStatus(index, t)}
          onChange={setQuery}
          onFocus={index.start}
        />
      )}
      {loadState.status === 'ready' && playlists.length > 0 && (
        <VisibilityFilter
          value={visibility}
          counts={visibleCounts}
          onChange={handleVisibility}
        />
      )}
      <p className="playlists__notice" role="status">
        {noticeText(notice, t)}
      </p>
      {loadState.status === 'loading' && (
        <p className="playlists__state">{t.loadingPlaylists}</p>
      )}
      {loadState.status === 'error' && (
        <div className="playlists__state notice notice--error" role="alert">
          <p className="playlists__error-text">
            {loadErrorMessage(loadState.error, t)}
          </p>
          <button type="button" className="button" onClick={handleRetry}>
            {t.retry}
          </button>
        </div>
      )}
      {loadState.status === 'ready' && playlists.length === 0 && (
        <p className="playlists__state">{t.noPlaylists}</p>
      )}
      {loadState.status === 'ready' &&
        playlists.length > 0 &&
        results.length === 0 && (
          <p className="playlists__state">
            {searching
              ? t.noResults(query.trim())
              : t.noPlaylistsWithVisibility}
          </p>
        )}
      {loadState.status === 'ready' && results.length > 0 && (
        // Jawne role: na telefonie wiersze dostają display: grid, co w części przeglądarek gubi semantykę tabeli
        <table
          className="playlists__table"
          role="table"
          aria-labelledby="playlists-heading"
        >
          <thead className="playlists__head" role="rowgroup">
            <tr role="row">
              {SORTABLE_COLUMNS.map((column) => {
                const active = sort.key === column.key;
                return (
                  <th
                    key={column.key}
                    className={
                      column.numeric
                        ? 'playlists__column playlists__column--number'
                        : 'playlists__column'
                    }
                    scope="col"
                    role="columnheader"
                    aria-sort={
                      active
                        ? sort.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : undefined
                    }
                  >
                    <button
                      type="button"
                      className="playlists__sort-button"
                      onClick={() => handleSort(column.key)}
                    >
                      {t[column.label]}
                      <span
                        className="playlists__sort-indicator"
                        aria-hidden="true"
                      >
                        {active ? (sort.direction === 'asc' ? '▲' : '▼') : ''}
                      </span>
                    </button>
                  </th>
                );
              })}
              <th className="playlists__column" scope="col" role="columnheader">
                <span className="visually-hidden">{t.columnActions}</span>
              </th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {results.map(({ playlist, matchingVideos }) => (
              <Fragment key={playlist.id}>
                <PlaylistRow
                  playlist={playlist}
                  onRename={handleRename}
                  onDelete={handleDelete}
                />
                {matchingVideos.length > 0 && (
                  <PlaylistVideosRow
                    playlist={playlist}
                    videos={matchingVideos}
                  />
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
