import { useId, useRef, useState, type FormEvent } from 'react';
import { useI18n } from '../i18n/LocaleProvider';
import { MAX_TITLE_LENGTH } from '../playlists/PlaylistRow';
import type { PlaylistChanges } from '../youtube/api';
import type { Playlist, PrivacyStatus } from '../youtube/types';

export const MAX_DESCRIPTION_LENGTH = 5000;

const PRIVACY_STATUSES: readonly PrivacyStatus[] = [
  'public',
  'unlisted',
  'private',
];

type Draft = {
  title: string;
  description: string;
  privacyStatus: PrivacyStatus;
};

type PlaylistFormProps = {
  playlist: Playlist;
  // Odrzuca Error z gotowym komunikatem dla użytkownika
  onSave: (changes: PlaylistChanges) => Promise<Playlist>;
};

function toDraft(playlist: Playlist): Draft {
  return {
    title: playlist.title,
    description: playlist.description,
    privacyStatus: playlist.privacyStatus,
  };
}

function isPrivacyStatus(value: string): value is PrivacyStatus {
  return PRIVACY_STATUSES.some((status) => status === value);
}

// Wysyłamy tylko zmienione pola; resztę updatePlaylist uzupełnia z bieżącej playlisty
function changesFrom(draft: Draft, playlist: Playlist): PlaylistChanges {
  const changes: PlaylistChanges = {};
  const title = draft.title.trim();
  if (title !== playlist.title) {
    changes.title = title;
  }
  if (draft.description !== playlist.description) {
    changes.description = draft.description;
  }
  if (draft.privacyStatus !== playlist.privacyStatus) {
    changes.privacyStatus = draft.privacyStatus;
  }
  return changes;
}

export function PlaylistForm({ playlist, onSave }: PlaylistFormProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<Draft>(() => toDraft(playlist));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titleInvalid, setTitleInvalid] = useState(false);
  const [saved, setSaved] = useState(false);
  const pendingRef = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const privacyId = useId();
  const errorId = useId();

  const changed = Object.keys(changesFrom(draft, playlist)).length > 0;

  function update(next: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...next }));
    setSaved(false);
  }

  function reset() {
    setDraft(toDraft(playlist));
    setError(null);
    setTitleInvalid(false);
    setSaved(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) {
      return;
    }
    const title = draft.title.trim();
    const titleError =
      title === ''
        ? t.titleEmpty
        : [...title].length > MAX_TITLE_LENGTH
          ? t.titleTooLong(MAX_TITLE_LENGTH)
          : null;
    if (titleError !== null) {
      setError(titleError);
      setTitleInvalid(true);
      titleRef.current?.focus();
      return;
    }
    const changes = changesFrom(draft, playlist);
    if (Object.keys(changes).length === 0) {
      return;
    }

    pendingRef.current = true;
    setPending(true);
    setError(null);
    setTitleInvalid(false);
    try {
      const updated = await onSave(changes);
      setDraft(toDraft(updated));
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.genericError);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <form
      className="profile__form"
      aria-label={t.playlistSettings}
      onSubmit={handleSubmit}
      noValidate
    >
      <div className="field">
        <label className="field__label" htmlFor={titleId}>
          {t.titleLabel}
        </label>
        <input
          id={titleId}
          ref={titleRef}
          className="input"
          type="text"
          value={draft.title}
          onChange={(event) => update({ title: event.target.value })}
          readOnly={pending}
          required
          aria-invalid={titleInvalid}
          aria-describedby={titleInvalid ? errorId : undefined}
        />
      </div>
      <div className="field">
        <label className="field__label" htmlFor={descriptionId}>
          {t.descriptionLabel}
        </label>
        <textarea
          id={descriptionId}
          className="textarea"
          rows={4}
          maxLength={MAX_DESCRIPTION_LENGTH}
          value={draft.description}
          onChange={(event) => update({ description: event.target.value })}
          readOnly={pending}
        />
      </div>
      <div className="field">
        <label className="field__label" htmlFor={privacyId}>
          {t.visibilityLabel}
        </label>
        <select
          id={privacyId}
          className="select field__select"
          value={draft.privacyStatus}
          onChange={(event) => {
            const value = event.target.value;
            if (isPrivacyStatus(value)) {
              update({ privacyStatus: value });
            }
          }}
          disabled={pending}
        >
          {PRIVACY_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t.privacy[status]}
            </option>
          ))}
        </select>
      </div>
      <div className="profile__form-actions">
        <button
          type="submit"
          className="button button--primary"
          disabled={!changed || pending}
        >
          {pending ? t.saving : t.save}
        </button>
        <button
          type="button"
          className="button"
          onClick={reset}
          disabled={!changed || pending}
        >
          {t.reset}
        </button>
        <p className="profile__notice" role="status">
          {saved ? t.playlistSaved : ''}
        </p>
      </div>
      {error !== null && (
        <p id={errorId} className="profile__error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
