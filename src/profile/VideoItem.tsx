import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/LocaleProvider';
import type { PlaylistVideo } from '../youtube/types';

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

  const target = (
    <span className="visually-hidden">{t.videoTarget(video.title)}</span>
  );

  return (
    <li className="video-item">
      <span className="video-item__position">{number}</span>
      {video.thumbnailUrl ? (
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
      </div>
      {confirming ? (
        <div
          className="video-item__actions"
          role="group"
          aria-label={t.removeVideoQuestion(video.title)}
        >
          <span className="video-item__question">
            {t.removeVideoQuestion(video.title)}
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
