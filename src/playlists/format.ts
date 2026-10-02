import type { PrivacyStatus } from '../youtube/types';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatVideoCount(count: number): string {
  if (count === 1) {
    return '1 film';
  }
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  const isFew =
    lastDigit >= 2 &&
    lastDigit <= 4 &&
    (lastTwoDigits < 12 || lastTwoDigits > 14);
  return `${count} ${isFew ? 'filmy' : 'filmów'}`;
}

const PRIVACY_LABELS: Record<PrivacyStatus, string> = {
  public: 'Publiczna',
  unlisted: 'Niepubliczna',
  private: 'Prywatna',
};

export function privacyLabel(status: PrivacyStatus): string {
  return PRIVACY_LABELS[status];
}
