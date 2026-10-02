import type { PlaylistVideo } from '../youtube/types';

/*
 * Zamienia miejscami dwa sąsiednie filmy listy. Przesuwany film dostaje pozycję
 * sąsiada z YouTube (a nie indeks w liście), bo pozycje liczą też ukryte filmy,
 * których lista nie pokazuje; sąsiad przesuwa się o jedno miejsce, jak na YouTube.
 */
export function swapVideos(
  videos: PlaylistVideo[],
  index: number,
  target: number,
): PlaylistVideo[] {
  const moved = videos[index];
  const neighbor = videos[target];
  if (moved === undefined || neighbor === undefined) {
    return videos;
  }
  const shift = target > index ? -1 : 1;
  const next = [...videos];
  next[target] = { ...moved, position: neighbor.position };
  next[index] = { ...neighbor, position: neighbor.position + shift };
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
