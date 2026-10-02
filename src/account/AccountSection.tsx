import { formatDate } from '../playlists/format';
import { useI18n } from '../i18n/LocaleProvider';
import { formatCount } from './formatCount';
import type { ChannelState } from './useChannel';

type AccountSectionProps = {
  state: ChannelState;
  // null, dopóki lista playlist się wczytuje
  playlistCount: number | null;
};

type Stat = { label: string; value: string };

export function AccountSection({ state, playlistCount }: AccountSectionProps) {
  const { t } = useI18n();

  if (state.status === 'unavailable') {
    return null;
  }
  if (state.status === 'loading') {
    return <div className="account account--loading" aria-hidden="true" />;
  }
  const { channel } = state;
  if (channel === null) {
    return <p className="account account--empty">{t.noChannel}</p>;
  }

  const format = (value: number) => formatCount(value, t.thousandsSeparator);
  const stats: Stat[] = [];
  if (channel.subscriberCount !== null) {
    stats.push({
      label: t.statSubscribers,
      value: format(channel.subscriberCount),
    });
  }
  stats.push({ label: t.statVideos, value: format(channel.videoCount) });
  stats.push({ label: t.statViews, value: format(channel.viewCount) });
  if (playlistCount !== null) {
    stats.push({ label: t.statPlaylists, value: format(playlistCount) });
  }
  const since = formatDate(channel.publishedAt);

  return (
    <section className="account" aria-label={t.accountLabel}>
      {channel.thumbnailUrl === null ? (
        <span className="account__avatar" aria-hidden="true" />
      ) : (
        <img
          className="account__avatar"
          src={channel.thumbnailUrl}
          alt=""
          width={48}
          height={48}
          referrerPolicy="no-referrer"
        />
      )}
      <div className="account__identity">
        <p className="account__name">{channel.title}</p>
        {/* Data założenia opisuje kanał, więc stoi przy nazwie, a kafle zostają dla liczb */}
        <p className="account__meta">
          {channel.handle !== null && (
            <>
              {channel.handle} <span aria-hidden="true">·</span>{' '}
            </>
          )}
          {t.statCreated} <time dateTime={since}>{since}</time>
        </p>
      </div>
      <dl className="account__stats">
        {stats.map((stat) => (
          <div key={stat.label} className="account__stat">
            <dt>{stat.label}</dt>
            <dd>{stat.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
