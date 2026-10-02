import { useEffect, useState } from 'react';
import type { Messages } from '../i18n/messages';
import { errorMessage } from '../youtube/errorMessage';
import { ApiError, type Playlist } from '../youtube/types';
import { useYouTube } from '../youtube/YouTubeProvider';

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
  t: Messages;
};

export function isApiError(error: unknown, kind: ApiError['kind']): boolean {
  return error instanceof ApiError && error.kind === kind;
}

// Lista playlist wspólna dla tabeli i profilu playlisty: wczytana raz, zmiany z obu widoków trafiają tutaj
export function usePlaylists({ t }: UsePlaylistsOptions): PlaylistsState {
  const youtube = useYouTube();
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    youtube.listMyPlaylists().then(
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
        setLoadState({ status: 'error', error });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [youtube, reloadKey]);

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
      replacePlaylist(
        await youtube.updatePlaylist(playlist, { title: newTitle }),
      );
      setNotice(null);
    } catch (error) {
      throw toRowError(error, playlist);
    }
  }

  async function handleDelete(playlist: Playlist): Promise<void> {
    try {
      await youtube.deletePlaylist(playlist.id);
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
