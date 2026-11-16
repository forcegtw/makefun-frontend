// The board view: one API answer rendered as a table of the bounties whose
// columns can be sorted by clicking their headers. The default order puts the
// live bounties first, nearest deadline on top, which is what a hunter wants
// without touching anything; every other column sorts on demand.
import { esc, isLive, money, timeLeft } from './format.js';

/** The pot as it stands: the sponsor's reward plus entry fees paid in. */
const pot = (b) => money(b.potUsd ?? b.rewardAmount);

/** The entry fee, when the bounty charges one. */
const fee = (b) => (b.entryFeeUsd ? money(b.entryFeeUsd) : '—');

/** A chip for a bounty's state: calm (days ahead), hot (hours) or over. */
function chip(b) {
  const live = isLive(b);
  if (!live) return '<span class="chip over">ended</span>';
  const hours = (new Date(b.deadline).getTime() - Date.now()) / 3600000;
  return `<span class="chip ${hours < 24 ? 'hot' : 'calm'}">${esc(timeLeft(b.deadline))}</span>`;
}

/** The raw number each sortable column ranks on, so sorting never has to
 * parse the formatted strings the cells show. */
function metric(key, b) {
  switch (key) {
    case 'pot': return Number(b.potUsd ?? b.rewardAmount ?? 0);
    case 'fee': return Number(b.entryFeeUsd ?? 0);
    case 'time': return new Date(b.deadline).getTime() || Infinity;
    case 'entries': return Number(b.submissionCount ?? 0);
    default: return 0;
  }
}

/** The order that decides between ties and, on the default view, the rows. */
const DEFAULT_ORDER = (a, b) => {
  const la = isLive(a), lb = isLive(b);
  if (la !== lb) return la ? -1 : 1;
  return new Date(a.deadline) - new Date(b.deadline);
};

/** Sort the items for one column. Everything ranks descending except time,
 * where soonest-first is the useful direction; an explicit direction from a
 * second click on the same header wins over that default. */
export function sortItems(all, key, dir) {
  if (!key) return [...all].sort(DEFAULT_ORDER);
  const sign = (dir || (key === 'time' ? 'asc' : 'desc')) === 'asc' ? 1 : -1;
  return [...all].sort((a, b) => sign * (metric(key, a) - metric(key, b)) || DEFAULT_ORDER(a, b));
}

/** One row of the board: the numbers a hunter scans first. */
function row(b) {
  return `<li class="row">
  <div class="grow"><a class="title" href="#/bounty/${encodeURIComponent(b.slug)}">${esc(b.title)}</a>
    <p class="sum">${esc(b.summary || '')}</p>
    <p class="meta">${b.category ? `<span class="cat">${esc(b.category)}</span>` : ''}${(b.skills || []).slice(0, 3).map((s) => `<span class="tag">${esc(s)}</span>`).join('')}</p>
  </div>
  <div class="num pot" title="Reward plus entry fees paid in">${pot(b)}</div>
  <div class="num">${fee(b)}</div>
  <div class="num">${chip(b)}</div>
  <div class="num">${b.submissionCount ?? 0} entr${b.submissionCount === 1 ? 'y' : 'ies'}</div>
</li>`;
}

/** A column header: a button when the column can sort, plain text otherwise.
 * The active column shows an arrow pointing along the current direction so
 * the state stays readable after the re-render. */
function head(label, key, active, dir) {
  if (!key) return `<div>${label}</div>`;
  const on = active === key;
  const arrow = on ? (dir === 'asc' ? ' ↑' : ' ↓') : '';
  const dirWord = on ? (dir === 'asc' ? 'ascending' : 'descending') : 'none';
  return `<div aria-sort="${dirWord}"><button type="button" class="sortbtn${on ? ' on' : ''}" data-sort="${key}" title="Sort by ${label.toLowerCase()}${on ? ', again to flip the direction' : ''}" aria-label="Sort by ${label.toLowerCase()}${on ? `, currently ${dirWord}` : ''}">${label}${arrow}</button></div>`;
}

export function board(data, active = '', dir = '') {
  const all = (data && data.items) || [];
  const items = sortItems(all, active, dir);
  const live = all.filter(isLive);
  const total = live.reduce((s, b) => s + Number(b.potUsd ?? b.rewardAmount ?? 0), 0);
  const rows = items.map(row).join('');
  return `<section>
  <div class="headrow">
    <h1>Open bounties</h1>
    <p class="total">${live.length} taking entries · ${money(total)} in live pots</p>
  </div>
  <input id="filter" class="filter" type="search" placeholder="Filter bounties…  (press / to jump here)"
    aria-label="Filter bounties" autocomplete="off" spellcheck="false">
  <ul class="board">
    <li class="row cols" aria-hidden="false">${head('Bounty', '', active, dir)}${head('Pot', 'pot', active, dir)}${head('Fee', 'fee', active, dir)}${head('Time', 'time', active, dir)}${head('Entries', 'entries', active, dir)}</li>
    ${rows}
  </ul>
  <p class="empty nofilter" hidden>No bounties match that filter.</p>
  ${items.length ? '' : '<p class="empty">No bounties are open right now.</p>'}
</section>`;
}
