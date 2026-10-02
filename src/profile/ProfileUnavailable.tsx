import { useI18n } from '../i18n/LocaleProvider';
import { PlaylistsLoadError } from '../playlists/PlaylistsLoadError';
import type { LoadState } from '../playlists/usePlaylists';
import { routeToHash } from '../routing/route';

type ProfileUnavailableProps = {
  loadState: LoadState;
  onRetry: () => void;
};

// Adres profilu bez playlisty na liście: lista jeszcze się wczytuje, nie wczytała się albo playlisty nie ma
export function ProfileUnavailable({
  loadState,
  onRetry,
}: ProfileUnavailableProps) {
  const { t } = useI18n();

  return (
    <div className="profile-page">
      {loadState.status === 'loading' && (
        <p className="playlists__state">{t.loading}</p>
      )}
      {loadState.status === 'error' && (
        <PlaylistsLoadError error={loadState.error} onRetry={onRetry} />
      )}
      {loadState.status === 'ready' && (
        <p className="playlists__state">
          {t.playlistNotFound}{' '}
          <a
            className="profile__back-inline"
            href={routeToHash({ name: 'list' })}
          >
            {t.allPlaylists}
          </a>
        </p>
      )}
    </div>
  );
}
