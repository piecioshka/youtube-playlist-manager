import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
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
  | { status: 'error'; message: string }
  | { status: 'ready' };

type SortableColumn = { key: SortKey; label: string; numeric?: boolean };

const SORTABLE_COLUMNS: readonly SortableColumn[] = [
  { key: 'title', label: 'Tytuł' },
  { key: 'itemCount', label: 'Filmy', numeric: true },
  { key: 'privacy', label: 'Widoczność' },
  { key: 'publishedAt', label: 'Utworzona' },
];

type PlaylistsViewProps = {
  token: string;
  onUnauthorized: () => void;
};

const NO_CHANNEL_MESSAGE = 'Nie znaleziono kanału YouTube na tym koncie.';

function isApiError(error: unknown, kind: ApiError['kind']): boolean {
  return error instanceof ApiError && error.kind === kind;
}

export function PlaylistsView({ token, onUnauthorized }: PlaylistsViewProps) {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [sort, setSort] = useState<SortState>(readSort);
  const [visibility, setVisibility] = useState<Filter>(readVisibilityFilter);
  const [notice, setNotice] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const notifyUnauthorized = useEffectEvent(() => onUnauthorized());

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
        // 404 przy wczytywaniu listy znaczy brak kanału, nie brak playlisty
        setLoadState({
          status: 'error',
          message: isApiError(error, 'notFound')
            ? NO_CHANNEL_MESSAGE
            : errorMessage(error),
        });
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
  const sortedPlaylists = useMemo(
    () => sortPlaylists(filterByVisibility(playlists, visibility), sort),
    [playlists, visibility, sort],
  );

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
      setNotice(errorMessage(error));
      headingRef.current?.focus();
    }
    return new Error(errorMessage(error));
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
      setNotice('');
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
    setNotice(`Usunięto playlistę „${playlist.title}”.`);
    headingRef.current?.focus();
  }

  const count =
    loadState.status !== 'ready'
      ? ''
      : visibility === 'all'
        ? ` (${playlists.length})`
        : ` (${sortedPlaylists.length} z ${playlists.length})`;

  return (
    <section className="playlists" aria-labelledby="playlists-heading">
      <div className="playlists__header">
        <h2
          id="playlists-heading"
          ref={headingRef}
          className="playlists__heading"
          tabIndex={-1}
        >
          Twoje playlisty{count}
        </h2>
      </div>
      {loadState.status === 'ready' && playlists.length > 0 && (
        <VisibilityFilter
          value={visibility}
          counts={visibleCounts}
          onChange={handleVisibility}
        />
      )}
      <p className="playlists__notice" role="status">
        {notice}
      </p>
      {loadState.status === 'loading' && (
        <p className="playlists__state">Wczytywanie playlist...</p>
      )}
      {loadState.status === 'error' && (
        <div className="playlists__state notice notice--error" role="alert">
          <p className="playlists__error-text">{loadState.message}</p>
          <button type="button" className="button" onClick={handleRetry}>
            Spróbuj ponownie
          </button>
        </div>
      )}
      {loadState.status === 'ready' && playlists.length === 0 && (
        <p className="playlists__state">Nie masz jeszcze żadnych playlist.</p>
      )}
      {loadState.status === 'ready' &&
        playlists.length > 0 &&
        sortedPlaylists.length === 0 && (
          <p className="playlists__state">Brak playlist o tej widoczności.</p>
        )}
      {loadState.status === 'ready' && sortedPlaylists.length > 0 && (
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
                      {column.label}
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
                <span className="visually-hidden">Akcje</span>
              </th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {sortedPlaylists.map((playlist) => (
              <PlaylistRow
                key={playlist.id}
                playlist={playlist}
                onRename={handleRename}
                onDelete={handleDelete}
              />
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
