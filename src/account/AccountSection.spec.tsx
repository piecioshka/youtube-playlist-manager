import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithI18n } from '../test/renderWithI18n';
import type { Channel } from '../youtube/types';
import { AccountSection } from './AccountSection';
import type { ChannelState } from './useChannel';

const channel: Channel = {
  id: 'UC-me',
  title: 'Kanał testowy',
  handle: '@kanaltestowy',
  thumbnailUrl: 'https://yt3.ggpht.com/default.jpg',
  publishedAt: '2012-03-04T10:00:00Z',
  subscriberCount: 1234,
  videoCount: 56,
  viewCount: 7890123,
};

function ready(overrides: Partial<Channel> = {}): ChannelState {
  return { status: 'ready', channel: { ...channel, ...overrides } };
}

function stat(name: string): string | null {
  const term = screen.getByText(name, { selector: 'dt' });
  return term.nextElementSibling?.textContent ?? null;
}

describe('AccountSection', () => {
  it('shows the name, the handle and every stat', () => {
    renderWithI18n(<AccountSection state={ready()} playlistCount={4} />);
    const section = screen.getByRole('region', { name: 'Twój kanał' });
    expect(within(section).getByText('Kanał testowy')).toBeInTheDocument();
    expect(within(section).getByText('@kanaltestowy')).toBeInTheDocument();
    expect(stat('Subskrypcje')).toBe('1 234');
    expect(stat('Filmy')).toBe('56');
    expect(stat('Wyświetlenia')).toBe('7 890 123');
    expect(stat('Playlisty')).toBe('4');
    expect(stat('Kanał od')).toBe('2012-03-04');
  });

  it('uses the English labels and separator', () => {
    renderWithI18n(<AccountSection state={ready()} playlistCount={4} />, 'en');
    expect(screen.getByRole('region', { name: 'Your channel' })).toBeVisible();
    expect(stat('Subscribers')).toBe('1,234');
    expect(stat('Channel since')).toBe('2012-03-04');
  });

  it('omits hidden subscribers, the missing handle and the unknown playlist count', () => {
    renderWithI18n(
      <AccountSection
        state={ready({ subscriberCount: null, handle: null })}
        playlistCount={null}
      />,
    );
    expect(screen.queryByText('Subskrypcje')).not.toBeInTheDocument();
    expect(screen.queryByText('Playlisty')).not.toBeInTheDocument();
    expect(screen.queryByText('@kanaltestowy')).not.toBeInTheDocument();
  });

  it('shows a decorative avatar', () => {
    const { container } = renderWithI18n(
      <AccountSection state={ready()} playlistCount={0} />,
    );
    const avatar = container.querySelector('img.account__avatar');
    expect(avatar).toHaveAttribute('alt', '');
    expect(avatar).toHaveAttribute('width', '48');
    expect(avatar).toHaveAttribute('src', 'https://yt3.ggpht.com/default.jpg');
  });

  it('shows a placeholder instead of the avatar without a thumbnail', () => {
    const { container } = renderWithI18n(
      <AccountSection
        state={ready({ thumbnailUrl: null })}
        playlistCount={0}
      />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.account__avatar')).not.toBeNull();
  });

  it('says so when the account has no channel', () => {
    renderWithI18n(
      <AccountSection
        state={{ status: 'ready', channel: null }}
        playlistCount={0}
      />,
    );
    expect(
      screen.getByText('Nie znaleziono kanału YouTube na tym koncie.'),
    ).toBeInTheDocument();
  });

  it('renders a hidden placeholder while loading', () => {
    const { container } = renderWithI18n(
      <AccountSection
        state={{ status: 'loading', channel: null }}
        playlistCount={null}
      />,
    );
    const placeholder = container.querySelector('.account--loading');
    expect(placeholder).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('renders nothing when unavailable', () => {
    const { container } = renderWithI18n(
      <AccountSection
        state={{ status: 'unavailable', channel: null }}
        playlistCount={null}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
