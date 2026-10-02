// Czas trwania w ISO 8601, tak jak podaje go YouTube: PT4M13S, PT1H2M3S, a dla doby i dłużej P1DT2H
const ISO_DURATION = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;

// Liczba sekund albo null, gdy tekst nie jest czasem trwania
export function parseIsoDuration(value: string): number | null {
  const match = ISO_DURATION.exec(value);
  // Samo „P” albo „PT” pasuje do wzorca, ale nie niesie żadnej wartości
  if (match === null || !/\d/.test(value)) {
    return null;
  }
  const [, days, hours, minutes, seconds] = match;
  return (
    Number(days ?? 0) * 86_400 +
    Number(hours ?? 0) * 3_600 +
    Number(minutes ?? 0) * 60 +
    Number(seconds ?? 0)
  );
}
