import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { AccountSection } from '../account/AccountSection';
import type { ChannelState } from '../account/useChannel';
import { useI18n } from '../i18n/LocaleProvider';
import type { Messages } from '../i18n/messages';
import { normalizeText } from '../search/normalize';
import { SearchField } from '../search/SearchField';
import { searchPlaylists, type SearchResult } from '../search/searchPlaylists';
import type { VideoIndex } from '../search/useVideoIndex';
import {
  countByVisibility,
  filterByVisibility,
  type VisibilityFilter as Filter,
} from './filterPlaylists';
import { PlaylistRow } from './PlaylistRow';
import { PlaylistsLoadError } from './PlaylistsLoadError';
import { PlaylistVideosRow } from './PlaylistVideosRow';
import {
  nextSort,
  sortPlaylists,
  type SortKey,
  type SortState,
} from './sortPlaylists';
import { readSort, writeSort } from './sortPreference';
import { SortSelect } from './SortSelect';
import { type Notice, type PlaylistsState } from './usePlaylists';
import { VisibilityFilter } from './VisibilityFilter';
import {
  readVisibilityFilter,
  writeVisibilityFilter,
} from './visibilityPreference';

type ColumnLabel =
  'columnTitle' | 'columnVideos' | 'columnPrivacy' | 'columnCreated';

type SortableColumn = { key: SortKey; label: ColumnLabel; numeric?: boolean };

const SORTABLE_COLUMNS: readonly SortableColumn[] = [
  { key: 'title', label: 'columnTitle' },
  { key: 'itemCount', label: 'columnVideos', numeric: true },
  { key: 'privacy', label: 'columnPrivacy' },
  { key: 'publishedAt', label: 'columnCreated' },
];

type PlaylistsViewProps = {
  list: PlaylistsState;
  index: VideoIndex;
  channel: ChannelState;
};

const MIN_QUERY_LENGTH = 2;

function indexStatus(index: VideoIndex, t: Messages): string {
  if (index.status === 'loading') {
    return t.indexingVideos(index.done, index.total);
  }
  if (index.status === 'ready' && index.failed > 0) {
    return t.indexFailed(index.failed);
  }
  return '';
}

function noticeText(notice: Notice, t: Messages): string {
  if (notice === null) {
    return '';
  }
  return notice.kind === 'deleted'
    ? t.playlistDeleted(notice.title)
    : t.apiError.notFound;
}

