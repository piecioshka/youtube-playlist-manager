import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useI18n } from '../i18n/LocaleProvider';
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

  return (
    <li
      className={classNames(
        'video-item',
        !video.available && 'video-item--unavailable',
        dragging && 'video-item--dragging',
        dropIndicator !== null && `video-item--drop-${dropIndicator}`,
      )}
    >
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
      <span className="video-item__position">{number}</span>
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
      <div className="video-item__text">
        {video.available ? (
          <>
            <YouTubeLink
              className="video-item__link"
              href={`https://www.youtube.com/watch?v=${encodeURIComponent(video.videoId)}&list=${encodeURIComponent(playlistId)}`}
              title={video.title}
            >
              {video.title}
            </YouTubeLink>
            {video.channelTitle !== '' && (
              <span className="video-item__channel">{video.channelTitle}</span>
            )}
          </>
        ) : (
          <span className="video-item__unavailable">{t.videoUnavailable}</span>
        )}
      </div>
      {confirming ? (
        <div
          className="video-item__actions"
          role="group"
          aria-label={t.removeVideoQuestion(name)}
        >
          <span className="video-item__question">
            {t.removeVideoQuestion(name)}
          </span>
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
          {pending && <span className="video-item__working">{t.working}</span>}
        </div>
      ) : (
        <div className="video-item__actions">
          {pending && <span className="video-item__working">{t.working}</span>}
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
      {error !== null && (
        <p className="video-item__error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
