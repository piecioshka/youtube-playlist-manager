import { useEffect, useEffectEvent, useState } from 'react';
import type { Messages } from '../i18n/messages';
import {
  deletePlaylist,
  listMyPlaylists,
  renamePlaylist,
} from '../youtube/api';
import { errorMessage } from '../youtube/errorMessage';
import { ApiError, type Playlist } from '../youtube/types';

export type LoadState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready' };

// Komunikat trzyma dane, a nie tekst, żeby zmiana języka tłumaczyła go od nowa
export type Notice =
  { kind: 'deleted'; title: string } | { kind: 'missing' } | null;

export type PlaylistsState = {
  loadState: LoadState;
  playlists: Playlist[];
  notice: Notice;
  retry: () => void;
  removePlaylist: (id: string) => void;
  replacePlaylist: (playlist: Playlist) => void;
  markDeleted: (playlist: Playlist) => void;
  clearNotice: () => void;
  toRowError: (error: unknown, playlist: Playlist) => Error;
  handleRename: (playlist: Playlist, newTitle: string) => Promise<void>;
  handleDelete: (playlist: Playlist) => Promise<void>;
};

type UsePlaylistsOptions = {
  token: string;
  onUnauthorized: () => void;
  t: Messages;
};

export function isApiError(error: unknown, kind: ApiError['kind']): boolean {
  return error instanceof ApiError && error.kind === kind;
}

// Lista playlist wspólna dla tabeli i profilu playlisty: wczytana raz, zmiany z obu widoków trafiają tutaj
export function usePlaylists({
  token,
  onUnauthorized,
  t,
}: UsePlaylistsOptions): PlaylistsState {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [reloadKey, setReloadKey] = useState(0);
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
        setLoadState({ status: 'error', error });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [token, reloadKey]);

  function retry() {
    setLoadState({ status: 'loading' });
    setReloadKey((key) => key + 1);
  }

  function removePlaylist(id: string) {
    setPlaylists((current) => current.filter((item) => item.id !== id));
  }

  function replacePlaylist(playlist: Playlist) {
    setPlaylists((current) =>
      current.map((item) => (item.id === playlist.id ? playlist : item)),
    );
  }

  function markDeleted(playlist: Playlist) {
    removePlaylist(playlist.id);
    setNotice({ kind: 'deleted', title: playlist.title });
  }

  // Zwraca błąd do pokazania w wierszu, a przypadki dotyczące całej listy obsługuje tutaj
  function toRowError(error: unknown, playlist: Playlist): Error {
    if (isApiError(error, 'unauthorized')) {
      onUnauthorized();
    }
    if (isApiError(error, 'notFound')) {
      removePlaylist(playlist.id);
      setNotice({ kind: 'missing' });
    }
    return new Error(errorMessage(error, t));
  }

  async function handleRename(
    playlist: Playlist,
    newTitle: string,
  ): Promise<void> {
    try {
      replacePlaylist(await renamePlaylist(token, playlist, newTitle));
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
    markDeleted(playlist);
  }

  return {
    loadState,
    playlists,
    notice,
    retry,
    removePlaylist,
    replacePlaylist,
    markDeleted,
    clearNotice: () => setNotice(null),
    toRowError,
    handleRename,
    handleDelete,
  };
}
