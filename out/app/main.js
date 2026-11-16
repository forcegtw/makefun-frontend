// Bountyscope: a fast, small make.fun frontend on hash routes.
//
//   #/                          the bounty board
//   #/bounty/<slug>             one bounty: summary, rules, rewards, dates
//   #/bounty/<slug>/leaderboard its leaderboard
//   #/u/<handle>                an account's public profile
//
// Views live in lazily-imported modules so the first load stays tiny; the
// board's module is the one a visitor needs first and ships upfront.
// window.__shotReady is false while a page loads and true once its data has
// rendered, for any script that takes screenshots.

import { getBounties } from './api.js';
import { board } from './board.js';

const app = document.getElementById('app');

let seq = 0;

/** Render one route. Each view keeps the app node and swaps its content, so
 * the browser never rebuilds the whole document. */
async function route() {
  const mine = ++seq;
  window.__shotReady = false;
  const hash = location.hash || '#/';
  const lb = hash.match(/^#\/bounty\/([^/]+)\/leaderboard\/?$/);
  const one = hash.match(/^#\/bounty\/([^/]+)\/?$/);
  const who = hash.match(/^#\/u\/([^/]+)\/?$/);
  try {
    if (one || lb) {
      const slug = decodeURIComponent((one || lb)[1]);
      const { bountyPage, leaderboardPage } = await import('./views.js');
      const { getBounty, getLeaderboard } = await import('./api.js');
      const b = await getBounty(slug);
      document.title = `${b.title} · Bountyscope`;
      app.innerHTML = lb
        ? leaderboardPage(b, await getLeaderboard(slug))
        : bountyPage(b);
    } else if (who) {
      const handle = decodeURIComponent(who[1]);
      const { profilePage } = await import('./views.js');
      const { getProfile } = await import('./api.js');
      const p = await getProfile(handle);
      document.title = `@${p.handle} · Bountyscope`;
      app.innerHTML = profilePage(p);
    } else {
      document.title = 'Bountyscope · make.fun bounties';
      app.innerHTML = board(await getBounties());
    }
  } catch (err) {
    app.innerHTML = `<section><p class="empty">Could not load this page: ${String(err.message || err)}</p>
    <p><a href="#/">Back to the board</a></p></section>`;
  }
  if (mine === seq) {
    window.scrollTo(0, 0);
    window.__shotReady = true;
  }
}

window.addEventListener('hashchange', route);
route();
