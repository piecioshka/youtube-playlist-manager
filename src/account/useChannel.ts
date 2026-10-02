import { useEffect, useEffectEvent, useState } from 'react';
import { getMyChannel } from '../youtube/api';
import { ApiError, type Channel } from '../youtube/types';

export type ChannelState = {
  status: 'loading' | 'ready' | 'unavailable';
  channel: Channel | null;
};

type UseChannelOptions = {
  token: string;
  onUnauthorized: () => void;
};

const LOADING: ChannelState = { status: 'loading', channel: null };

// Pasek konta jest dodatkiem: poza wygasłą sesją błąd nie psuje reszty aplikacji
export function useChannel({
  token,
  onUnauthorized,
}: UseChannelOptions): ChannelState {
  const [state, setState] = useState<ChannelState>(LOADING);
  const notifyUnauthorized = useEffectEvent(() => onUnauthorized());

  useEffect(() => {
    let cancelled = false;
    getMyChannel(token).then(
      (channel) => {
        if (!cancelled) {
          setState({ status: 'ready', channel });
        }
      },
      (error: unknown) => {
        if (cancelled) {
          return;
        }
        if (error instanceof ApiError && error.kind === 'unauthorized') {
          notifyUnauthorized();
          return;
        }
        setState({ status: 'unavailable', channel: null });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [token]);

  return state;
}
