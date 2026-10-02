import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { YOUTUBE_SCOPE } from '../config';
import type { AuthMessage } from '../i18n/messages';
import { loadGis } from './loadGis';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'error';

export type GoogleAuth = {
  status: AuthStatus;
  token: string | null;
  // Klucz komunikatu, nie tekst: ekran logowania tłumaczy go w bieżącym języku
  message: AuthMessage | null;
  signIn: () => void;
  signOut: (reason?: AuthMessage) => void;
  retry: () => void;
};

const SESSION_KEY = 'youtube-playlist-manager.session';
// Zapas na różnicę zegarów i opóźnienie żądania
const SAFETY_MARGIN_MS = 60_000;
const DEFAULT_LIFETIME_SECONDS = 3600;

const sessionSchema = z.object({
  token: z.string().min(1),
  expiresAt: z.number(),
});

function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Zablokowany storage nie może psuć logowania
  }
}

function saveSession(token: string, expiresAt: number): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token, expiresAt }));
  } catch {
    // Zablokowany storage nie może psuć logowania
  }
}

function readSession(): string | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw === null) {
      return null;
    }
    const parsed = sessionSchema.safeParse(JSON.parse(raw));
    if (parsed.success && parsed.data.expiresAt > Date.now()) {
      return parsed.data.token;
    }
    clearSession();
  } catch {
    clearSession();
  }
  return null;
}

export function useGoogleAuth(clientId: string): GoogleAuth {
  const [restoredToken] = useState(readSession);
  const [status, setStatus] = useState<AuthStatus>(
    restoredToken === null ? 'loading' : 'signedIn',
  );
  const [token, setToken] = useState<string | null>(restoredToken);
  const [message, setMessage] = useState<AuthMessage | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const tokenClientRef = useRef<google.accounts.oauth2.TokenClient | null>(
    null,
  );

  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

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
              setMessage('signInFailed');
              return;
            }
            const lifetimeSeconds =
              Number(response.expires_in) || DEFAULT_LIFETIME_SECONDS;
            saveSession(
              response.access_token,
              Date.now() + lifetimeSeconds * 1000 - SAFETY_MARGIN_MS,
            );
            setToken(response.access_token);
            setMessage(null);
            setStatus('signedIn');
          },
          error_callback: (error) => {
            // Zamknięcie okienka to świadoma decyzja użytkownika, nie błąd
            if (error.type !== 'popup_closed') {
              setMessage('popupFailed');
            }
          },
        });
        setStatus((current) =>
          current === 'signedIn' ? current : 'signedOut',
        );
      },
      () => {
        if (cancelled) {
          return;
        }
        // Przywrócona sesja działa bez GIS, błąd skryptu jej nie psuje
        setStatus((current) => (current === 'signedIn' ? current : 'error'));
        setMessage((current) =>
          statusRef.current === 'signedIn' ? current : 'scriptFailed',
        );
      },
    );

    return () => {
      cancelled = true;
    };
  }, [clientId, loadAttempt]);

  const signIn = useCallback(() => {
    setMessage(null);
    tokenClientRef.current?.requestAccessToken();
  }, []);

  const retry = useCallback(() => {
    setStatus('loading');
    setMessage(null);
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  const signOut = useCallback(
    (reason?: AuthMessage) => {
      // Wygasły token nie wymaga unieważnienia, ręczne wylogowanie tak
      if (
        token !== null &&
        reason === undefined &&
        typeof google !== 'undefined'
      ) {
        google.accounts.oauth2.revoke(token, () => undefined);
      }
      clearSession();
      setToken(null);
      setStatus('signedOut');
      setMessage(reason ?? null);
    },
    [token],
  );

  return { status, token, message, signIn, signOut, retry };
}
