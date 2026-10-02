import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useI18n } from '../i18n/LocaleProvider';
import type { VideoIndex } from '../search/useVideoIndex';
import {
  addPlaylistItem,
  listPlaylistVideos,
  movePlaylistItem,
  removePlaylistItem,
} from '../youtube/api';
import type { Playlist, PlaylistVideo } from '../youtube/types';
import { AddVideoForm } from './AddVideoForm';
import { reportError } from './errors';
import { VideoItem } from './VideoItem';
import { removeVideo, swapVideos } from './videoOrder';

export type ProfileVideoIndex = Pick<
  VideoIndex,
  'videosByPlaylist' | 'replaceVideos'
>;

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready' };

// Naraz trwa jedna operacja na filmach, żeby pozycje i cofnięcie przesunięcia się nie rozjechały
type Pending = { kind: 'item'; itemId: string } | { kind: 'add' } | null;

type ItemError = { itemId: string; message: string } | null;

type PlaylistVideosProps = {
  token: string;
  playlist: Playlist;
  videoIndex: ProfileVideoIndex;
  onUnauthorized: () => void;
  onUpdated: (playlist: Playlist) => void;
};

export function PlaylistVideos({
  token,
  playlist,
  videoIndex,
  onUnauthorized,
  onUpdated,
}: PlaylistVideosProps) {
  const { t } = useI18n();
  const playlistId = playlist.id;
  // Filmy pobrane już dla wyszukiwania nie wymagają kolejnego zapytania
  const [cached] = useState(() => videoIndex.videosByPlaylist.get(playlistId));
  const [load, setLoad] = useState<LoadState>(
    cached === undefined ? { status: 'loading' } : { status: 'ready' },
  );
  const [videos, setVideos] = useState<PlaylistVideo[]>(cached ?? []);
  const [reloadKey, setReloadKey] = useState(0);
  const [pending, setPending] = useState<Pending>(null);
  const [itemError, setItemError] = useState<ItemError>(null);
  const pendingRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const storeVideos = useEffectEvent((list: PlaylistVideo[]) =>
    videoIndex.replaceVideos(playlistId, list),
  );
  const describeLoadError = useEffectEvent((error: unknown) =>
    reportError(error, t, onUnauthorized),
  );

  useEffect(() => {
    if (cached !== undefined && reloadKey === 0) {
      return;
    }
    let cancelled = false;
    listPlaylistVideos(token, playlistId).then(
      (list) => {
        if (cancelled) {
          return;
        }
        setVideos(list);
        setLoad({ status: 'ready' });
        storeVideos(list);
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
  }, [token, playlistId, cached, reloadKey]);

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
    return true;
  }

  function finish() {
    pendingRef.current = false;
    setPending(null);
  }

  function commit(list: PlaylistVideo[]) {
    setVideos(list);
    videoIndex.replaceVideos(playlistId, list);
  }

  // Optymistycznie: kolejność zmienia się od razu, a przy błędzie wraca
  async function move(index: number, direction: 'up' | 'down') {
    const target = direction === 'up' ? index - 1 : index + 1;
    const video = videos[index];
    const neighbor = videos[target];
    if (video === undefined || neighbor === undefined) {
      return;
    }
    if (!begin({ kind: 'item', itemId: video.itemId })) {
      return;
    }
    const previous = videos;
    const next = swapVideos(videos, index, target);
    setVideos(next);
    try {
      await movePlaylistItem(token, playlistId, video, neighbor.position);
      videoIndex.replaceVideos(playlistId, next);
    } catch (error) {
      setVideos(previous);
      setItemError({
        itemId: video.itemId,
        message: reportError(error, t, onUnauthorized),
      });
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
      await removePlaylistItem(token, video.itemId);
    } catch (error) {
      setItemError({
        itemId: video.itemId,
        message: reportError(error, t, onUnauthorized),
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
      const added = await addPlaylistItem(token, playlistId, videoId);
      commit([...videos, added]);
      onUpdated({ ...playlist, itemCount: playlist.itemCount + 1 });
    } catch (error) {
      throw new Error(reportError(error, t, onUnauthorized), {
        cause: error,
      });
    } finally {
      finish();
    }
  }

  const count = load.status === 'ready' ? videos.length : playlist.itemCount;

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
      {load.status === 'ready' && videos.length > 0 && (
        <ol className="video-list" aria-labelledby="profile-videos">
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
              onMove={(direction) => void move(index, direction)}
              onRemove={() => remove(video)}
            />
          ))}
        </ol>
      )}
      {load.status === 'ready' && (
        <AddVideoForm
          locked={pending?.kind === 'item'}
          adding={pending?.kind === 'add'}
          onAdd={add}
        />
      )}
    </section>
  );
}
