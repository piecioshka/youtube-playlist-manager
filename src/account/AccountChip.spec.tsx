import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithI18n } from '../test/renderWithI18n';
import type { Channel } from '../youtube/types';
import { AccountChip } from './AccountChip';

const channel: Channel = {
  id: 'UC-me',
  title: 'Kanał testowy',
  handle: null,
  thumbnailUrl: 'https://yt3.ggpht.com/default.jpg',
  publishedAt: '2012-03-04T10:00:00Z',
  subscriberCount: null,
  videoCount: 1,
  viewCount: 1,
};

describe('AccountChip', () => {
  it('links to the channel on YouTube with the title and avatar', () => {
    const { container } = renderWithI18n(<AccountChip channel={channel} />);
    const link = screen.getByRole('link', { name: 'Kanał testowy' });
    expect(link).toHaveAttribute(
      'href',
      'https://www.youtube.com/channel/UC-me',
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
    expect(link).toHaveAttribute('title', 'Otwórz kanał na YouTube');
    const avatar = container.querySelector('img');
    expect(avatar).toHaveAttribute('alt', '');
    expect(avatar).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(avatar).toHaveAttribute('width', '24');
  });

  it('shows a placeholder without a thumbnail', () => {
    const { container } = renderWithI18n(
      <AccountChip channel={{ ...channel, thumbnailUrl: null }} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.account-chip__avatar')).not.toBeNull();
  });
});
