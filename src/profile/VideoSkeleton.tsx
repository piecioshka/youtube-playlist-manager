// Tyle wierszy mieści się na ekranie; dłuższa playlista i tak przewinie się dopiero po wczytaniu
const MAX_ROWS = 8;

type VideoSkeletonProps = {
  // Liczba filmów znana z listy playlist, zanim wczytają się same filmy
  count: number;
};

/*
 * Zarys tabeli filmów na czas wczytywania: długa playlista pobiera się stronami
 * po 50 filmów, więc bez niego sekcja długo stałaby pusta, a potem skakała.
 * To tylko ozdoba; tekst o wczytywaniu dla czytników ekranu stoi obok.
 */
export function VideoSkeleton({ count }: VideoSkeletonProps) {
  const rows = Math.min(Math.max(count, 1), MAX_ROWS);

  return (
    <div className="video-skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="video-skeleton__row">
          <span className="skeleton video-skeleton__number" />
          <span className="skeleton video-skeleton__thumbnail" />
          <span className="skeleton video-skeleton__title" />
          <span className="skeleton video-skeleton__channel" />
          <span className="skeleton video-skeleton__date" />
        </div>
      ))}
    </div>
  );
}
