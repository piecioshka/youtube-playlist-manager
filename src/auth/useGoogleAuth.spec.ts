import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadGis } from './loadGis';
import { useGoogleAuth } from './useGoogleAuth';

vi.mock('./loadGis', () => ({ loadGis: vi.fn() }));

let tokenConfig: google.accounts.oauth2.TokenClientConfig | null = null;
const requestAccessToken = vi.fn();
const revoke = vi.fn();

function tokenResponse(
  accessToken: string,
): google.accounts.oauth2.TokenResponse {
  return {
    access_token: accessToken,
    expires_in: '3599',
    hd: '',
    prompt: '',
    token_type: 'Bearer',
    scope: 'https://www.googleapis.com/auth/youtube',
    state: '',
    error: '',
    error_description: '',
    error_uri: '',
  };
}

function popupError(
  type: google.accounts.oauth2.ClientConfigError['type'],
): google.accounts.oauth2.ClientConfigError {
  return { name: 'Error', message: type, type };
}

function config(): google.accounts.oauth2.TokenClientConfig {
  if (!tokenConfig) {
    throw new Error('initTokenClient was not called');
  }
  return tokenConfig;
}

async function renderSignedOut() {
  const hook = renderHook(() => useGoogleAuth('client-1'));
  await waitFor(() => expect(hook.result.current.status).toBe('signedOut'));
  return hook;
}

const SESSION_KEY = 'youtube-playlist-manager.session';

function storeSession(token: string, expiresAt: number) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token, expiresAt }));
}

