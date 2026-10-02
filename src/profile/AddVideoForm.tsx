import { useId, useState, type FormEvent } from 'react';
import { useI18n } from '../i18n/LocaleProvider';
import { parseVideoId } from '../youtube/videoId';

type AddVideoFormProps = {
  // Inna operacja na filmach trwa
  locked: boolean;
  adding: boolean;
  // Odrzuca Error z gotowym komunikatem dla użytkownika
  onAdd: (videoId: string) => Promise<void>;
};

export function AddVideoForm({ locked, adding, onAdd }: AddVideoFormProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const inputId = useId();
  const errorId = useId();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked || adding) {
      return;
    }
    setAdded(false);
    const videoId = parseVideoId(draft);
    if (videoId === null) {
      setError(t.invalidVideo);
      return;
    }
    setError(null);
    try {
      await onAdd(videoId);
      setDraft('');
      setAdded(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.genericError);
    }
  }

  const hasError = error !== null;

  return (
    <form className="profile__add" onSubmit={handleSubmit} noValidate>
      <label className="field__label" htmlFor={inputId}>
        {t.addVideoLabel}
      </label>
      <div className="profile__add-row">
        <input
          id={inputId}
          className="input"
          type="text"
          value={draft}
          placeholder={t.addVideoPlaceholder}
          onChange={(event) => {
            setDraft(event.target.value);
            setAdded(false);
          }}
          readOnly={adding}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : undefined}
        />
        <button
          type="submit"
          className="button button--primary"
          disabled={locked || adding}
        >
          {adding ? t.working : t.addVideo}
        </button>
      </div>
      <p className="profile__notice" role="status">
        {added ? t.videoAdded : ''}
      </p>
      {hasError && (
        <p id={errorId} className="profile__error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
