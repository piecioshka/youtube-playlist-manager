import { useCallback, useMemo, useState } from 'react';
import { AccountChip } from './account/AccountChip';
import { useChannel, type ChannelState } from './account/useChannel';
import { LoginScreen } from './auth/LoginScreen';
import { useGoogleAuth } from './auth/useGoogleAuth';
import { getGoogleClientId } from './config';
import { useI18n } from './i18n/LocaleProvider';
import { Layout } from './layout/Layout';
import { PlaylistsView } from './playlists/PlaylistsView';
import { usePlaylists } from './playlists/usePlaylists';
import { PlaylistProfile } from './profile/PlaylistProfile';
import { ProfileUnavailable } from './profile/ProfileUnavailable';
import { useRoute } from './routing/useRoute';
import { useVideoIndex } from './search/useVideoIndex';
import { createYouTubeSession } from './youtube/session';
import { YouTubeProvider } from './youtube/YouTubeProvider';

// lucide `log-out`
function SignOutIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m16 17 5-5-5-5M21 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    </svg>
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
          <button
            type="button"
            className="button app__sign-out"
            title={t.signOut}
            onClick={onSignOut}
          >
            <SignOutIcon />
            <span className="app__sign-out-text">{t.signOut}</span>
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
