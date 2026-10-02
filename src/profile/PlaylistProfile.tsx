import { useEffect, useEffectEvent, useState } from 'react';
import { useI18n } from '../i18n/LocaleProvider';
import type { LoadState } from '../playlists/usePlaylists';
import { routeToHash, type Route } from '../routing/route';
import type { PlaylistChanges } from '../youtube/api';
import { errorMessage } from '../youtube/errorMessage';
import { ApiError, type Playlist } from '../youtube/types';
import { useYouTube } from '../youtube/YouTubeProvider';
import { DangerZone } from './DangerZone';
import { PlaylistForm } from './PlaylistForm';
import { PlaylistVideos, type ProfileVideoIndex } from './PlaylistVideos';
import { ProfileHeader } from './ProfileHeader';

type PlaylistProfileProps = {
  playlistId: string;
  // Playlista z listy; brak, gdy lista jeszcze się wczytuje albo jej tam nie ma
  playlist: Playlist | undefined;
  listStatus: LoadState['status'];
  videoIndex: ProfileVideoIndex;
  onUpdated: (playlist: Playlist) => void;
  onDeleted: (playlist: Playlist) => void;
  onNavigate: (route: Route) => void;
};

type Lookup =
  | { status: 'found'; playlist: Playlist }
  | { status: 'missing' }
  | { status: 'error'; message: string };

export function PlaylistProfile({
  playlistId,
  playlist,
  listStatus,
  videoIndex,
  onUpdated,
  onDeleted,
  onNavigate,
}: PlaylistProfileProps) {
  const { t } = useI18n();
  const youtube = useYouTube();
  // Wynik pobrania playlisty spoza listy, zapamiętany razem z id, którego dotyczy
  const [lookup, setLookup] = useState<{ id: string; result: Lookup } | null>(
    null,
  );
  // Liczba elementów z wczytanej listy filmów; null, dopóki się nie wczyta
  const [loadedCount, setLoadedCount] = useState<number | null>(null);
  const needsLookup = playlist === undefined && listStatus !== 'loading';
  const describeError = useEffectEvent((error: unknown) =>
    errorMessage(error, t),
  );

  // Profil otwarty z adresu, zanim lista go zawierała: pytamy YouTube o tę jedną playlistę
  useEffect(() => {
    if (!needsLookup) {
      return;
    }
    let cancelled = false;
    youtube.getPlaylist(playlistId).then(
      (found) => {
        if (!cancelled) {
          setLookup({
            id: playlistId,
            result:
              found === null
                ? { status: 'missing' }
                : { status: 'found', playlist: found },
          });
        }
      },
      (error: unknown) => {
        if (cancelled) {
          return;
        }
        const missing = error instanceof ApiError && error.kind === 'notFound';
        setLookup({
          id: playlistId,
          result: missing
            ? { status: 'missing' }
            : { status: 'error', message: describeError(error) },
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [youtube, playlistId, needsLookup]);

  const result = lookup?.id === playlistId ? lookup.result : null;
  const shown =
    playlist ?? (result?.status === 'found' ? result.playlist : undefined);

  if (shown === undefined) {
    if (result?.status === 'missing' || result?.status === 'error') {
      return (
        <div className="profile-page">
          <p
            className={
              result.status === 'error'
                ? 'playlists__state notice notice--error'
                : 'playlists__state'
            }
            role={result.status === 'error' ? 'alert' : undefined}
          >
            {result.status === 'error' ? result.message : t.playlistNotFound}{' '}
            <a
              className="profile__back-inline"
              href={routeToHash({ name: 'list' })}
            >
              {t.allPlaylists}
            </a>
          </p>
        </div>
      );
    }
    return (
      <div className="profile-page">
        <p className="playlists__state">{t.loading}</p>
      </div>
    );
  }

  function handleUpdated(updated: Playlist) {
    onUpdated(updated);
    // Playlista spoza listy nie wróci w propsach, więc trzymamy jej nową wersję tutaj
    if (playlist === undefined) {
      setLookup({
        id: updated.id,
        result: { status: 'found', playlist: updated },
      });
    }
  }

  async function save(
    current: Playlist,
    changes: PlaylistChanges,
  ): Promise<Playlist> {
    try {
      const updated = await youtube.updatePlaylist(current, changes);
      handleUpdated(updated);
      return updated;
    } catch (error) {
      throw new Error(errorMessage(error, t), {
        cause: error,
      });
    }
  }

  async function remove(current: Playlist): Promise<void> {
    try {
      await youtube.deletePlaylist(current.id);
    } catch (error) {
      throw new Error(errorMessage(error, t), {
        cause: error,
      });
    }
    onDeleted(current);
    onNavigate({ name: 'list' });
  }

  return (
    <div className="profile-page">
      <ProfileHeader
        playlist={shown}
        videoCount={loadedCount ?? shown.itemCount}
      />
      <PlaylistForm
        key={shown.id}
        playlist={shown}
        onSave={(changes) => save(shown, changes)}
      />
      <PlaylistVideos
        key={`videos-${shown.id}`}
        playlist={shown}
        videoIndex={videoIndex}
        onUpdated={handleUpdated}
        onCountChange={setLoadedCount}
      />
      <DangerZone playlist={shown} onDelete={() => remove(shown)} />
    </div>
  );
}
