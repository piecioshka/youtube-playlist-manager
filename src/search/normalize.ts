// Sprowadza tekst do postaci porównywalnej: bez wielkości liter, polskich znaków i nadmiarowych spacji
export function normalizeText(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      // „ł” nie rozkłada się w NFD na literę i znak diakrytyczny
      .replace(/ł/g, 'l')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export function matchesQuery(text: string, normalizedQuery: string): boolean {
  return normalizeText(text).includes(normalizedQuery);
}
