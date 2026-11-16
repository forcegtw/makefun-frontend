// make.fun public API client: read-only GETs, with a small ETag-revalidating cache.
// The API binds its ETags to the minute, so within one minute an If-None-Match
// revalidation answers 304 and costs nothing; that keeps revisits and route
// changes cheap without ever passing stale data off as fresh.

const API = 'https://make.fun/api';
const cache = new Map(); // path -> { etag, data, at }
const inflight = new Map();
const FRESH_MS = 45000;

async function get(path) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < FRESH_MS) return hit.data;
  if (inflight.has(path)) return inflight.get(path);
  const p = (async () => {
    try {
      const res = await fetch(API + path, hit ? { headers: { 'If-None-Match': hit.etag } } : {});
      if (res.status === 304 && hit) { hit.at = Date.now(); return hit.data; }
      if (!res.ok) throw new Error(`API answered ${res.status}`);
      const data = await res.json();
      cache.set(path, { etag: res.headers.get('ETag') || '', data, at: Date.now() });
      return data;
    } finally {
      inflight.delete(path);
    }
  })();
  inflight.set(path, p);
  return p;
}

/** The open bounties, one page at a time: { items, next_cursor }. The
 * cursor comes back from the previous answer, so the board can grow a
 * "load more" button instead of paying for 500 rows up front. */
export const getBounties = () => get('/competitions?status=open&limit=50');
export const getBountiesPage = (cursor) =>
  get(`/competitions?status=open&limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);

/** Stale-while-revalidate for the board's first answer: hand back whatever
 * cached copy exists right away (a render beats a spinner) and refresh in
 * the background. onFresh receives the newer data only when the network
 * actually had something different — a 304 or an identical answer is a
 * no-op — so callers can redraw without flicker. */
export function getBountiesSWR(onFresh) {
  const path = '/competitions?status=open&limit=50';
  const hit = cache.get(path);
  const fresh = getBounties().then((data) => {
    if (onFresh && !(hit && data === hit.data)) onFresh(data);
    return data;
  });
  return hit ? Promise.resolve(hit.data) : fresh;
}

/** One bounty, by its slug. */
export const getBounty = (slug) => get(`/competitions/${encodeURIComponent(slug)}`);

/** A bounty's leaderboard rows (the dev phase's judge rate shows live). */
export const getLeaderboard = (slug, limit = 50) =>
  get(`/competitions/${encodeURIComponent(slug)}/leaderboard?limit=${limit}`);

/** An account's public profile by its handle. */
export const getProfile = (handle) => get(`/profiles/${encodeURIComponent(handle)}`);

/** Start loading one bounty without awaiting it: the board prefetches on
 * hover so a click usually renders from cache. The inflight map de-duplicates
 * against the real fetch; a failure here is fine to ignore because the click
 * path fetches and reports errors itself. */
export function prefetchBounty(href) {
  const m = String(href || '').match(/^#\/bounty\/([^/]+)\/?$/);
  if (!m) return;
  get(`/competitions/${encodeURIComponent(decodeURIComponent(m[1]))}`).catch(() => {});
}

/** Same idea for an account page (#/u/<handle>): the leaderboard links to
 * profiles, and warming the cache on hover makes the click feel instant. */
export function prefetchProfile(href) {
  const m = String(href || '').match(/^#\/u\/([^/]+)\/?$/);
  if (!m) return;
  get(`/profiles/${encodeURIComponent(decodeURIComponent(m[1]))}`).catch(() => {});
}
