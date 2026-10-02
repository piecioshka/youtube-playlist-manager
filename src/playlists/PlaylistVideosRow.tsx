import type { Playlist, PlaylistVideo } from '../youtube/types';

const MAX_SHOWN = 5;

type PlaylistVideosRowProps = {
  playlist: Playlist;
  videos: readonly PlaylistVideo[];
};

// 1 pasujący film, 2-4 pasujące filmy (poza 12-14), reszta pasujących filmów
function moreLabel(count: number): string {
  const lastDigit = count % 10;
  const lastTwo = count % 100;
  if (count === 1) {
    return 'i jeszcze 1 pasujący film';
  }
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    return `i jeszcze ${count} pasujące filmy`;
  }
  return `i jeszcze ${count} pasujących filmów`;
}

export function PlaylistVideosRow({
  playlist,
  videos,
}: PlaylistVideosRowProps) {
  const shown = videos.slice(0, MAX_SHOWN);
  const hidden = videos.length - shown.length;
  const playlistParam = encodeURIComponent(playlist.id);

  return (
    <tr className="playlist-videos" role="row">
      <td className="playlist-videos__cell" role="cell" colSpan={5}>
        <ul
          className="playlist-videos__list"
          aria-label={`Pasujące filmy z playlisty ${playlist.title}`}
        >
          {shown.map((video, position) => (
            // Ten sam film może być na playliście kilka razy
            <li
              key={`${position}-${video.videoId}`}
              className="playlist-videos__item"
            >
              <a
                className="playlist-videos__link"
                href={`https://www.youtube.com/watch?v=${encodeURIComponent(video.videoId)}&list=${playlistParam}`}
                target="_blank"
                rel="noreferrer"
                title={video.title}
              >
                {video.title}
              </a>{' '}
              <span className="playlist-videos__channel">
                {video.channelTitle}
              </span>
            </li>
          ))}
          {hidden > 0 && (
            <li className="playlist-videos__item">
              <a
                className="playlist-videos__link"
                href={`https://www.youtube.com/playlist?list=${playlistParam}`}
                target="_blank"
                rel="noreferrer"
              >
                {moreLabel(hidden)}
              </a>
            </li>
          )}
        </ul>
      </td>
    </tr>
  );
}
