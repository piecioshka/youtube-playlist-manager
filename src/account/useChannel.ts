import { useEffect, useState } from 'react';
import type { Channel } from '../youtube/types';
import { useYouTube } from '../youtube/YouTubeProvider';

export type ChannelState = {
  status: 'loading' | 'ready' | 'unavailable';
  channel: Channel | null;
};

const LOADING: ChannelState = { status: 'loading', channel: null };

// Pasek konta jest dodatkiem: błąd nie psuje reszty aplikacji
export function useChannel(): ChannelState {
  const youtube = useYouTube();
  const [state, setState] = useState<ChannelState>(LOADING);

  useEffect(() => {
    let cancelled = false;
    youtube.getMyChannel().then(
      (channel) => {
        if (!cancelled) {
          setState({ status: 'ready', channel });
        }
      },
      () => {
        if (!cancelled) {
          setState({ status: 'unavailable', channel: null });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [youtube]);

  return state;
}
