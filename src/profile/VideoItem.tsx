import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useI18n } from '../i18n/LocaleProvider';
import type { PlaylistVideo } from '../youtube/types';
import type { DropPlacement } from './reorder';

function classNames(...names: (string | false)[]): string {
  return names.filter(Boolean).join(' ');
}

type FocusTarget = 'up' | 'down' | 'remove' | 'cancel';

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
  // Uchwyt można złapać (lista ma kilka filmów i nic nie trwa)
  canDrag: boolean;
  // Ten film jest właśnie przeciągany
  dragging: boolean;
  // Jakiś film jest przeciągany, więc wiersz przyjmuje upuszczenie
  dragActive: boolean;
  dropIndicator: DropPlacement | null;
  onDragStart: () => void;
  onDragOver: (placement: DropPlacement) => void;
  onDrop: (placement: DropPlacement) => void;
  onDragEnd: () => void;
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
  canDrag,
  dragging,
  dragActive,
  dropIndicator,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMove,
  onRemove,
}: VideoItemProps) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const focusTargetRef = useRef<FocusTarget | null>(null);
  const upRef = useRef<HTMLButtonElement>(null);
  const downRef = useRef<HTMLButtonElement>(null);
  const removeRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const disabled = pending || locked;
  const itemRef = useRef<HTMLLIElement>(null);

  /*
   * Przyciski są wyłączone na czas żądania, więc gubią fokus; oddajemy go po
   * odpowiedzi. Po przesunięciu na skraj listy ten sam kierunek jest wyłączony,
   * wtedy fokus trafia na przeciwny.
   */
  useEffect(() => {
    const target = focusTargetRef.current;
    if (target === null || disabled) {
      return;
    }
    focusTargetRef.current = null;
    if (target === 'up') {
      (isFirst ? downRef : upRef).current?.focus();
    } else if (target === 'down') {
      (isLast ? upRef : downRef).current?.focus();
    } else if (target === 'remove') {
      removeRef.current?.focus();
    } else {
      cancelRef.current?.focus();
    }
  }, [disabled, confirming, isFirst, isLast]);

  function move(direction: 'up' | 'down') {
    focusTargetRef.current = direction;
    onMove(direction);
  }

  // Górna połowa wiersza to „przed”, dolna „za”
  function placementAt(clientY: number): DropPlacement {
    const rect = itemRef.current?.getBoundingClientRect();
    return rect !== undefined && clientY < rect.top + rect.height / 2
      ? 'before'
      : 'after';
  }

  function handleDragStart(event: DragEvent<HTMLSpanElement>) {
    const { dataTransfer } = event;
    dataTransfer.effectAllowed = 'move';
    // Firefox nie zaczyna przeciągania bez danych
    dataTransfer.setData('text/plain', video.itemId);
    if (itemRef.current && typeof dataTransfer.setDragImage === 'function') {
      dataTransfer.setDragImage(itemRef.current, 16, 16);
    }
    onDragStart();
  }

  function handleDragOver(event: DragEvent<HTMLLIElement>) {
    if (!dragActive) {
      return;
    }
    // Bez preventDefault przeglądarka nie pozwoli upuścić
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    onDragOver(placementAt(event.clientY));
  }

  function handleDrop(event: DragEvent<HTMLLIElement>) {
    if (!dragActive) {
      return;
    }
    event.preventDefault();
    onDrop(placementAt(event.clientY));
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
      ref={itemRef}
      className={classNames(
        'video-item',
        !video.available && 'video-item--unavailable',
        dragging && 'video-item--dragging',
        dropIndicator !== null && `video-item--drop-${dropIndicator}`,
      )}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <span
        className={
          canDrag
            ? 'video-item__handle'
            : 'video-item__handle video-item__handle--disabled'
        }
        draggable={canDrag}
        aria-hidden="true"
        title={t.dragToReorder}
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
      >
        <svg width="12" height="16" viewBox="0 0 12 16" aria-hidden="true">
          <circle cx="3" cy="3" r="1.5" />
          <circle cx="9" cy="3" r="1.5" />
          <circle cx="3" cy="8" r="1.5" />
          <circle cx="9" cy="8" r="1.5" />
          <circle cx="3" cy="13" r="1.5" />
          <circle cx="9" cy="13" r="1.5" />
        </svg>
      </span>
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
            <a
              className="video-item__link"
              href={`https://www.youtube.com/watch?v=${encodeURIComponent(video.videoId)}&list=${encodeURIComponent(playlistId)}`}
              target="_blank"
              rel="noreferrer"
              title={video.title}
            >
              {video.title}
            </a>
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
            ref={upRef}
            type="button"
            className="button button--small"
            onClick={() => move('up')}
            disabled={disabled || isFirst}
          >
            {t.moveUp} {target}
          </button>
          <button
            ref={downRef}
            type="button"
            className="button button--small"
            onClick={() => move('down')}
            disabled={disabled || isLast}
          >
            {t.moveDown} {target}
          </button>
          <button
            ref={removeRef}
            type="button"
            className="button button--danger button--small"
            onClick={startConfirm}
            disabled={disabled}
          >
            {t.removeVideo} {target}
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
