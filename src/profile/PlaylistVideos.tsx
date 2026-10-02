import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useI18n } from '../i18n/LocaleProvider';
import type { VideoIndex } from '../search/useVideoIndex';
import { errorMessage } from '../youtube/errorMessage';
import { ApiError, type Playlist, type PlaylistVideo } from '../youtube/types';
import { useYouTube } from '../youtube/YouTubeProvider';
import { AddVideoForm } from './AddVideoForm';
import { UnavailableBar } from './UnavailableBar';
import { VideoItem } from './VideoItem';
import { dropIndex, type DropPlacement } from './reorder';
import { moveVideos, removeVideo } from './videoOrder';

export type ProfileVideoIndex = Pick<VideoIndex, 'replaceVideos'>;

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready' };

// Naraz trwa jedna operacja na filmach, żeby pozycje i cofnięcie przesunięcia się nie rozjechały
type Pending =
  { kind: 'item'; itemId: string } | { kind: 'add' } | { kind: 'bulk' } | null;

type Progress = { done: number; total: number } | null;

type ItemError = { itemId: string; message: string } | null;

// Przeciągany film i miejsce, nad którym jest wskaźnik (overId to null poza wierszami)
type Drag = {
  itemId: string;
  overId: string | null;
  placement: DropPlacement;
} | null;

type PlaylistVideosProps = {
  playlist: Playlist;
  videoIndex: ProfileVideoIndex;
  onUpdated: (playlist: Playlist) => void;
  // Liczba wszystkich elementów (także niedostępnych) po wczytaniu i po każdej zmianie
  onCountChange: (count: number) => void;
};

// Indeks wyszukiwania zna tylko filmy, które da się obejrzeć
function availableOnly(videos: PlaylistVideo[]): PlaylistVideo[] {
  return videos.filter((video) => video.available);
}