beforeEach(() => {
  sessionStorage.clear();
  tokenConfig = null;
  requestAccessToken.mockReset();
  revoke.mockReset();
  vi.mocked(loadGis).mockResolvedValue(undefined);
  vi.stubGlobal('google', {
    accounts: {
      oauth2: {
        initTokenClient: (
          clientConfig: google.accounts.oauth2.TokenClientConfig,
        ) => {
          tokenConfig = clientConfig;
          return { requestAccessToken };
        },
        revoke,
      },
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useGoogleAuth', () => {
  it('starts loading, then becomes signedOut with the YouTube scope configured', async () => {
    const { result } = renderHook(() => useGoogleAuth('client-1'));
    expect(result.current.status).toBe('loading');

    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(config()).toMatchObject({
      client_id: 'client-1',
      scope: 'https://www.googleapis.com/auth/youtube',
    });
  });

  it('signs in with the token from the callback', async () => {
    const { result } = await renderSignedOut();

    act(() => result.current.signIn());
    expect(requestAccessToken).toHaveBeenCalledTimes(1);

    act(() => config().callback(tokenResponse('tok-1')));
    expect(result.current).toMatchObject({
      status: 'signedIn',
      token: 'tok-1',
      message: null,
    });
  });

  it('reports a callback without a token', async () => {
    const { result } = await renderSignedOut();

    act(() => config().callback(tokenResponse('')));

    expect(result.current).toMatchObject({
      status: 'signedOut',
      token: null,
      message: 'signInFailed',
    });
  });

  it('stays signed out without a message when the user closes the popup', async () => {
    const { result } = await renderSignedOut();

    act(() => config().error_callback?.(popupError('popup_closed')));

    expect(result.current).toMatchObject({
      status: 'signedOut',
      message: null,
    });
  });

  it('reports a popup that failed to open', async () => {
    const { result } = await renderSignedOut();

    act(() => config().error_callback?.(popupError('popup_failed_to_open')));

    expect(result.current.message).toBe('popupFailed');
  });

  it('signOut() revokes the token', async () => {
    const { result } = await renderSignedOut();
    act(() => config().callback(tokenResponse('tok-1')));

    act(() => result.current.signOut());

    expect(revoke).toHaveBeenCalledWith('tok-1', expect.any(Function));
    expect(result.current).toMatchObject({
      status: 'signedOut',
      token: null,
      message: null,
    });
  });

  it('signOut(reason) shows the reason and does not revoke', async () => {
    const { result } = await renderSignedOut();
    act(() => config().callback(tokenResponse('tok-1')));

    act(() => result.current.signOut('sessionExpired'));

    expect(revoke).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({
      status: 'signedOut',
      token: null,
      message: 'sessionExpired',
    });
  });

  it('reports a script that failed to load', async () => {
    vi.mocked(loadGis).mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useGoogleAuth('client-1'));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.message).toBe('scriptFailed');
  });

  it('retries after a failed script load', async () => {
    vi.mocked(loadGis)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useGoogleAuth('client-1'));
    await waitFor(() => expect(result.current.status).toBe('error'));

    act(() => result.current.retry());

    expect(result.current.status).toBe('loading');
    expect(result.current.message).toBeNull();
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(loadGis).toHaveBeenCalledTimes(2);
  });

  describe('session persistence', () => {
    it('saves the session on sign-in with a one-minute safety margin', async () => {
      const { result } = await renderSignedOut();
      const before = Date.now();

      act(() => config().callback(tokenResponse('tok-1')));

      const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null');
      expect(stored.token).toBe('tok-1');
      expect(stored.expiresAt).toBeGreaterThanOrEqual(
        before + 3599 * 1000 - 60_000,
      );
      expect(stored.expiresAt).toBeLessThanOrEqual(
        Date.now() + 3599 * 1000 - 60_000,
      );
      expect(result.current.status).toBe('signedIn');
    });

    it('restores a valid session before GIS loads and keeps it after', async () => {
      storeSession('tok-stored', Date.now() + 600_000);
      vi.mocked(loadGis).mockReturnValue(new Promise(() => undefined));

      const pending = renderHook(() => useGoogleAuth('client-1'));
      expect(pending.result.current).toMatchObject({
        status: 'signedIn',
        token: 'tok-stored',
      });
      pending.unmount();

      vi.mocked(loadGis).mockResolvedValue(undefined);
      const { result } = renderHook(() => useGoogleAuth('client-1'));
      await waitFor(() => expect(tokenConfig).not.toBeNull());
      expect(result.current).toMatchObject({
        status: 'signedIn',
        token: 'tok-stored',
      });
    });

    it('keeps a restored session when the Google script fails to load', async () => {
      storeSession('tok-stored', Date.now() + 600_000);
      vi.mocked(loadGis).mockRejectedValue(new Error('offline'));

      const { result } = renderHook(() => useGoogleAuth('client-1'));
      await waitFor(() => expect(loadGis).toHaveBeenCalled());
      await act(async () => undefined);

      expect(result.current).toMatchObject({
        status: 'signedIn',
        token: 'tok-stored',
        message: null,
      });
    });

    it('signOut() works without the google global and clears the session', async () => {
      storeSession('tok-stored', Date.now() + 600_000);
      vi.mocked(loadGis).mockRejectedValue(new Error('offline'));
      vi.unstubAllGlobals();

      const { result } = renderHook(() => useGoogleAuth('client-1'));
      await act(async () => undefined);

      expect(() => act(() => result.current.signOut())).not.toThrow();
      expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
      expect(result.current).toMatchObject({
        status: 'signedOut',
        token: null,
        message: null,
      });
    });

    it('ignores and removes an expired session', async () => {
      storeSession('tok-old', Date.now() - 1000);

      const { result } = renderHook(() => useGoogleAuth('client-1'));
      expect(result.current.status).toBe('loading');
      expect(result.current.token).toBeNull();
      expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
      await waitFor(() => expect(result.current.status).toBe('signedOut'));
    });

    it('ignores malformed JSON', async () => {
      sessionStorage.setItem(SESSION_KEY, '{nope');

      const { result } = renderHook(() => useGoogleAuth('client-1'));
      expect(result.current.token).toBeNull();
      await waitFor(() => expect(result.current.status).toBe('signedOut'));
    });

    it('ignores a session of the wrong shape and removes it', async () => {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: 5 }));

      const { result } = renderHook(() => useGoogleAuth('client-1'));
      expect(result.current.token).toBeNull();
      expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
      await waitFor(() => expect(result.current.status).toBe('signedOut'));
    });

    it('signOut() removes the stored session', async () => {
      const { result } = await renderSignedOut();
      act(() => config().callback(tokenResponse('tok-1')));

      act(() => result.current.signOut());

      expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
    });

    it('signOut(reason) removes the stored session', async () => {
      const { result } = await renderSignedOut();
      act(() => config().callback(tokenResponse('tok-1')));

      act(() => result.current.signOut('sessionExpired'));

      expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
    });

    it('still signs in when sessionStorage throws', async () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('blocked');
      });

      const { result } = await renderSignedOut();
      act(() => config().callback(tokenResponse('tok-1')));
      expect(result.current).toMatchObject({
        status: 'signedIn',
        token: 'tok-1',
      });

      act(() => result.current.signOut('sessionExpired'));
      expect(result.current.status).toBe('signedOut');
    });
  });
});
