import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useI18n } from '../i18n/LocaleProvider';
import { formatDate } from '../playlists/format';
import type { PlaylistVideo } from '../youtube/types';
import { YouTubeLink } from '../youtube/YouTubeLink';
import type { DropPlacement } from './reorder';
import type { DragHandlers } from './useVideoDrag';

function classNames(...names: (string | false)[]): string {
  return names.filter(Boolean).join(' ');
}

type FocusTarget = 'handle' | 'remove' | 'cancel';

type VideoItemProps = {
  video: PlaylistVideo;
  playlistId: string;
  number: number;
  isFirst: boolean;
  isLast: boolean;
  // Ten film czeka na odpowiedź API
  pending: boolean;
  // Inna operacja na filmach trwa, więc przyciski czekają
  locked: boolean;
  error: string | null;
  // Zdarzenia uchwytu; null, gdy filmu nie da się teraz przenieść
  dragHandlers: DragHandlers | null;
  // Ten film jest właśnie przeciągany
  dragging: boolean;
  dropIndicator: DropPlacement | null;
  // Sąsiedni film został usunięty, więc fokus przechodzi na przycisk usuwania tego filmu
  focusRemove: boolean;
  onMove: (direction: 'up' | 'down') => void;
  // true, gdy film zniknął z playlisty
  onRemove: () => Promise<boolean>;
};

