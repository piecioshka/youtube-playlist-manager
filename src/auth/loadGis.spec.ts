import { beforeEach, describe, expect, it, vi } from 'vitest';

const GIS_SELECTOR = 'script[src="https://accounts.google.com/gsi/client"]';

beforeEach(() => {
  document.head.innerHTML = '';
  // loadGis trzyma obietnicę w module, więc każdy test dostaje świeży moduł
  vi.resetModules();
});

describe('loadGis', () => {
  it('injects the script once and resolves on load', async () => {
    const { loadGis } = await import('./loadGis');

    const first = loadGis();
    const second = loadGis();
    const scripts = document.head.querySelectorAll(GIS_SELECTOR);

    expect(scripts).toHaveLength(1);
    expect(second).toBe(first);
    scripts[0]?.dispatchEvent(new Event('load'));
    await expect(first).resolves.toBeUndefined();
  });

  it('rejects on error and allows a retry', async () => {
    const { loadGis } = await import('./loadGis');

    const attempt = loadGis();
    document.head
      .querySelector(GIS_SELECTOR)
      ?.dispatchEvent(new Event('error'));

    await expect(attempt).rejects.toThrow(
      'Failed to load Google Identity Services',
    );
    expect(document.head.querySelectorAll(GIS_SELECTOR)).toHaveLength(0);

    void loadGis().catch(() => undefined);
    expect(document.head.querySelectorAll(GIS_SELECTOR)).toHaveLength(1);
  });
});