export function PlaylistsView({ list, index, channel }: PlaylistsViewProps) {
  const { t } = useI18n();
  const { loadState, playlists, notice } = list;
  const [sort, setSort] = useState<SortState>(readSort);
  const [visibility, setVisibility] = useState<Filter>(readVisibilityFilter);
  const [query, setQuery] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Po usunięciu playlisty (także z jej profilu) fokus wraca na nagłówek listy, a nie ginie na body
  useEffect(() => {
    if (notice !== null) {
      headingRef.current?.focus();
    }
  }, [notice]);

  const visibleCounts = useMemo(
    () => countByVisibility(playlists),
    [playlists],
  );
  const normalizedQuery = normalizeText(query);
  const searching = normalizedQuery.length >= MIN_QUERY_LENGTH;
  const videosByPlaylist = index.videosByPlaylist;
  // Kolejność: widoczność, wyszukiwanie, sortowanie
  const results = useMemo((): SearchResult[] => {
    const visible = filterByVisibility(playlists, visibility);
    const found = searching
      ? searchPlaylists(visible, normalizedQuery, videosByPlaylist)
      : visible.map((playlist) => ({ playlist, matchingVideos: [] }));
    const byId = new Map(found.map((result) => [result.playlist.id, result]));
    return sortPlaylists(
      found.map((result) => result.playlist),
      sort,
    ).flatMap((playlist) => byId.get(playlist.id) ?? []);
  }, [
    playlists,
    visibility,
    searching,
    normalizedQuery,
    videosByPlaylist,
    sort,
  ]);

  function applySort(next: SortState) {
    setSort(next);
    writeSort(next);
  }

  function handleSort(key: SortKey) {
    applySort(nextSort(sort, key));
  }

  function handleVisibility(next: Filter) {
    setVisibility(next);
    writeVisibilityFilter(next);
  }

  const heading =
    loadState.status !== 'ready'
      ? t.playlistsHeading
      : visibility === 'all' && !searching
        ? t.playlistsHeadingAll(playlists.length)
        : t.playlistsHeadingFiltered(results.length, playlists.length);

  return (
    <>
      <AccountSection
        state={channel}
        playlistCount={loadState.status === 'ready' ? playlists.length : null}
      />
      <section className="playlists" aria-labelledby="playlists-heading">
        <div className="playlists__header">
          <h2
            id="playlists-heading"
            ref={headingRef}
            className="playlists__heading"
            tabIndex={-1}
          >
            {heading}
          </h2>
        </div>
        {loadState.status === 'ready' && playlists.length > 0 && (
          <SearchField
            value={query}
            status={indexStatus(index, t)}
            onChange={setQuery}
            onFocus={index.start}
          />
        )}
        {loadState.status === 'ready' && playlists.length > 0 && (
          <VisibilityFilter
            value={visibility}
            counts={visibleCounts}
            onChange={handleVisibility}
          />
        )}
        {loadState.status === 'ready' && playlists.length > 0 && (
          <SortSelect value={sort} onChange={applySort} />
        )}
        <p className="playlists__notice" role="status">
          {noticeText(notice, t)}
        </p>
        {loadState.status === 'loading' && (
          <p className="playlists__state">{t.loadingPlaylists}</p>
        )}
        {loadState.status === 'error' && (
          <PlaylistsLoadError error={loadState.error} onRetry={list.retry} />
        )}
        {loadState.status === 'ready' && playlists.length === 0 && (
          <p className="playlists__state">{t.noPlaylists}</p>
        )}
        {loadState.status === 'ready' &&
          playlists.length > 0 &&
          results.length === 0 && (
            <p className="playlists__state">
              {searching
                ? t.noResults(query.trim())
                : t.noPlaylistsWithVisibility}
            </p>
          )}
        {loadState.status === 'ready' && results.length > 0 && (
          // Jawne role: na telefonie wiersze dostają display: grid, co w części przeglądarek gubi semantykę tabeli
          <table
            className="playlists__table"
            role="table"
            aria-labelledby="playlists-heading"
          >
            <thead className="playlists__head" role="rowgroup">
              <tr role="row">
                {SORTABLE_COLUMNS.map((column) => {
                  const active = sort.key === column.key;
                  return (
                    <th
                      key={column.key}
                      className={
                        column.numeric
                          ? 'playlists__column playlists__column--number'
                          : 'playlists__column'
                      }
                      scope="col"
                      role="columnheader"
                      aria-sort={
                        active
                          ? sort.direction === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : undefined
                      }
                    >
                      <button
                        type="button"
                        className="playlists__sort-button"
                        onClick={() => handleSort(column.key)}
                      >
                        {t[column.label]}
                        {/* Dwie strzałki na każdej sortowalnej kolumnie; aktywna podświetla swój kierunek */}
                        <svg
                          className={
                            active
                              ? `playlists__sort-icon playlists__sort-icon--${sort.direction}`
                              : 'playlists__sort-icon'
                          }
                          width="8"
                          height="14"
                          viewBox="0 0 8 14"
                          aria-hidden="true"
                        >
                          <path
                            className="playlists__sort-arrow playlists__sort-arrow--asc"
                            d="M4 1l3.5 5h-7z"
                          />
                          <path
                            className="playlists__sort-arrow playlists__sort-arrow--desc"
                            d="M4 13l3.5-5h-7z"
                          />
                        </svg>
                      </button>
                    </th>
                  );
                })}
                <th
                  className="playlists__column"
                  scope="col"
                  role="columnheader"
                >
                  <span className="visually-hidden">{t.columnActions}</span>
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {results.map(({ playlist, matchingVideos }) => (
                <Fragment key={playlist.id}>
                  <PlaylistRow
                    playlist={playlist}
                    onRename={(target, title) =>
                      list.updatePlaylist(target, { title })
                    }
                    onDelete={list.deletePlaylist}
                  />
                  {matchingVideos.length > 0 && (
                    <PlaylistVideosRow
                      playlist={playlist}
                      videos={matchingVideos}
                    />
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
