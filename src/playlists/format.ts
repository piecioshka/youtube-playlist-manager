function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
