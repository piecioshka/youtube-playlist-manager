import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/LocaleProvider';
import type { Playlist } from '../youtube/types';

type FocusTarget = 'delete' | 'cancel';

type DeletePlaylistProps = {
  playlist: Playlist;
  // Odrzuca Error z gotowym komunikatem dla użytkownika
  onDelete: () => Promise<void>;
};

// Usuwanie playlisty z potwierdzeniem w miejscu; stoi w nagłówku profilu obok „Edytuj”
export function DeletePlaylist({ playlist, onDelete }: DeletePlaylistProps) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const focusTargetRef = useRef<FocusTarget | null>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Fokus przenosimy dopiero po wyrenderowaniu nowego stanu
  useEffect(() => {
    const target = focusTargetRef.current;
    focusTargetRef.current = null;
    if (target === 'delete') {
      deleteRef.current?.focus();
    } else if (target === 'cancel') {
      cancelRef.current?.focus();
    }
  }, [confirming]);

  function switchTo(next: boolean, focusTarget: FocusTarget) {
    focusTargetRef.current = focusTarget;
    setError(null);
    setConfirming(next);
  }

  async function handleConfirm() {
    if (pending) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onDelete();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.genericError);
      setPending(false);
    }
  }

  return (
    <div className="profile__delete">
      {confirming ? (
        <div
          className="profile__confirm"
          role="group"
          aria-label={t.confirmDeleteLabel(playlist.title)}
        >
          <span className="profile__question">{t.confirmDeleteQuestion}</span>
          <button
            type="button"
            className="button button--danger button--small"
            onClick={handleConfirm}
            disabled={pending}
          >
            {pending ? t.deleting : t.deletePermanently}
          </button>
          <button
            ref={cancelRef}
            type="button"
            className="button button--small"
            onClick={() => switchTo(false, 'delete')}
            disabled={pending}
          >
            {t.cancel}
          </button>
        </div>
      ) : (
        <button
          ref={deleteRef}
          type="button"
          className="button button--danger button--small"
          onClick={() => switchTo(true, 'cancel')}
        >
          {t.deletePlaylist}
        </button>
      )}
      {error !== null && (
        <p className="profile__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
