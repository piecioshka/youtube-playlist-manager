import { useRef, useState } from 'react';
import { useI18n } from '../i18n/LocaleProvider';
import type { Playlist, PlaylistVideo } from '../youtube/types';
import { AddVideoForm } from './AddVideoForm';
import { UnavailableBar } from './UnavailableBar';
import { VideoItem } from './VideoItem';
import { usePlaylistVideos, type ProfileVideoIndex } from './usePlaylistVideos';
import { useVideoDrag } from './useVideoDrag';

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
  const [announcement, setAnnouncement] = useState('');
  // Film, którego przycisk usuwania przejmuje fokus po usunięciu sąsiada
  const [focusItemId, setFocusItemId] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Każda nowa operacja zaczyna z czystym ogłoszeniem i bez zaległej prośby o fokus
  function startOperation() {
    setAnnouncement('');
    setFocusItemId(null);
  }

  async function moveVideo(from: number, to: number) {
    const video = videos[from];
    startOperation();
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
    startOperation();
    const index = videos.findIndex((item) => item.itemId === video.itemId);
    const neighbour = videos[index + 1] ?? videos[index - 1];
    const removed = await list.remove(video);
    if (removed) {
      // Fokus zostaje w miejscu usuniętego filmu: nagłówek nad listą przewinąłby stronę do góry
      if (neighbour === undefined) {
        headingRef.current?.focus();
      } else {
        setFocusItemId(neighbour.itemId);
      }
    }
    return removed;
  }

  function add(videoId: string): Promise<void> {
    startOperation();
    return list.add(videoId);
  }

  async function removeUnavailable(): Promise<void> {
    startOperation();
    if (await list.removeUnavailable()) {
      headingRef.current?.focus();
    }
  }

  function move(index: number, direction: 'up' | 'down') {
    return moveVideo(index, direction === 'up' ? index - 1 : index + 1);
  }

  // Rozbite od razu: obiekt z refem w środku reguła react-hooks/refs traktuje w całości jak ref
  const { listRef, draggingId, dropIndicator, handlers } = useVideoDrag(
    videos,
    (from, to) => void moveVideo(from, to),
  );
  // Uchwyt można złapać, gdy lista ma kilka filmów i nic nie trwa
  const canDrag = videos.length > 1 && pending === null;

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
        // Jawne role: na telefonie wiersze dostają display: grid, co w części przeglądarek gubi semantykę tabeli
        <table
          className="video-table"
          role="table"
          aria-labelledby="profile-videos"
        >
          <thead className="video-table__head" role="rowgroup">
            <tr role="row">
              <th
                className="video-table__column video-table__column--handle"
                scope="col"
                role="columnheader"
              >
                <span className="visually-hidden">{t.videoColumnOrder}</span>
              </th>
              <th
                className="video-table__column video-table__column--number"
                scope="col"
                role="columnheader"
              >
                {t.videoColumnNumber}
              </th>
              <th
                className="video-table__column video-table__column--thumbnail"
                scope="col"
                role="columnheader"
              >
                <span className="visually-hidden">
                  {t.videoColumnThumbnail}
                </span>
              </th>
              <th
                className="video-table__column"
                scope="col"
                role="columnheader"
              >
                {t.columnTitle}
              </th>
              <th
                className="video-table__column video-table__column--channel"
                scope="col"
                role="columnheader"
              >
                {t.videoColumnChannel}
              </th>
              <th
                className="video-table__column video-table__column--published"
                scope="col"
                role="columnheader"
              >
                {t.videoColumnPublished}
              </th>
              <th
                className="video-table__column video-table__column--actions"
                scope="col"
                role="columnheader"
              >
                <span className="visually-hidden">{t.columnActions}</span>
              </th>
            </tr>
          </thead>
          {/* Kolejne wiersze odpowiadają kolejnym filmom: na tym opiera się przeciąganie */}
          <tbody ref={listRef} role="rowgroup">
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
                dragHandlers={canDrag ? handlers(video.itemId) : null}
                dragging={draggingId === video.itemId}
                dropIndicator={dropIndicator(index, video.itemId)}
                focusRemove={focusItemId === video.itemId}
                onMove={(direction) => void move(index, direction)}
                onRemove={() => remove(video)}
              />
            ))}
          </tbody>
        </table>
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
