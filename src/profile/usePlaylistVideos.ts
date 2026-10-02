import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useI18n } from '../i18n/LocaleProvider';
import type { VideoIndex } from '../search/useVideoIndex';
import { errorMessage } from '../youtube/errorMessage';
import { ApiError, type PlaylistVideo } from '../youtube/types';
import { useYouTube } from '../youtube/YouTubeProvider';
import { moveVideos, removeVideo } from './videoOrder';

export type ProfileVideoIndex = Pick<VideoIndex, 'replaceVideos'>;

export type VideosLoad =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready' };

// Naraz trwa jedna operacja na filmach, żeby pozycje i cofnięcie przesunięcia się nie rozjechały
export type Pending =
  { kind: 'item'; itemId: string } | { kind: 'add' } | { kind: 'bulk' } | null;

export type Progress = { done: number; total: number } | null;

export type ItemError = { itemId: string; message: string } | null;

type UsePlaylistVideosOptions = {
  playlistId: string;
  videoIndex: ProfileVideoIndex;
  // Liczba wszystkich elementów (także niedostępnych) po wczytaniu i po każdej zmianie
  onCountChange: (count: number) => void;
};

export type PlaylistVideosState = {
  load: VideosLoad;
  videos: PlaylistVideo[];
  pending: Pending;
  itemError: ItemError;
  progress: Progress;
  bulkError: string | null;
  retry: () => void;
  // true, gdy kolejność została zapisana
  move: (from: number, to: number) => Promise<boolean>;
  // true, gdy film zniknął z playlisty
  remove: (video: PlaylistVideo) => Promise<boolean>;
  // Odrzuca Error z gotowym komunikatem dla użytkownika
  add: (videoId: string) => Promise<void>;
  // true, gdy usunięto wszystkie niedostępne filmy
  removeUnavailable: () => Promise<boolean>;
};

// Indeks wyszukiwania zna tylko filmy, które da się obejrzeć
function availableOnly(videos: PlaylistVideo[]): PlaylistVideo[] {
  return videos.filter((video) => video.available);
}

// Filmy jednej playlisty: wczytanie i wszystkie operacje, które zmieniają ich listę
export function usePlaylistVideos({
  playlistId,
  videoIndex,
  onCountChange,
}: UsePlaylistVideosOptions): PlaylistVideosState {
  const { t } = useI18n();
  const youtube = useYouTube();
  // Indeks wyszukiwania pomija niedostępne filmy, więc profil zawsze pobiera własną, pełną listę
  const [load, setLoad] = useState<VideosLoad>({ status: 'loading' });
  const [videos, setVideos] = useState<PlaylistVideo[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [pending, setPending] = useState<Pending>(null);
  const [itemError, setItemError] = useState<ItemError>(null);
  const [progress, setProgress] = useState<Progress>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const pendingRef = useRef(false);

  const loaded = useEffectEvent((list: PlaylistVideo[]) => {
    videoIndex.replaceVideos(playlistId, availableOnly(list));
    onCountChange(list.length);
  });
  const describeLoadError = useEffectEvent((error: unknown) =>
    errorMessage(error, t),
  );

  useEffect(() => {
    let cancelled = false;
    youtube.listPlaylistVideos(playlistId, { includeUnavailable: true }).then(
      (list) => {
        if (cancelled) {
          return;
        }
        setVideos(list);
        setLoad({ status: 'ready' });
        loaded(list);
      },
      (error: unknown) => {
        if (!cancelled) {
          setLoad({ status: 'error', message: describeLoadError(error) });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [youtube, playlistId, reloadKey]);

  function retry() {
    setLoad({ status: 'loading' });
    setReloadKey((key) => key + 1);
  }

  function begin(next: Exclude<Pending, null>): boolean {
    if (pendingRef.current) {
      return false;
    }
    pendingRef.current = true;
    setPending(next);
    setItemError(null);
    setBulkError(null);
    return true;
  }

  function finish() {
    pendingRef.current = false;
    setPending(null);
  }

  function commit(list: PlaylistVideo[]) {
    setVideos(list);
    videoIndex.replaceVideos(playlistId, availableOnly(list));
    onCountChange(list.length);
  }

  // Optymistycznie: kolejność zmienia się od razu, a przy błędzie wraca
  async function move(from: number, to: number): Promise<boolean> {
    const video = videos[from];
    const destination = videos[to];
    if (video === undefined || destination === undefined || from === to) {
      return false;
    }
    if (!begin({ kind: 'item', itemId: video.itemId })) {
      return false;
    }
    const previous = videos;
    const next = moveVideos(videos, from, to);
    setVideos(next);
    try {
      await youtube.movePlaylistItem(playlistId, video, destination.position);
      videoIndex.replaceVideos(playlistId, availableOnly(next));
      return true;
    } catch (error) {
      setVideos(previous);
      setItemError({
        itemId: video.itemId,
        message: errorMessage(error, t),
      });
      return false;
    } finally {
      finish();
    }
  }

  // Pesymistycznie: film znika dopiero po odpowiedzi API
  async function remove(video: PlaylistVideo): Promise<boolean> {
    if (!begin({ kind: 'item', itemId: video.itemId })) {
      return false;
    }
    try {
      await youtube.removePlaylistItem(video.itemId);
    } catch (error) {
      setItemError({
        itemId: video.itemId,
        message: errorMessage(error, t),
      });
      return false;
    } finally {
      finish();
    }
    commit(removeVideo(videos, video.itemId));
    return true;
  }

  async function add(videoId: string): Promise<void> {
    if (!begin({ kind: 'add' })) {
      return;
    }
    try {
      const added = await youtube.addPlaylistItem(playlistId, videoId);
      commit([...videos, added]);
    } catch (error) {
      // 404 przy dodawaniu to zwykle zły ID filmu; komunikat o playliście tylko przy playlistNotFound
      const missingVideo =
        error instanceof ApiError &&
        error.kind === 'notFound' &&
        error.reason !== 'playlistNotFound';
      throw new Error(missingVideo ? t.videoNotFound : errorMessage(error, t), {
        cause: error,
      });
    } finally {
      finish();
    }
  }

  /*
   * Usuwa niedostępne filmy po kolei (każde usunięcie to 50 jednostek limitu)
   * i zatrzymuje się na pierwszym błędzie; usunięte do tego miejsca zostają usunięte.
   */
  async function removeUnavailable(): Promise<boolean> {
    const targets = videos.filter((video) => !video.available);
    if (targets.length === 0 || !begin({ kind: 'bulk' })) {
      return false;
    }
    let current = videos;
    let removed = 0;
    setProgress({ done: 0, total: targets.length });
    try {
      for (const video of targets) {
        try {
          await youtube.removePlaylistItem(video.itemId);
        } catch (error) {
          setBulkError(errorMessage(error, t));
          return false;
        }
        removed += 1;
        current = removeVideo(current, video.itemId);
        commit(current);
        setProgress({ done: removed, total: targets.length });
      }
      return true;
    } finally {
      setProgress(null);
      finish();
    }
  }

  return {
    load,
    videos,
    pending,
    itemError,
    progress,
    bulkError,
    retry,
    move,
    remove,
    add,
    removeUnavailable,
  };
}