export function VideoItem({
  video,
  playlistId,
  number,
  isFirst,
  isLast,
  pending,
  locked,
  error,
  dragHandlers,
  dragging,
  dropIndicator,
  focusRemove,
  onMove,
  onRemove,
}: VideoItemProps) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const focusTargetRef = useRef<FocusTarget | null>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const removeRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const disabled = pending || locked;

  // Przesunięcie i potwierdzenia przebudowują wiersz, więc fokus oddajemy po odpowiedzi
  useEffect(() => {
    const target = focusTargetRef.current;
    if (target === null || disabled) {
      return;
    }
    focusTargetRef.current = null;
    if (target === 'handle') {
      handleRef.current?.focus();
    } else if (target === 'remove') {
      removeRef.current?.focus();
    } else {
      cancelRef.current?.focus();
    }
  }, [disabled, confirming]);

  // Przycisk jest wyłączony do końca operacji, więc fokus bierze dopiero po niej
  useEffect(() => {
    if (focusRemove && !disabled) {
      removeRef.current?.focus();
    }
  }, [focusRemove, disabled]);

  // Z klawiatury uchwyt przesuwa film strzałkami: przeciąganie wymaga myszy albo palca
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const direction =
      event.key === 'ArrowUp'
        ? 'up'
        : event.key === 'ArrowDown'
          ? 'down'
          : null;
    if (direction === null) {
      return;
    }
    // Strzałka na uchwycie nie przewija strony
    event.preventDefault();
    const atEdge = direction === 'up' ? isFirst : isLast;
    if (dragHandlers === null || atEdge) {
      return;
    }
    focusTargetRef.current = 'handle';
    onMove(direction);
  }

  function startConfirm() {
    focusTargetRef.current = 'cancel';
    setConfirming(true);
  }

  function cancelConfirm() {
    focusTargetRef.current = 'remove';
    setConfirming(false);
  }

  async function confirmRemove() {
    const removed = await onRemove();
    if (!removed) {
      focusTargetRef.current = 'remove';
      setConfirming(false);
    }
  }

  // Niedostępny film ma od YouTube tylko „Deleted video” albo „Private video”, więc nazywamy go numerem
  const name = video.available ? video.title : t.unavailableVideoName(number);
  const target = <span className="visually-hidden">{t.videoTarget(name)}</span>;
  // Data publikacji filmu na YouTube, nie data dodania do playlisty
  const published =
    video.videoPublishedAt === null ? null : formatDate(video.videoPublishedAt);

  return (
    <tr
      className={classNames(
        'video-item',
        !video.available && 'video-item--unavailable',
        dragging && 'video-item--dragging',
        confirming && 'video-item--confirming',
        dropIndicator !== null && `video-item--drop-${dropIndicator}`,
      )}
      role="row"
    >
      <td className="video-item__cell video-item__cell--handle" role="cell">
        <button
          ref={handleRef}
          type="button"
          className={
            dragHandlers === null
              ? 'video-item__handle video-item__handle--disabled'
              : 'video-item__handle'
          }
          aria-label={`${t.moveVideo} ${t.videoTarget(name)}`}
          // aria-disabled zamiast disabled: uchwyt nie gubi fokusa na czas żądania
          aria-disabled={dragHandlers === null ? true : undefined}
          title={t.dragToReorder}
          onKeyDown={handleKeyDown}
          {...dragHandlers}
        >
          <svg width="12" height="16" viewBox="0 0 12 16" aria-hidden="true">
            <circle cx="3" cy="3" r="1.5" />
            <circle cx="9" cy="3" r="1.5" />
            <circle cx="3" cy="8" r="1.5" />
            <circle cx="9" cy="8" r="1.5" />
            <circle cx="3" cy="13" r="1.5" />
            <circle cx="9" cy="13" r="1.5" />
          </svg>
        </button>
      </td>
      <td className="video-item__cell video-item__cell--number" role="cell">
        {number}
      </td>
      <td className="video-item__cell video-item__cell--thumbnail" role="cell">
        {video.available && video.thumbnailUrl ? (
          <img
            className="video-item__thumbnail"
            src={video.thumbnailUrl}
            alt=""
            width={64}
            height={36}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span
            className="video-item__thumbnail video-item__thumbnail--empty"
            aria-hidden="true"
          />
        )}
      </td>
      <th
        className="video-item__cell video-item__cell--title"
        scope="row"
        role="rowheader"
      >
        {video.available ? (
          <YouTubeLink
            className="video-item__link"
            href={`https://www.youtube.com/watch?v=${encodeURIComponent(video.videoId)}&list=${encodeURIComponent(playlistId)}`}
            title={video.title}
          >
            {video.title}
          </YouTubeLink>
        ) : (
          <span className="video-item__unavailable">{t.videoUnavailable}</span>
        )}
        {error !== null && (
          <p className="video-item__error" role="alert">
            {error}
          </p>
        )}
      </th>
      <td className="video-item__cell video-item__cell--channel" role="cell">
        {video.available ? video.channelTitle : ''}
      </td>
      <td className="video-item__cell video-item__cell--published" role="cell">
        {published !== null && (
          <time dateTime={published} title={t.videoPublishedTitle}>
            {published}
          </time>
        )}
      </td>
      <td className="video-item__cell video-item__cell--actions" role="cell">
        {confirming ? (
          <div
            className="video-item__actions"
            role="group"
            aria-label={t.removeVideoQuestion(name)}
          >
            {/* Pełne pytanie z tytułem jest nazwą grupy; w wąskiej kolumnie widać krótkie */}
            <span className="video-item__question">{t.removeVideoShort}</span>
            <button
              type="button"
              className="button button--danger button--small"
              onClick={confirmRemove}
              disabled={disabled}
            >
              {t.remove}
            </button>
            <button
              ref={cancelRef}
              type="button"
              className="button button--small"
              onClick={cancelConfirm}
              disabled={disabled}
            >
              {t.cancel}
            </button>
            {pending && (
              <span className="video-item__working">{t.working}</span>
            )}
          </div>
        ) : (
          <div className="video-item__actions">
            {pending && (
              <span className="video-item__working">{t.working}</span>
            )}
            <button
              ref={removeRef}
              type="button"
              className="button button--danger button--small video-item__button"
              onClick={startConfirm}
              disabled={disabled}
            >
              <svg
                className="video-item__icon"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                aria-hidden="true"
              >
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <span className="video-item__button-label">{t.removeVideo}</span>{' '}
              {target}
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
