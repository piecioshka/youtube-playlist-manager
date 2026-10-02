import { useEffect, useState } from 'react';
import type { Messages } from '../i18n/messages';
import type { PlaylistChanges } from '../youtube/api';
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

// YouTube odpowiedział, że playlisty już nie ma; lista sama ją wtedy usuwa
export class PlaylistGoneError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'PlaylistGoneError';
  }
}

export type PlaylistsState = {
  loadState: LoadState;
  playlists: Playlist[];
  notice: Notice;
  retry: () => void;
  clearNotice: () => void;
  // Obie operacje odrzucają Error z gotowym komunikatem; PlaylistGoneError, gdy playlisty już nie ma
  updatePlaylist: (
    playlist: Playlist,
    changes: PlaylistChanges,
  ) => Promise<Playlist>;
  deletePlaylist: (playlist: Playlist) => Promise<void>;
  // Profil poprawia liczbę filmów na faktyczną po ich wczytaniu i po każdej zmianie
  setItemCount: (playlistId: string, itemCount: number) => void;
};

type UsePlaylistsOptions = {
  t: Messages;
};

export function isApiError(error: unknown, kind: ApiError['kind']): boolean {
  return error instanceof ApiError && error.kind === kind;
}

// Lista playlist wspólna dla tabeli i profilu: wczytana raz, każda zmiana playlisty przechodzi tędy
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
        if (!cancelled) {
          setLoadState({ status: 'error', error });
        }
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

  // Błąd do pokazania przy akcji; 404 znaczy, że playlista zniknęła, więc znika też z listy
  function toActionError(error: unknown, playlist: Playlist): Error {
    const message = errorMessage(error, t);
    if (isApiError(error, 'notFound')) {
      removePlaylist(playlist.id);
      setNotice({ kind: 'missing' });
      return new PlaylistGoneError(message, { cause: error });
    }
    return new Error(message, { cause: error });
  }

  async function updatePlaylist(
    playlist: Playlist,
    changes: PlaylistChanges,
  ): Promise<Playlist> {
    try {
      const updated = await youtube.updatePlaylist(playlist, changes);
      setPlaylists((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setNotice(null);
      return updated;
    } catch (error) {
      throw toActionError(error, playlist);
    }
  }

  async function deletePlaylist(playlist: Playlist): Promise<void> {
    try {
      await youtube.deletePlaylist(playlist.id);
    } catch (error) {
      throw toActionError(error, playlist);
    }
    removePlaylist(playlist.id);
    setNotice({ kind: 'deleted', title: playlist.title });
  }

  function setItemCount(playlistId: string, itemCount: number) {
    setPlaylists((current) =>
      current.some(
        (item) => item.id === playlistId && item.itemCount !== itemCount,
      )
        ? current.map((item) =>
            item.id === playlistId ? { ...item, itemCount } : item,
          )
        : current,
    );
  }

  return {
    loadState,
    playlists,
    notice,
    retry,
    clearNotice: () => setNotice(null),
    updatePlaylist,
    deletePlaylist,
    setItemCount,
  };
}
