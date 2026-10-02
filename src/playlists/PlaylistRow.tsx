import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { useI18n } from '../i18n/LocaleProvider';
import { routeToHash } from '../routing/route';
import type { Playlist } from '../youtube/types';
import { formatDate } from './format';
import { titleError } from './playlistTitle';

type Mode = 'view' | 'edit' | 'confirmDelete';
type FocusTarget = 'input' | 'rename' | 'delete' | 'cancelDelete';

type PlaylistRowProps = {
  playlist: Playlist;
  onRename: (playlist: Playlist, newTitle: string) => Promise<unknown>;
  onDelete: (playlist: Playlist) => Promise<void>;
};

export function PlaylistRow({
  playlist,
  onRename,
  onDelete,
}: PlaylistRowProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>('view');
  const [draft, setDraft] = useState(playlist.title);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const focusTargetRef = useRef<FocusTarget | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const renameButtonRef = useRef<HTMLButtonElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const inputId = useId();
  const errorId = useId();

  // Fokus przenosimy dopiero po wyrenderowaniu nowego trybu
  useEffect(() => {
    const target = focusTargetRef.current;
    focusTargetRef.current = null;
    if (target === 'input') {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (target === 'rename') {
      renameButtonRef.current?.focus();
    } else if (target === 'delete') {
      deleteButtonRef.current?.focus();
    } else if (target === 'cancelDelete') {
      cancelDeleteRef.current?.focus();
    }
  }, [mode]);

  function switchMode(next: Mode, focusTarget: FocusTarget) {
    focusTargetRef.current = focusTarget;
    setError(null);
    setMode(next);
  }

  function startEdit() {
    setDraft(playlist.title);
    switchMode('edit', 'input');
  }

  function cancelEdit() {
    if (!pendingRef.current) {
      switchMode('view', 'rename');
    }
  }

  async function runPending(action: () => Promise<unknown>): Promise<boolean> {
    if (pendingRef.current) {
      return false;
    }
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.genericError);
      return false;
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) {
      return;
    }
    const title = draft.trim();
    const invalid = titleError(title, t);
    if (invalid !== null) {
      setError(invalid);
      return;
    }
    if (title === playlist.title.trim()) {
      cancelEdit();
      return;
    }
    const saved = await runPending(() => onRename(playlist, title));
    if (saved) {
      switchMode('view', 'rename');
    }
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelEdit();
    }
  }

  async function handleConfirmDelete() {
    await runPending(() => onDelete(playlist));
  }

  const hasError = error !== null;

  return (
    <tr className="playlist-row" role="row">
      <th
        className="playlist-row__cell playlist-row__title"
        scope="row"
        role="rowheader"
      >
        <div className="playlist-row__name">
          {playlist.thumbnailUrl ? (
            <img
              className="playlist-row__thumbnail"
              src={playlist.thumbnailUrl}
              alt=""
              width={32}
              height={18}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span
              className="playlist-row__thumbnail playlist-row__thumbnail--empty"
              aria-hidden="true"
            />
          )}
          {mode === 'edit' ? (
            <form
              className="playlist-row__edit"
              onSubmit={handleSubmit}
              noValidate
            >
              <label className="visually-hidden" htmlFor={inputId}>
                {t.newTitleLabel}
              </label>
              <input
                id={inputId}
                ref={inputRef}
                className="playlist-row__input"
                type="text"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleInputKeyDown}
                readOnly={pending}
                aria-invalid={hasError}
                aria-describedby={hasError ? errorId : undefined}
              />
              <button
                type="submit"
                className="button button--primary button--small"
                disabled={pending}
              >
                {pending ? t.saving : t.save}
              </button>
              <button
                type="button"
                className="button button--small"
                onClick={cancelEdit}
                disabled={pending}
              >
                {t.cancel}
              </button>
            </form>
          ) : (
            <a
              className="playlist-row__link"
              href={routeToHash({ name: 'playlist', id: playlist.id })}
              title={playlist.title}
            >
              {playlist.title}
            </a>
          )}
        </div>
        {hasError && (
          <p id={errorId} className="playlist-row__error" role="alert">
            {error}
          </p>
        )}
      </th>
      <td
        className="playlist-row__cell playlist-row__cell--number"
        role="cell"
        data-label={t.columnVideos}
      >
        {playlist.itemCount}
      </td>
      <td
        className="playlist-row__cell playlist-row__cell--nowrap"
        role="cell"
        data-label={t.columnPrivacy}
      >
        {playlist.privacyStatus === 'private' && (
          <>
            <span className="playlist-row__lock" aria-hidden="true">
              🔒
            </span>{' '}
          </>
        )}
        {t.privacy[playlist.privacyStatus]}
      </td>
      <td
        className="playlist-row__cell playlist-row__cell--nowrap"
        role="cell"
        data-label={t.columnCreated}
      >
        <time dateTime={playlist.publishedAt}>
          {formatDate(playlist.publishedAt)}
        </time>
      </td>
      <td className="playlist-row__cell playlist-row__actions" role="cell">
        {mode === 'confirmDelete' ? (
          <div
            className="playlist-row__buttons"
            role="group"
            aria-label={t.confirmDeleteLabel(playlist.title)}
          >
            <span className="playlist-row__question">
              {t.confirmDeleteQuestion}
            </span>
            <button
              type="button"
              className="button button--danger button--small"
              onClick={handleConfirmDelete}
              disabled={pending}
            >
              {pending ? t.deleting : t.deletePermanently}
            </button>
            <button
              ref={cancelDeleteRef}
              type="button"
              className="button button--small"
              onClick={() => switchMode('view', 'delete')}
              disabled={pending}
            >
              {t.cancel}
            </button>
          </div>
        ) : (
          <div className="playlist-row__buttons">
            <button
              ref={renameButtonRef}
              type="button"
              className="button button--small"
              onClick={startEdit}
              disabled={mode === 'edit'}
            >
              {t.rename}{' '}
              <span className="visually-hidden">
                {t.renameTarget(playlist.title)}
              </span>
            </button>
            <button
              ref={deleteButtonRef}
              type="button"
              className="button button--danger button--small"
              onClick={() => switchMode('confirmDelete', 'cancelDelete')}
              disabled={mode === 'edit'}
            >
              {t.delete}{' '}
              <span className="visually-hidden">
                {t.deleteTarget(playlist.title)}
              </span>
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
