import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

// Skrypt w <script> bez atrybutu `src`, czyli wstawiony wprost do index.html
const INLINE_SCRIPT = /<script>([\s\S]*?)<\/script>/g;

function scriptHashes(html: string): string[] {
  return [...html.matchAll(INLINE_SCRIPT)].map(
    ([, code = '']) =>
      `'sha256-${createHash('sha256').update(code).digest('base64')}'`,
  );
}

/*
 * Token OAuth leży w sessionStorage, więc wstrzyknięty skrypt mógłby go wynieść.
 * Polityka wpuszcza tylko własny kod, Google Identity Services i YouTube Data API.
 * GitHub Pages nie ustawia nagłówków, dlatego idzie jako <meta>.
 */
function policy(html: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' ${scriptHashes(html).join(' ')} https://accounts.google.com/gsi/client`,
    "style-src 'self' https://accounts.google.com/gsi/style",
    // `data:` to strzałka selecta w app.css; reszta to miniatury filmów i awatar kanału
    "img-src 'self' data: https://*.ytimg.com https://*.ggpht.com https://*.googleusercontent.com",
    "connect-src 'self' https://www.googleapis.com https://oauth2.googleapis.com https://accounts.google.com/gsi/",
    'frame-src https://accounts.google.com/gsi/',
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

// Tylko build: serwer deweloperski Vite wstrzykuje własne skrypty inline i gniazdo HMR
export function contentSecurityPolicy(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: (html) => [
        {
          tag: 'meta',
          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content: policy(html),
          },
          injectTo: 'head-prepend',
        },
      ],
    },
  };
}
