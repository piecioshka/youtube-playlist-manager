import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, type Playlist, type PlaylistVideo } from '../youtube/types';
import { useYouTube } from '../youtube/YouTubeProvider';

const MAX_IN_FLIGHT = 4;

type IndexState = {
  status: 'idle' | 'loading' | 'ready';
  done: number;
  total: number;
  failed: number;
  videosByPlaylist: ReadonlyMap<string, PlaylistVideo[]>;
};

export type VideoIndex = IndexState & {
  start: () => void;
  replaceVideos: (playlistId: string, videos: PlaylistVideo[]) => void;
};

type UseVideoIndexOptions = {
  playlists: readonly Playlist[];
};

const INITIAL_STATE: IndexState = {
  status: 'idle',
  done: 0,
  total: 0,
  failed: 0,
  videosByPlaylist: new Map(),
};

function finish(
  state: IndexState,
  playlistId: string,
  videos: PlaylistVideo[] | null,
): IndexState {
  const done = state.done + 1;
  const videosByPlaylist = new Map(state.videosByPlaylist);
  if (videos !== null) {
    videosByPlaylist.set(playlistId, videos);
  }
  return {
    status: done >= state.total ? 'ready' : 'loading',
    done,
    total: state.total,
    failed: videos === null ? state.failed + 1 : state.failed,
    videosByPlaylist,
  };
}

// Tytuły filmów pobierane leniwie, przy pierwszym wyszukiwaniu; indeks żyje tylko w pamięci
export function useVideoIndex({ playlists }: UseVideoIndexOptions): VideoIndex {
  const youtube = useYouTube();
  const [state, setState] = useState<IndexState>(INITIAL_STATE);
  const latestRef = useRef({ youtube, playlists });
  const startedRef = useRef(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    latestRef.current = { youtube, playlists };
  }, [youtube, playlists]);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const start = useCallback(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;
    const { youtube: session, playlists: snapshot } = latestRef.current;
    const ids = snapshot.map((playlist) => playlist.id);
    setState({
      ...INITIAL_STATE,
      status: ids.length === 0 ? 'ready' : 'loading',
      total: ids.length,
    });

    let nextIndex = 0;
    let stopped = false;

    async function worker(): Promise<void> {
      while (!stopped && !cancelledRef.current) {
        const playlistId = ids[nextIndex];
        if (playlistId === undefined) {
          return;
        }
        nextIndex += 1;
        try {
          const videos = await session.listPlaylistVideos(playlistId);
          if (cancelledRef.current) {
            return;
          }
          setState((current) => finish(current, playlistId, videos));
        } catch (error) {
          if (cancelledRef.current) {
            return;
          }
          if (error instanceof ApiError && error.kind === 'unauthorized') {
            // Sesja sama wraca do logowania; tu wystarczy przestać pobierać
            stopped = true;
            return;
          }
          setState((current) => finish(current, playlistId, null));
        }
      }
    }

    for (let slot = 0; slot < Math.min(MAX_IN_FLIGHT, ids.length); slot += 1) {
      void worker();
    }
  }, []);

  // Profil playlisty po zmianie filmów podmienia jej wpis, żeby wyszukiwanie i powrót na profil nie pokazały starej listy
  const replaceVideos = useCallback(
    (playlistId: string, videos: PlaylistVideo[]) => {
      setState((current) => ({
        ...current,
        videosByPlaylist: new Map(current.videosByPlaylist).set(
          playlistId,
          videos,
        ),
      }));
    },
    [],
  );

  return useMemo(
    () => ({ ...state, start, replaceVideos }),
    [state, start, replaceVideos],
  );
}
