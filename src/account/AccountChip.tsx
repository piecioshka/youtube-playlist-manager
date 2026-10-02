import { useI18n } from '../i18n/LocaleProvider';
import type { Channel } from '../youtube/types';
import { ExternalIcon } from '../youtube/YouTubeLink';

type AccountChipProps = {
  channel: Channel;
};

export function AccountChip({ channel }: AccountChipProps) {
  const { t } = useI18n();

  return (
    <a
      className="account-chip external-link"
      href={`https://www.youtube.com/channel/${channel.id}`}
      target="_blank"
      rel="noreferrer"
      title={t.openChannel}
    >
      {channel.thumbnailUrl === null ? (
        <span className="account-chip__avatar" aria-hidden="true" />
      ) : (
        <img
          className="account-chip__avatar"
          src={channel.thumbnailUrl}
          alt=""
          width={24}
          height={24}
          referrerPolicy="no-referrer"
        />
      )}
      <span className="account-chip__name external-link__text">
        {channel.title}
      </span>
      <ExternalIcon />
    </a>
  );
}
