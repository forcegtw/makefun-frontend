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

import { getBountiesPage, getBountiesSWR } from './api.js';
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
      const [first] = await Promise.all([
        getBountiesSWR((fresh) => {
          // The revalidated answer landed after the render: swap the page
          // list in place so the board updates without losing the filter or
          // the sort, but only if the board is still what's on screen.
          if (mine === seq && lastBoardData) {
            pages = [fresh];
            redrawBoard();
          }
        }),
        import('./views.js'),
      ]);
      if (mine !== seq) return;
      pages = [first];
      lastBoardData = first;
      done(board(first, sortCol, sortDir, pages));
      wireBoard();
    }
  } catch (err) {
    if (mine !== seq) return;
    done(`<section><p class="empty">Could not load this page: ${String(err.message || err)}</p>
    <p><a href="#/">Back to the board</a></p></section>`);
  }
  if (mine === seq) {
    window.scrollTo(0, 0);
    // Hand keyboard focus to the freshly rendered content so a screen reader
    // announces the new view instead of leaving focus on a dead element.
    const h1 = app.querySelector('h1');
    if (h1) {
      h1.tabIndex = -1;
      h1.focus({ preventScroll: true });
    }
    window.__shotReady = true;
  }
}

/** The board's interactive bits: the filter box and the sortable column
 * headers. Sorting is pure client-side reordering of the same answer, so
 * re-rendering from the cached data is instant and free. A second click on
 * the active column flips its direction instead of clearing the sort. */
let sortCol = '';
let sortDir = '';
let lastBoardData = null;
/** The board's fetched pages, oldest first; a SWR refresh replaces them all. */
let pages = [];

/** Redraw the board from cached data and re-wire it, keeping the filter text. */
function redrawBoard() {
  done(board(lastBoardData, sortCol, sortDir, pages));
  wireBoard();
  const prev = redrawBoard.prevFilter;
  if (prev) {
    const nb = app.querySelector('#filter');
    if (nb) {
      nb.value = prev;
      nb.dispatchEvent(new Event('input'));
    }
  }
}
redrawBoard.prevFilter = '';

function wireBoard() {
  const box = app.querySelector('#filter');
  const rows = [...app.querySelectorAll('ul.board li.row:not(.cols)')];
  if (box) {
    box.addEventListener('input', () => {
      redrawBoard.prevFilter = box.value;
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
    // Wired once, on a capture-phase flag, so re-sorts don't stack listeners.
    if (!window.__bountyKeys) {
      window.__bountyKeys = true;
      window.addEventListener('keydown', (e) => {
        const b = app.querySelector('#filter');
        if (!b) return;
        if (e.key === '/' && document.activeElement !== b && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          b.focus();
        } else if (e.key === 'Escape' && document.activeElement === b && b.value) {
          b.value = '';
          b.dispatchEvent(new Event('input'));
          b.blur();
        }
      });
    }
  }
  // Hovering a bounty link starts its page fetch before the click lands,
  // so the detail view often renders from cache the instant it's wanted.
  // pointerenter (not mouseenter) so touch/stylus users benefit too; the
  // api module de-duplicates via its inflight map, so this is always cheap.
  for (const a of app.querySelectorAll('a.title')) {
    a.addEventListener('pointerenter', () => {
      import('./api.js').then((api) => api.prefetchBounty(a.getAttribute('href')));
    }, { once: true });
  }
  for (const btn of app.querySelectorAll('button.sortbtn')) {
    btn.addEventListener('click', () => {
      if (btn.dataset.sort === sortCol) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortCol = btn.dataset.sort;
        sortDir = '';
      }
      redrawBoard();
    });
  }
  // "Load more" appends the next cursor page to what's already rendered.
  // The button disappears while its fetch is inflight so a double click
  // can't fire two requests for the same cursor; the inflight map in the
  // API would de-duplicate anyway, but the visual state should match.
  const more = app.querySelector('button.morebtn');
  if (more) {
    more.addEventListener('click', async () => {
      const cursor = more.dataset.cursor;
      more.disabled = true;
      more.textContent = 'Loading…';
      try {
        const page = await getBountiesPage(cursor);
        pages.push(page);
        redrawBoard();
      } catch (err) {
        more.disabled = false;
        more.textContent = `Couldn't load more: ${String(err.message || err)}`;
      }
    });
  }
  // Profile links on the leaderboard prefetch on hover the same way the
  // board's bounty links do, so clicking through to an account usually
  // renders from cache. One delegated listener instead of one per link.
  if (!window.__bountyHover) {
    window.__bountyHover = true;
    document.addEventListener('pointerover', (e) => {
      const a = e.target && e.target.closest && e.target.closest('a.who');
      if (a) import('./api.js').then((api) => api.prefetchProfile(a.getAttribute('href')));
    }, { capture: true });
  }
}

/** The board's time chips and the bounty page's "time left" line count down
 * against Date.now() but only change on a render, so they drift stale while
 * a visitor keeps a tab open. A quiet minute tick redraws the board from its
 * cached data — instant, no fetch — whenever the board is what's on screen. */
let tick = null;
function keepFresh() {
  clearInterval(tick);
  tick = setInterval(() => {
    // Only when the board itself is on screen; lastBoardData lingers after
    // navigating away and redrawing then would clobber the current view.
    if (lastBoardData && app.querySelector('#filter') && !app.getAttribute('aria-busy')) redrawBoard();
  }, 60000);
}
keepFresh();

window.addEventListener('hashchange', route);
route();