export function PlaylistVideos({
  playlist,
  videoIndex,
  onUpdated,
  onCountChange,
}: PlaylistVideosProps) {
  const { t } = useI18n();
  const youtube = useYouTube();
  const playlistId = playlist.id;
  // Indeks wyszukiwania pomija niedostępne filmy, więc profil zawsze pobiera własną, pełną listę
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [videos, setVideos] = useState<PlaylistVideo[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [pending, setPending] = useState<Pending>(null);
  const [itemError, setItemError] = useState<ItemError>(null);
  const [progress, setProgress] = useState<Progress>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const [announcement, setAnnouncement] = useState('');
  const pendingRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

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
    setAnnouncement('');
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
  async function moveVideo(from: number, to: number) {
    const video = videos[from];
    const destination = videos[to];
    if (video === undefined || destination === undefined || from === to) {
      return;
    }
    if (!begin({ kind: 'item', itemId: video.itemId })) {
      return;
    }
    const previous = videos;
    const next = moveVideos(videos, from, to);
    setVideos(next);
    try {
      await youtube.movePlaylistItem(playlistId, video, destination.position);
      videoIndex.replaceVideos(playlistId, availableOnly(next));
      setAnnouncement(
        t.videoMoved(
          video.available ? video.title : t.videoUnavailable,
          to + 1,
        ),
      );
    } catch (error) {
      setVideos(previous);
      setItemError({
        itemId: video.itemId,
        message: errorMessage(error, t),
      });
    } finally {
      finish();
    }
  }

  function move(index: number, direction: 'up' | 'down') {
    return moveVideo(index, direction === 'up' ? index - 1 : index + 1);
  }

  function dragFromIndex(): number {
    return drag === null
      ? -1
      : videos.findIndex((video) => video.itemId === drag.itemId);
  }

  function dragOver(itemId: string, placement: DropPlacement) {
    setDrag((current) =>
      current === null ||
      (current.overId === itemId && current.placement === placement)
        ? current
        : { ...current, overId: itemId, placement },
    );
  }

  function drop(overIndex: number, placement: DropPlacement) {
    const from = dragFromIndex();
    setDrag(null);
    if (from >= 0) {
      void moveVideo(from, dropIndex(from, overIndex, placement));
    }
  }

  // Wskaźnik pojawia się tylko tam, gdzie upuszczenie zmieni kolejność
  function dropIndicator(index: number, itemId: string): DropPlacement | null {
    const from = dragFromIndex();
    if (drag === null || drag.overId !== itemId || from < 0) {
      return null;
    }
    return dropIndex(from, index, drag.placement) === from
      ? null
      : drag.placement;
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
    onUpdated({ ...playlist, itemCount: Math.max(0, playlist.itemCount - 1) });
    headingRef.current?.focus();
    return true;
  }

  async function add(videoId: string): Promise<void> {
    if (!begin({ kind: 'add' })) {
      return;
    }
    try {
      const added = await youtube.addPlaylistItem(playlistId, videoId);
      commit([...videos, added]);
      onUpdated({ ...playlist, itemCount: playlist.itemCount + 1 });
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
  async function removeUnavailable(): Promise<void> {
    const targets = videos.filter((video) => !video.available);
    if (targets.length === 0 || !begin({ kind: 'bulk' })) {
      return;
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
          return;
        }
        removed += 1;
        current = removeVideo(current, video.itemId);
        commit(current);
        onUpdated({
          ...playlist,
          itemCount: Math.max(0, playlist.itemCount - removed),
        });
        setProgress({ done: removed, total: targets.length });
      }
      headingRef.current?.focus();
    } finally {
      setProgress(null);
      finish();
    }
  }

  const count = load.status === 'ready' ? videos.length : playlist.itemCount;
  const unavailableCount = videos.filter((video) => !video.available).length;

  return (
    <section className="profile__videos" aria-labelledby="profile-videos">
      <h3
        id="profile-videos"
        ref={headingRef}
        className="profile__videos-heading"
        tabIndex={-1}
      >
        {t.videosHeading(count)}
      </h3>
      {load.status === 'loading' && (
        <p className="playlists__state">{t.loadingVideos}</p>
      )}
      {load.status === 'error' && (
        <div className="notice notice--error" role="alert">
          <p className="playlists__error-text">{load.message}</p>
          <button type="button" className="button" onClick={retry}>
            {t.retry}
          </button>
        </div>
      )}
      {load.status === 'ready' && videos.length === 0 && (
        <p className="playlists__state">{t.playlistEmpty}</p>
      )}
      {load.status === 'ready' &&
        (unavailableCount > 0 || progress !== null) && (
          <UnavailableBar
            count={unavailableCount}
            progress={progress}
            error={bulkError}
            locked={pending !== null}
            onConfirm={removeUnavailable}
          />
        )}
      {load.status === 'ready' && videos.length > 0 && (
        <ol
          className="video-list"
          aria-labelledby="profile-videos"
          onDragLeave={(event) => {
            const next = event.relatedTarget;
            if (
              !(next instanceof Node) ||
              !event.currentTarget.contains(next)
            ) {
              setDrag((current) =>
                current === null ? current : { ...current, overId: null },
              );
            }
          }}
        >
          {videos.map((video, index) => (
            <VideoItem
              key={video.itemId}
              video={video}
              playlistId={playlistId}
              number={index + 1}
              isFirst={index === 0}
              isLast={index === videos.length - 1}
              pending={
                pending?.kind === 'item' && pending.itemId === video.itemId
              }
              locked={pending !== null}
              error={
                itemError?.itemId === video.itemId ? itemError.message : null
              }
              canDrag={videos.length > 1 && pending === null}
              dragging={drag?.itemId === video.itemId}
              dragActive={drag !== null}
              dropIndicator={dropIndicator(index, video.itemId)}
              onDragStart={() =>
                setDrag({
                  itemId: video.itemId,
                  overId: null,
                  placement: 'after',
                })
              }
              onDragOver={(placement) => dragOver(video.itemId, placement)}
              onDrop={(placement) => drop(index, placement)}
              onDragEnd={() => setDrag(null)}
              onMove={(direction) => void move(index, direction)}
              onRemove={() => remove(video)}
            />
          ))}
        </ol>
      )}
      <p className="visually-hidden" role="status">
        {announcement}
      </p>
      {load.status === 'ready' && (
        <AddVideoForm
          locked={pending !== null && pending.kind !== 'add'}
          adding={pending?.kind === 'add'}
          onAdd={add}
        />
      )}
    </section>
  );
}
