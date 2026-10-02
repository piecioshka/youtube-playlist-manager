// Grupuje tysiące podanym separatorem, bez Intl, żeby wynik nie zależał od locale systemu
export function formatCount(value: number, separator: string): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}
