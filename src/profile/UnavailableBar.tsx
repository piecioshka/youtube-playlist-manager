import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/LocaleProvider';

type FocusTarget = 'start' | 'cancel';

type UnavailableBarProps = {
  count: number;
  progress: { done: number; total: number } | null;
  error: string | null;
  // Inna operacja na filmach trwa
  locked: boolean;
  onConfirm: () => Promise<void>;
};

// Przycisk „Usuń niedostępne (N)” z potwierdzeniem w miejscu, postępem i błędem
export function UnavailableBar({
  count,
  progress,
  error,
  locked,
  onConfirm,
}: UnavailableBarProps) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const focusTargetRef = useRef<FocusTarget | null>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const target = focusTargetRef.current;
    focusTargetRef.current = null;
    if (target === 'start') {
      startRef.current?.focus();
    } else if (target === 'cancel') {
      cancelRef.current?.focus();
    }
  }, [confirming]);

  function switchTo(next: boolean, focusTarget: FocusTarget) {
    focusTargetRef.current = focusTarget;
    setConfirming(next);
  }

  async function handleConfirm() {
    await onConfirm();
    // Po błędzie pasek zostaje, a fokus wraca na przycisk z nową liczbą
    switchTo(false, 'start');
  }

  const running = progress !== null;
  const question = t.removeUnavailableQuestion(count);

  return (
    <div className="profile__bulk">
      {confirming ? (
        <div className="profile__confirm" role="group" aria-label={question}>
          <span className="profile__question">{question}</span>
          <button
            type="button"
            className="button button--danger button--small"
            onClick={handleConfirm}
            disabled={running || locked}
          >
            {t.remove}
          </button>
          <button
            ref={cancelRef}
            type="button"
            className="button button--small"
            onClick={() => switchTo(false, 'start')}
            disabled={running || locked}
          >
            {t.cancel}
          </button>
        </div>
      ) : (
        <button
          ref={startRef}
          type="button"
          className="button button--danger button--small"
          onClick={() => switchTo(true, 'cancel')}
          disabled={locked}
        >
          {t.removeUnavailable(count)}
        </button>
      )}
      <p className="profile__notice" role="status">
        {progress === null
          ? ''
          : t.removingUnavailable(progress.done, progress.total)}
      </p>
      {error !== null && (
        <p className="profile__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
