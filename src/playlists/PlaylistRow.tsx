import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import type { Playlist } from '../youtube/types';
import { formatDate, privacyLabel } from './format';

export const MAX_TITLE_LENGTH = 150;

type Mode = 'view' | 'edit' | 'confirmDelete';
type FocusTarget = 'input' | 'rename' | 'delete' | 'cancelDelete';

type PlaylistRowProps = {
  playlist: Playlist;
  onRename: (playlist: Playlist, newTitle: string) => Promise<void>;
  onDelete: (playlist: Playlist) => Promise<void>;
};

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Coś poszło nie tak.';
}

export function PlaylistRow({
  playlist,
  onRename,
  onDelete,
}: PlaylistRowProps) {
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

  async function runPending(action: () => Promise<void>): Promise<boolean> {
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
      setError(toMessage(caught));
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
    if (title === '') {
      setError('Nazwa nie może być pusta.');
      return;
    }
    if ([...title].length > MAX_TITLE_LENGTH) {
      setError(`Nazwa może mieć najwyżej ${MAX_TITLE_LENGTH} znaków.`);
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
        {mode === 'edit' ? (
          <form
            className="playlist-row__edit"
            onSubmit={handleSubmit}
            noValidate
          >
            <label className="visually-hidden" htmlFor={inputId}>
              Nowa nazwa playlisty
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
              {pending ? 'Zapisywanie...' : 'Zapisz'}
            </button>
            <button
              type="button"
              className="button button--small"
              onClick={cancelEdit}
              disabled={pending}
            >
              Anuluj
            </button>
          </form>
        ) : (
          <a
            className="playlist-row__link"
            href={`https://www.youtube.com/playlist?list=${encodeURIComponent(playlist.id)}`}
            target="_blank"
            rel="noreferrer"
            title={playlist.title}
          >
            {playlist.title}
          </a>
        )}
        {hasError && (
          <p id={errorId} className="playlist-row__error" role="alert">
            {error}
          </p>
        )}
      </th>
      <td
        className="playlist-row__cell playlist-row__cell--number"
        role="cell"
        data-label="Filmy"
      >
        {playlist.itemCount}
      </td>
      <td
        className="playlist-row__cell playlist-row__cell--nowrap"
        role="cell"
        data-label="Widoczność"
      >
        {playlist.privacyStatus === 'private' && (
          <>
            <span className="playlist-row__lock" aria-hidden="true">
              🔒
            </span>{' '}
          </>
        )}
        {privacyLabel(playlist.privacyStatus)}
      </td>
      <td
        className="playlist-row__cell playlist-row__cell--nowrap"
        role="cell"
        data-label="Utworzona"
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
            aria-label={`Potwierdzenie usunięcia playlisty ${playlist.title}`}
          >
            <span className="playlist-row__question">Usunąć na stałe?</span>
            <button
              type="button"
              className="button button--danger button--small"
              onClick={handleConfirmDelete}
              disabled={pending}
            >
              {pending ? 'Usuwanie...' : 'Usuń na stałe'}
            </button>
            <button
              ref={cancelDeleteRef}
              type="button"
              className="button button--small"
              onClick={() => switchMode('view', 'delete')}
              disabled={pending}
            >
              Anuluj
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
              Zmień nazwę{' '}
              <span className="visually-hidden">
                playlisty {playlist.title}
              </span>
            </button>
            <button
              ref={deleteButtonRef}
              type="button"
              className="button button--danger button--small"
              onClick={() => switchMode('confirmDelete', 'cancelDelete')}
              disabled={mode === 'edit'}
            >
              Usuń{' '}
              <span className="visually-hidden">
                playlistę {playlist.title}
              </span>
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
