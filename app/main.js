// Bountyscope: a fast, small make.fun frontend on hash routes.
//
//   #/                          the bounty board
//   #/bounty/<slug>             one bounty: summary, rules, rewards, dates
//   #/bounty/<slug>/leaderboard its leaderboard
//   #/u/<handle>                an account's public profile
//
// Views live in lazily-imported modules so the first load stays tiny; the
// board's module is the one a visitor needs first and ships upfront.
// Navigation never blanks the page: the previous view stays visible (dimmed)
// until the new data has rendered, and a skeleton shows only on a cold start.
// window.__shotReady is false while a page loads and true once its data has
// rendered, for any script that takes screenshots.

import { getBounties } from './api.js';
import { board } from './board.js';

const app = document.getElementById('app');

let seq = 0;

/** Cold-start placeholder shown only when there is nothing on screen yet. */
const SKELETON = `<section class="loading" aria-busy="true">
  <div class="headrow"><h1>&nbsp;</h1></div>
  <ul class="board">
    ${'<li class="row"><div class="grow"><span class="skl w70"></span><span class="skl w40"></span></div><span class="skl w8"></span><span class="skl w8"></span></li>'.repeat(4)}
  </ul>
</section>`;

/** Keep whatever is rendered, dim it, and mark the page busy. */
function begin() {
  if (!app.innerHTML.trim()) app.innerHTML = SKELETON;
  app.setAttribute('aria-busy', 'true');
}

/** Swap in the finished HTML and clear the busy state. */
function done(html) {
  app.innerHTML = html;
  app.removeAttribute('aria-busy');
}

/** Render one route. Each view keeps the app node and swaps its content, so
 * the browser never rebuilds the whole document. */
async function route() {
  const mine = ++seq;
  window.__shotReady = false;
  const hash = location.hash || '#/';
  const lb = hash.match(/^#\/bounty\/([^/]+)\/leaderboard\/?$/);
  const one = hash.match(/^#\/bounty\/([^/]+)\/?$/);
  const who = hash.match(/^#\/u\/([^/]+)\/?$/);
  begin();
  try {
    if (one || lb) {
      // Data fetch starts before the module import so network and parse
      // overlap; the leaderboard is fetched alongside the bounty, not after.
      const slug = decodeURIComponent((one || lb)[1]);
      const bP = import('./api.js').then((a) => a.getBounty(slug));
      const lbP = lb ? bP.then(() => import('./api.js')).then((a) => a.getLeaderboard(slug)) : null;
      const [b, views] = await Promise.all([bP, import('./views.js')]);
      if (mine !== seq) return;
      document.title = `${b.title} · Bountyscope`;
      done(lb
        ? views.leaderboardPage(b, await lbP)
        : views.bountyPage(b));
    } else if (who) {
      const handle = decodeURIComponent(who[1]);
      const [p, views, api] = await Promise.all([
        import('./api.js').then((a) => a.getProfile(handle)),
        import('./views.js'),
      ]);
      if (mine !== seq) return;
      document.title = `@${p.handle} · Bountyscope`;
      done(views.profilePage(p));
    } else {
      document.title = 'Bountyscope · make.fun bounties';
      const [data] = await Promise.all([getBounties(), import('./views.js')]);
      if (mine !== seq) return;
      lastBoardData = data;
      done(board(data, sortCol));
      wireBoard(sortCol);
    }
  } catch (err) {
    if (mine !== seq) return;
    done(`<section><p class="empty">Could not load this page: ${String(err.message || err)}</p>
    <p><a href="#/">Back to the board</a></p></section>`);
  }
  if (mine === seq) {
    window.scrollTo(0, 0);
    window.__shotReady = true;
  }
}

/** The board's interactive bits: the filter box and the sortable column
 * headers. Sorting is pure client-side reordering of the same answer, so
 * re-rendering from the cached data is instant and free. */
let sortCol = '';
let lastBoardData = null;

function wireBoard(col) {
  const box = app.querySelector('#filter');
  const rows = [...app.querySelectorAll('ul.board li.row:not(.cols)')];
  if (box) {
    box.addEventListener('input', () => {
      const q = box.value.trim().toLowerCase();
      let shown = 0;
      for (const li of rows) {
        const hit = !q || li.textContent.toLowerCase().includes(q);
        li.hidden = !hit;
        if (hit) shown += 1;
      }
      const count = app.querySelector('.total');
      if (count) count.hidden = Boolean(q);
      const none = app.querySelector('.nofilter');
      if (none) none.hidden = shown > 0;
    });
    // Pressing / anywhere jumps focus into the filter box, like a search
    // field on a keyboard-first site; Escape clears it and drops focus.
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== box && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        box.focus();
      } else if (e.key === 'Escape' && document.activeElement === box && box.value) {
        box.value = '';
        box.dispatchEvent(new Event('input'));
        box.blur();
      }
    });
  }
  for (const btn of app.querySelectorAll('button.sortbtn')) {
    btn.addEventListener('click', () => {
      sortCol = btn.dataset.sort === sortCol ? '' : btn.dataset.sort;
      done(board(lastBoardData, sortCol));
      wireBoard(sortCol);
      // Keep the filter text through a re-sort: the rebuilt box starts empty,
      // so restore and re-apply it here.
      if (box && box.value) {
        const nb = app.querySelector('#filter');
        nb.value = box.value;
        nb.dispatchEvent(new Event('input'));
      }
    });
  }
}

window.addEventListener('hashchange', route);
route();
