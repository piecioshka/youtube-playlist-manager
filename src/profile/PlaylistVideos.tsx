import { useRef, useState } from 'react';
import { useI18n } from '../i18n/LocaleProvider';
import type { Playlist, PlaylistVideo } from '../youtube/types';
import { AddVideoForm } from './AddVideoForm';
import { UnavailableBar } from './UnavailableBar';
import { VideoItem } from './VideoItem';
import { dropIndex, type DropPlacement } from './reorder';
import { usePlaylistVideos, type ProfileVideoIndex } from './usePlaylistVideos';

// Przeciągany film i miejsce, nad którym jest wskaźnik (overId to null poza wierszami)
type Drag = {
  itemId: string;
  overId: string | null;
  placement: DropPlacement;
} | null;

type PlaylistVideosProps = {
  playlist: Playlist;
  videoIndex: ProfileVideoIndex;
  // Liczba wszystkich elementów (także niedostępnych) po wczytaniu i po każdej zmianie
  onCountChange: (count: number) => void;
};

export function PlaylistVideos({
  playlist,
  videoIndex,
  onCountChange,
}: PlaylistVideosProps) {
  const { t } = useI18n();
  const playlistId = playlist.id;
  const list = usePlaylistVideos({ playlistId, videoIndex, onCountChange });
  const { load, videos, pending, itemError, progress, bulkError } = list;
  const [drag, setDrag] = useState<Drag>(null);
  const [announcement, setAnnouncement] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);

  async function moveVideo(from: number, to: number) {
    const video = videos[from];
    setAnnouncement('');
    if (video !== undefined && (await list.move(from, to))) {
      setAnnouncement(
        t.videoMoved(
          video.available ? video.title : t.videoUnavailable,
          to + 1,
        ),
      );
    }
  }

  async function remove(video: PlaylistVideo): Promise<boolean> {
    setAnnouncement('');
    const removed = await list.remove(video);
    if (removed) {
      headingRef.current?.focus();
    }
    return removed;
  }

  function add(videoId: string): Promise<void> {
    setAnnouncement('');
    return list.add(videoId);
  }

  async function removeUnavailable(): Promise<void> {
    setAnnouncement('');
    if (await list.removeUnavailable()) {
      headingRef.current?.focus();
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
          <button type="button" className="button" onClick={list.retry}>
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
