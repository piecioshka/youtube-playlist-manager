import type { PrivacyStatus } from '../youtube/types';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const PRIVACY_LABELS: Record<PrivacyStatus, string> = {
  public: 'Publiczna',
  unlisted: 'Niepubliczna',
  private: 'Prywatna',
};

export function privacyLabel(status: PrivacyStatus): string {
  return PRIVACY_LABELS[status];
}
