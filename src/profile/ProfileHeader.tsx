import { useEffect, useRef, type ReactNode } from 'react';
import { useI18n } from '../i18n/LocaleProvider';
import { formatDate } from '../playlists/format';
import { routeToHash } from '../routing/route';
import type { Playlist } from '../youtube/types';
import { YouTubeLink } from '../youtube/YouTubeLink';

type ProfileHeaderProps = {
  playlist: Playlist;
  // Panel edycji jest otwarty; przycisk „Edytuj” go pokazuje i chowa
  editing: boolean;
  editorId: string;
  onToggleEdit: () => void;
  // Pozostałe akcje na playliście, w tym samym rzędzie za „Edytuj”
  actions: ReactNode;
};

export function ProfileHeader({
  playlist,
  editing,
  editorId,
  onToggleEdit,
  actions,
}: ProfileHeaderProps) {
  const { t } = useI18n();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Link z tabeli znika razem z nią, więc fokus przechodzi na tytuł profilu
  useEffect(() => {
    headingRef.current?.focus();
  }, [playlist.id]);

  return (
    <>
      {/* Powrót do listy w osobnym pasku, żeby nie ginął nad danymi playlisty */}
      <div className="profile-nav">
        <a className="profile__back" href={routeToHash({ name: 'list' })}>
          <span aria-hidden="true">←</span> {t.allPlaylists}
        </a>
      </div>
      <section className="profile" aria-labelledby="profile-heading">
        {playlist.thumbnailUrl ? (
          <img
            className="profile__thumbnail"
            src={playlist.thumbnailUrl}
            alt=""
            width={160}
            height={90}
            decoding="async"
          />
        ) : (
          <span
            className="profile__thumbnail profile__thumbnail--empty"
            aria-hidden="true"
          />
        )}
        <div className="profile__text">
          <h2
            id="profile-heading"
            ref={headingRef}
            className="profile__title"
            tabIndex={-1}
          >
            {playlist.title}
          </h2>
          <p className="profile__meta">
            {t.videoCount(playlist.itemCount)} ·{' '}
            {playlist.privacyStatus === 'private' && (
              <>
                <span aria-hidden="true">🔒</span>{' '}
              </>
            )}
            {t.privacy[playlist.privacyStatus]} ·{' '}
            <time dateTime={playlist.publishedAt}>
              {formatDate(playlist.publishedAt)}
            </time>
          </p>
          <div className="profile__actions">
            <YouTubeLink
              className="profile__youtube"
              href={`https://www.youtube.com/playlist?list=${encodeURIComponent(playlist.id)}`}
            >
              {t.openOnYouTube}
            </YouTubeLink>
            <button
              type="button"
              className="button button--small button--edit"
              aria-expanded={editing}
              // Schowanego panelu nie ma w DOM, więc nie ma na co wskazywać
              aria-controls={editing ? editorId : undefined}
              onClick={onToggleEdit}
            >
              {t.editPlaylist}
            </button>
            {actions}
          </div>
        </div>
      </section>
    </>
  );
}
