import { useCallback, type ReactNode } from 'react';
import { LoginScreen } from './auth/LoginScreen';
import { useGoogleAuth } from './auth/useGoogleAuth';
import { getGoogleClientId } from './config';
import { PlaylistsView } from './playlists/PlaylistsView';

const SESSION_EXPIRED_MESSAGE = 'Sesja wygasła, zaloguj się ponownie.';

type LayoutProps = {
  actions?: ReactNode;
  children: ReactNode;
};

function Layout({ actions, children }: LayoutProps) {
  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">
          <img
            className="app__logo"
            src={`${import.meta.env.BASE_URL}favicon.svg`}
            alt=""
            width={28}
            height={28}
          />
          YouTube Playlist Manager
        </h1>
        {actions}
      </header>
      <main className="app__main">{children}</main>
    </div>
  );
}

function AuthenticatedApp({ clientId }: { clientId: string }) {
  const { status, token, message, signIn, signOut, retry } =
    useGoogleAuth(clientId);
  const handleUnauthorized = useCallback(
    () => signOut(SESSION_EXPIRED_MESSAGE),
    [signOut],
  );

  if (status === 'signedIn' && token !== null) {
    return (
      <Layout
        actions={
          <button type="button" className="button" onClick={() => signOut()}>
            Wyloguj
          </button>
        }
      >
        <PlaylistsView token={token} onUnauthorized={handleUnauthorized} />
      </Layout>
    );
  }

  return (
    <Layout>
      <LoginScreen
        status={status}
        message={message}
        onSignIn={signIn}
        onRetry={retry}
      />
    </Layout>
  );
}

export function App() {
  const clientId = getGoogleClientId();

  if (clientId === null) {
    return (
      <Layout>
        <p className="notice notice--error" role="alert">
          Brakuje zmiennej <code>VITE_GOOGLE_CLIENT_ID</code>. Instrukcja
          konfiguracji jest w pliku CONTRIBUTING.md.
        </p>
      </Layout>
    );
  }

  return <AuthenticatedApp clientId={clientId} />;
}
