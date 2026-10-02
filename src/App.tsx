import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { AccountChip } from './account/AccountChip';
import { useChannel, type ChannelState } from './account/useChannel';
import { LoginScreen } from './auth/LoginScreen';
import { useGoogleAuth } from './auth/useGoogleAuth';
import { getGoogleClientId } from './config';
import { LanguageSelect } from './i18n/LanguageSelect';
import { useI18n } from './i18n/LocaleProvider';
import { PlaylistsView } from './playlists/PlaylistsView';
import { usePlaylists } from './playlists/usePlaylists';
import { PlaylistProfile } from './profile/PlaylistProfile';
import { ProfileUnavailable } from './profile/ProfileUnavailable';
import { routeToHash } from './routing/route';
import { useRoute } from './routing/useRoute';
import { useVideoIndex } from './search/useVideoIndex';
import { ThemeToggle } from './theme/ThemeToggle';
import { YouTubeLink } from './youtube/YouTubeLink';
import { useTheme } from './theme/useTheme';
import { createYouTubeSession } from './youtube/session';
import { YouTubeProvider } from './youtube/YouTubeProvider';

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
          {/* Logo i nazwa prowadzą na stronę główną, czyli do tabeli playlist */}
          <a className="app__home" href={routeToHash({ name: 'list' })}>
            <img
              className="app__logo"
              src={`${import.meta.env.BASE_URL}favicon.svg`}
              alt=""
              width={28}
              height={28}
            />
            {t.appTitle}
          </a>
        </h1>
        <div className="app__actions">
          <LanguageSelect />
          <ThemeToggle theme={theme} label={t.themeDark} onToggle={toggle} />
          {actions}
        </div>
      </header>
      <main className="app__main">{children}</main>
      <footer className="app__footer">
        {/* Jedna linia na szerokim ekranie; na wąskim łamie się między członami, nie w ich środku */}
        <p className="app__footer-line">
          <span className="app__footer-item">{t.footerNoServer}</span> ·{' '}
          <span className="app__footer-item">
            {t.footerWorksWith}{' '}
            <YouTubeLink
              className="app__footer-link"
              href="https://www.youtube.com"
            >
              YouTube
            </YouTubeLink>
          </span>{' '}
          ·{' '}
          <span className="app__footer-item">
            {t.footerAuthor}{' '}
            <a
              className="app__footer-link"
              href="https://piecioshka.pl/"
              target="_blank"
              rel="noreferrer"
            >
              Piotr Kowalski
            </a>
          </span>{' '}
          ·{' '}
          <a
            className="app__footer-link app__footer-item"
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
  channel: ChannelState;
};

// Lista playlist i indeks filmów są wspólne dla tabeli i profilu, więc przejście między nimi nic nie wczytuje od nowa
function SignedInApp({ channel }: SignedInAppProps) {
  const { t } = useI18n();
  const { route, navigate } = useRoute();
  const list = usePlaylists({ t });
  const index = useVideoIndex({ playlists: list.playlists });
  const [shownRoute, setShownRoute] = useState(route);

  // Komunikat z listy nie czeka na powrót z profilu innej playlisty
  if (shownRoute !== route) {
    setShownRoute(route);
    if (route.name === 'playlist') {
      list.clearNotice();
    }
  }

  if (route.name === 'playlist') {
    const playlist = list.playlists.find((item) => item.id === route.id);
    if (playlist === undefined) {
      return (
        <ProfileUnavailable loadState={list.loadState} onRetry={list.retry} />
      );
    }
    return (
      <PlaylistProfile
        key={route.id}
        playlist={playlist}
        videoIndex={index}
        onSave={list.updatePlaylist}
        onDelete={list.deletePlaylist}
        onCountChange={list.setItemCount}
        onNavigate={navigate}
      />
    );
  }
  return <PlaylistsView list={list} index={index} channel={channel} />;
}

function SignedInLayout({ onSignOut }: { onSignOut: () => void }) {
  const { t } = useI18n();
  const channel = useChannel();

  return (
    <Layout
      actions={
        <>
          {channel.channel !== null && (
            <AccountChip channel={channel.channel} />
          )}
          <button type="button" className="button" onClick={onSignOut}>
            {t.signOut}
          </button>
        </>
      }
    >
      <SignedInApp channel={channel} />
    </Layout>
  );
}

function AuthenticatedApp({ clientId }: { clientId: string }) {
  const { status, token, message, signIn, signOut, retry } =
    useGoogleAuth(clientId);
  const handleUnauthorized = useCallback(
    () => signOut('sessionExpired'),
    [signOut],
  );

  // Jedna sesja na token: nowy obiekt przy każdym renderze wczytywałby wszystko od nowa
  const session = useMemo(
    () =>
      token === null ? null : createYouTubeSession(token, handleUnauthorized),
    [token, handleUnauthorized],
  );

  if (status === 'signedIn' && session !== null) {
    return (
      <YouTubeProvider session={session}>
        <SignedInLayout onSignOut={() => signOut()} />
      </YouTubeProvider>
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
