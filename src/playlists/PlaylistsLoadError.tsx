import { useI18n } from '../i18n/LocaleProvider';
import { errorMessage } from '../youtube/errorMessage';
import { isApiError } from './usePlaylists';

type PlaylistsLoadErrorProps = {
  error: unknown;
  onRetry: () => void;
};

export function PlaylistsLoadError({
  error,
  onRetry,
}: PlaylistsLoadErrorProps) {
  const { t } = useI18n();
  // 404 przy wczytywaniu listy znaczy brak kanału, nie brak playlisty
  const message = isApiError(error, 'notFound')
    ? t.noChannel
    : errorMessage(error, t);

  return (
    <div className="playlists__state notice notice--error" role="alert">
      <p className="playlists__error-text">{message}</p>
      <button type="button" className="button" onClick={onRetry}>
        {t.retry}
      </button>
    </div>
  );
}
