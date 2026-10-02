import { useEffect, useRef } from 'react';
import { useI18n } from '../i18n/LocaleProvider';
import { formatDate } from '../playlists/format';
import { routeToHash } from '../routing/route';
import type { Playlist } from '../youtube/types';

type ProfileHeaderProps = {
  playlist: Playlist;
};

export function ProfileHeader({ playlist }: ProfileHeaderProps) {
  const { t } = useI18n();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Link z tabeli znika razem z nią, więc fokus przechodzi na tytuł profilu
  useEffect(() => {
    headingRef.current?.focus();
  }, [playlist.id]);

  return (
    <section className="profile" aria-labelledby="profile-heading">
      <a className="profile__back" href={routeToHash({ name: 'list' })}>
        <span aria-hidden="true">←</span> {t.allPlaylists}
      </a>
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
        <a
          className="profile__youtube"
          href={`https://www.youtube.com/playlist?list=${encodeURIComponent(playlist.id)}`}
          target="_blank"
          rel="noreferrer"
        >
          {t.openOnYouTube}
        </a>
      </div>
    </section>
  );
}
