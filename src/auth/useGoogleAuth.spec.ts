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

beforeEach(() => {
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
      message: 'Nie udało się zalogować. Spróbuj ponownie.',
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

    expect(result.current.message).toBe(
      'Nie udało się otworzyć okna logowania Google.',
    );
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

    act(() => result.current.signOut('Sesja wygasła, zaloguj się ponownie.'));

    expect(revoke).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({
      status: 'signedOut',
      token: null,
      message: 'Sesja wygasła, zaloguj się ponownie.',
    });
  });

  it('reports a script that failed to load', async () => {
    vi.mocked(loadGis).mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useGoogleAuth('client-1'));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.message).toBe(
      'Nie udało się wczytać logowania Google. Sprawdź połączenie.',
    );
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
});
