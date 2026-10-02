import { describe, expect, it } from 'vitest';
import { parseRoute, routeToHash } from './route';

describe('parseRoute', () => {
  it.each([[''], ['#'], ['#/']])('reads %j as the list', (hash) => {
    expect(parseRoute(hash)).toEqual({ name: 'list' });
  });

  it('reads a playlist route', () => {
    expect(parseRoute('#/playlists/PL-algo')).toEqual({
      name: 'playlist',
      id: 'PL-algo',
    });
  });

  it('decodes the playlist id', () => {
    expect(parseRoute('#/playlists/PL%2Fa%20b')).toEqual({
      name: 'playlist',
      id: 'PL/a b',
    });
  });

  it.each([
    ['#/unknown'],
    ['#/playlists'],
    ['#/playlists/'],
    ['#/playlists/a/b'],
    ['#/playlists/%E0%A4%A'],
    ['#playlists/a'],
  ])('falls back to the list for %j', (hash) => {
    expect(parseRoute(hash)).toEqual({ name: 'list' });
  });
});

describe('routeToHash', () => {
  it('builds the list hash', () => {
    expect(routeToHash({ name: 'list' })).toBe('#/');
  });

  it('builds a playlist hash with an encoded id', () => {
    expect(routeToHash({ name: 'playlist', id: 'PL-algo' })).toBe(
      '#/playlists/PL-algo',
    );
    expect(routeToHash({ name: 'playlist', id: 'PL/a b' })).toBe(
      '#/playlists/PL%2Fa%20b',
    );
  });

  it('round-trips through parseRoute', () => {
    const route = { name: 'playlist', id: 'x?y#z' } satisfies {
      name: 'playlist';
      id: string;
    };
    expect(parseRoute(routeToHash(route))).toEqual(route);
  });
});
