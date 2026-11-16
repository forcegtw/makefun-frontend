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

/** The open bounties: { items: [...], next_cursor }. */
export const getBounties = () => get('/competitions?status=open&limit=50');

/** One bounty, by its slug. */
export const getBounty = (slug) => get(`/competitions/${encodeURIComponent(slug)}`);

/** A bounty's leaderboard rows (the dev phase's judge rate shows live). */
export const getLeaderboard = (slug, limit = 50) =>
  get(`/competitions/${encodeURIComponent(slug)}/leaderboard?limit=${limit}`);

/** An account's public profile by its handle. */
export const getProfile = (handle) => get(`/profiles/${encodeURIComponent(handle)}`);
