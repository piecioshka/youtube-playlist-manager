import type { PlaylistVideo } from '../youtube/types';
import { moveItem } from './reorder';

/*
 * Przenosi film z indeksu `from` na `to`. Przenoszony film dostaje pozycję z YouTube
 * filmu, który stał na `to` (a nie indeks w liście), bo pozycje liczą też ukryte filmy,
 * których lista nie pokazuje; filmy po drodze przesuwają się o jedno miejsce, jak na YouTube.
 */
export function moveVideos(
  videos: PlaylistVideo[],
  from: number,
  to: number,
): PlaylistVideo[] {
  const moved = videos[from];
  const destination = videos[to];
  if (moved === undefined || destination === undefined || from === to) {
    return videos;
  }
  const shift = to > from ? -1 : 1;
  const next = moveItem(videos, from, to);
  const low = Math.min(from, to);
  const high = Math.max(from, to);
  for (let index = low; index <= high; index += 1) {
    const video = next[index];
    if (video === undefined) {
      continue;
    }
    next[index] =
      index === to
        ? { ...video, position: destination.position }
        : { ...video, position: video.position + shift };
  }
  return next;
}

// Usuwa film i zamyka lukę w pozycjach tak samo, jak robi to YouTube
export function removeVideo(
  videos: PlaylistVideo[],
  itemId: string,
): PlaylistVideo[] {
  const removed = videos.find((video) => video.itemId === itemId);
  if (removed === undefined) {
    return videos;
  }
  return videos
    .filter((video) => video.itemId !== itemId)
    .map((video) =>
      video.position > removed.position
        ? { ...video, position: video.position - 1 }
        : video,
    );
}
