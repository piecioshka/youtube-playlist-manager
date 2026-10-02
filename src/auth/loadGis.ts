const GIS_SRC = 'https://accounts.google.com/gsi/client';

let loading: Promise<void> | null = null;

export function loadGis(): Promise<void> {
  if (loading) {
    return loading;
  }
  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => {
      // Pozwala spróbować ponownie po chwilowym braku sieci
      script.remove();
      loading = null;
      reject(new Error('Failed to load Google Identity Services'));
    });
    document.head.append(script);
  });
  return loading;
}
