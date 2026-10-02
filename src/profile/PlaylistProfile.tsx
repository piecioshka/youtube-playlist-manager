import { PlaylistGoneError } from '../playlists/usePlaylists';
import type { Route } from '../routing/route';
import type { PlaylistChanges } from '../youtube/api';
import type { Playlist } from '../youtube/types';
import { DangerZone } from './DangerZone';
import { PlaylistForm } from './PlaylistForm';
import { PlaylistVideos, type ProfileVideoIndex } from './PlaylistVideos';
import { ProfileHeader } from './ProfileHeader';

type PlaylistProfileProps = {
  playlist: Playlist;
  videoIndex: ProfileVideoIndex;
  // Obie odrzucają Error z gotowym komunikatem; PlaylistGoneError, gdy playlisty już nie ma
  onSave: (playlist: Playlist, changes: PlaylistChanges) => Promise<Playlist>;
  onDelete: (playlist: Playlist) => Promise<void>;
  onCountChange: (playlistId: string, count: number) => void;
  onNavigate: (route: Route) => void;
};

export function PlaylistProfile({
  playlist,
  videoIndex,
  onSave,
  onDelete,
  onCountChange,
  onNavigate,
}: PlaylistProfileProps) {
  // Playlista, której już nie ma, zabiera profil ze sobą: komunikat pokaże lista
  function leaveIfGone(error: unknown): never {
    if (error instanceof PlaylistGoneError) {
      onNavigate({ name: 'list' });
    }
    throw error;
  }

  async function save(changes: PlaylistChanges): Promise<Playlist> {
    try {
      return await onSave(playlist, changes);
    } catch (error) {
      return leaveIfGone(error);
    }
  }

  async function remove(): Promise<void> {
    try {
      await onDelete(playlist);
    } catch (error) {
      return leaveIfGone(error);
    }
    onNavigate({ name: 'list' });
  }

  return (
    <div className="profile-page">
      <ProfileHeader playlist={playlist} />
      <PlaylistForm key={playlist.id} playlist={playlist} onSave={save} />
      <PlaylistVideos
        key={`videos-${playlist.id}`}
        playlist={playlist}
        videoIndex={videoIndex}
        onCountChange={(count) => onCountChange(playlist.id, count)}
      />
      <DangerZone playlist={playlist} onDelete={remove} />
    </div>
  );
}
