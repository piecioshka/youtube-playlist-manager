import { useCallback, useEffect, useRef, useState } from 'react';
import { YOUTUBE_SCOPE } from '../config';
import { loadGis } from './loadGis';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'error';

export type GoogleAuth = {
  status: AuthStatus;
  token: string | null;
  message: string | null;
  signIn: () => void;
  signOut: (reason?: string) => void;
};

const SIGN_IN_FAILED = 'Nie udało się zalogować. Spróbuj ponownie.';
const POPUP_FAILED = 'Nie udało się otworzyć okna logowania Google.';
const SCRIPT_FAILED =
  'Nie udało się wczytać logowania Google. Sprawdź połączenie.';

export function useGoogleAuth(clientId: string): GoogleAuth {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const tokenClientRef = useRef<google.accounts.oauth2.TokenClient | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    loadGis().then(
      () => {
        if (cancelled) {
          return;
        }
        tokenClientRef.current = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: YOUTUBE_SCOPE,
          callback: (response) => {
            if (!response.access_token) {
              setMessage(SIGN_IN_FAILED);
              return;
            }
            setToken(response.access_token);
            setMessage(null);
            setStatus('signedIn');
          },
          error_callback: (error) => {
            // Zamknięcie okienka to świadoma decyzja użytkownika, nie błąd
            if (error.type !== 'popup_closed') {
              setMessage(POPUP_FAILED);
            }
          },
        });
        setStatus('signedOut');
      },
      () => {
        if (cancelled) {
          return;
        }
        setStatus('error');
        setMessage(SCRIPT_FAILED);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const signIn = useCallback(() => {
    setMessage(null);
    tokenClientRef.current?.requestAccessToken();
  }, []);

  const signOut = useCallback(
    (reason?: string) => {
      // Wygasły token nie wymaga unieważnienia, ręczne wylogowanie tak
      if (token !== null && reason === undefined) {
        google.accounts.oauth2.revoke(token, () => undefined);
      }
      setToken(null);
      setStatus('signedOut');
      setMessage(reason ?? null);
    },
    [token],
  );

  return { status, token, message, signIn, signOut };
}
