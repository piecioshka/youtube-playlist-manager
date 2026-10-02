import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import {
  deletePlaylist,
  listMyPlaylists,
  renamePlaylist,
} from '../youtube/api';
import { errorMessage } from '../youtube/errorMessage';
import { ApiError, type Playlist } from '../youtube/types';
import { PlaylistRow } from './PlaylistRow';
import { SortControl } from './SortControl';
import { sortPlaylists, type SortMode } from './sortPlaylists';
import { readSortMode, writeSortMode } from './sortPreference';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready' };

type PlaylistsViewProps = {
  token: string;
  onUnauthorized: () => void;
};

function isApiError(error: unknown, kind: ApiError['kind']): boolean {
  return error instanceof ApiError && error.kind === kind;
}

export function PlaylistsView({ token, onUnauthorized }: PlaylistsViewProps) {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>(readSortMode);
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
        setLoadState({ status: 'error', message: errorMessage(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [token, reloadKey]);

  const sortedPlaylists = useMemo(
    () => sortPlaylists(playlists, sortMode),
    [playlists, sortMode],
  );

  function handleSortChange(mode: SortMode) {
    setSortMode(mode);
    writeSortMode(mode);
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

  const count = loadState.status === 'ready' ? ` (${playlists.length})` : '';

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
        <SortControl value={sortMode} onChange={handleSortChange} />
      </div>
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
      {loadState.status === 'ready' && sortedPlaylists.length === 0 && (
        <p className="playlists__state">Nie masz jeszcze żadnych playlist.</p>
      )}
      {loadState.status === 'ready' && sortedPlaylists.length > 0 && (
        <ul className="playlists__list">
          {sortedPlaylists.map((playlist) => (
            <PlaylistRow
              key={playlist.id}
              playlist={playlist}
              onRename={handleRename}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
