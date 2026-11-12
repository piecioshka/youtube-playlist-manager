import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

const BOOT_SCRIPT = new URL('./src/theme/themeBoot.js', import.meta.url);

/*
 * One copy of the theme boot script for every HTML page. It stays inline, so
 * it runs before the first paint, and the CSP plugin hashes it afterwards.
 */
export function themeBoot(): Plugin {
  return {
    name: 'theme-boot',
    transformIndexHtml: {
      order: 'pre',
      handler: () => [
        {
          tag: 'script',
          children: readFileSync(BOOT_SCRIPT, 'utf8'),
          injectTo: 'head',
        },
      ],
    },
  };
}
