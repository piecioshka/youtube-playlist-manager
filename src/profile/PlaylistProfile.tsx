import { useI18n } from '../i18n/LocaleProvider';
import type { LoadState } from '../playlists/usePlaylists';
import { routeToHash } from '../routing/route';
import type { Playlist } from '../youtube/types';

type PlaylistProfileProps = {
  playlist: Playlist | undefined;
  listStatus: LoadState['status'];
};

export function PlaylistProfile({
  playlist,
  listStatus,
}: PlaylistProfileProps) {
  const { t } = useI18n();

  return (
    <section className="profile" aria-labelledby="profile-heading">
      <a className="profile__back" href={routeToHash({ name: 'list' })}>
        ← {t.allPlaylists}
      </a>
      {listStatus === 'loading' && (
        <p className="playlists__state">{t.loading}</p>
      )}
      {playlist !== undefined && (
        <h2 id="profile-heading" className="profile__title">
          {playlist.title}
        </h2>
      )}
    </section>
  );
}
