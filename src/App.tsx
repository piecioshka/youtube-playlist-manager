import { useCallback, useState, type ReactNode } from 'react';
import { LoginScreen } from './auth/LoginScreen';
import { useGoogleAuth } from './auth/useGoogleAuth';
import { getGoogleClientId } from './config';
import { LanguageSelect } from './i18n/LanguageSelect';
import { useI18n } from './i18n/LocaleProvider';
import { PlaylistsView } from './playlists/PlaylistsView';
import { usePlaylists } from './playlists/usePlaylists';
import { PlaylistProfile } from './profile/PlaylistProfile';
import { useRoute } from './routing/useRoute';
import { useVideoIndex } from './search/useVideoIndex';
import { ThemeToggle } from './theme/ThemeToggle';
import { useTheme } from './theme/useTheme';

type LayoutProps = {
  actions?: ReactNode;
  children: ReactNode;
};

function Layout({ actions, children }: LayoutProps) {
  const { theme, toggle } = useTheme();
  const { t } = useI18n();

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
          {t.appTitle}
        </h1>
        <div className="app__actions">
          <LanguageSelect />
          <ThemeToggle theme={theme} label={t.themeDark} onToggle={toggle} />
          {actions}
        </div>
      </header>
      <main className="app__main">{children}</main>
      <footer className="app__footer">
        <p className="app__footer-line">{t.footerNoServer}</p>
        <p className="app__footer-line">
          {t.footerWorksWith}{' '}
          <a
            className="app__footer-link"
            href="https://www.youtube.com"
            target="_blank"
            rel="noreferrer"
          >
            YouTube
          </a>{' '}
          · {t.footerAuthor}{' '}
          <a
            className="app__footer-link"
            href="https://piecioshka.pl/"
            target="_blank"
            rel="noreferrer"
          >
            Piotr Kowalski
          </a>{' '}
          ·{' '}
          <a
            className="app__footer-link"
            href="https://piecioshka.mit-license.org"
            target="_blank"
            rel="noreferrer"
          >
            {t.footerLicense}
          </a>
        </p>
      </footer>
    </div>
  );
}

type SignedInAppProps = {
  token: string;
  onUnauthorized: () => void;
};

// Lista playlist i indeks filmów są wspólne dla tabeli i profilu, więc przejście między nimi nic nie wczytuje od nowa
function SignedInApp({ token, onUnauthorized }: SignedInAppProps) {
  const { t } = useI18n();
  const { route, navigate } = useRoute();
  const list = usePlaylists({ token, onUnauthorized, t });
  const index = useVideoIndex({
    token,
    playlists: list.playlists,
    onUnauthorized,
  });
  const [shownRoute, setShownRoute] = useState(route);

  // Komunikat z listy nie czeka na powrót z profilu innej playlisty
  if (shownRoute !== route) {
    setShownRoute(route);
    if (route.name === 'playlist') {
      list.clearNotice();
    }
  }

  if (route.name === 'playlist') {
    return (
      <PlaylistProfile
        key={route.id}
        token={token}
        playlistId={route.id}
        playlist={list.playlists.find((item) => item.id === route.id)}
        listStatus={list.loadState.status}
        videoIndex={index}
        onUnauthorized={onUnauthorized}
        onUpdated={list.replacePlaylist}
        onDeleted={list.markDeleted}
        onNavigate={navigate}
      />
    );
  }
  return <PlaylistsView list={list} index={index} />;
}

function AuthenticatedApp({ clientId }: { clientId: string }) {
  const { t } = useI18n();
  const { status, token, message, signIn, signOut, retry } =
    useGoogleAuth(clientId);
  const handleUnauthorized = useCallback(
    () => signOut('sessionExpired'),
    [signOut],
  );

  if (status === 'signedIn' && token !== null) {
    return (
      <Layout
        actions={
          <button type="button" className="button" onClick={() => signOut()}>
            {t.signOut}
          </button>
        }
      >
        <SignedInApp token={token} onUnauthorized={handleUnauthorized} />
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
  const { t } = useI18n();
  const clientId = getGoogleClientId();

  if (clientId === null) {
    return (
      <Layout>
        <p className="notice notice--error" role="alert">
          {t.missingClientIdBefore}
          <code>VITE_GOOGLE_CLIENT_ID</code>
          {t.missingClientIdAfter}
        </p>
      </Layout>
    );
  }

  return <AuthenticatedApp clientId={clientId} />;
}
