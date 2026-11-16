// The board view: one API answer rendered as a sortable-looking table of the
// live bounties with their pots, fees, deadlines and entries.
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

export function board(data) {
  const all = (data && data.items) || [];
  // Live first (nearest deadline first), then the ones whose deadline passed.
  const items = [...all].sort((a, b) => {
    const la = isLive(a), lb = isLive(b);
    if (la !== lb) return la ? -1 : 1;
    return new Date(a.deadline) - new Date(b.deadline);
  });
  const live = items.filter(isLive);
  const total = live.reduce((s, b) => s + Number(b.potUsd ?? b.rewardAmount ?? 0), 0);
  const rows = items.map(row).join('');
  return `<section>
  <div class="headrow">
    <h1>Open bounties</h1>
    <p class="total">${live.length} taking entries · ${money(total)} in live pots</p>
  </div>
  <ul class="board">
    <li class="row cols" aria-hidden="true"><div class="grow">Bounty</div><div>Pot</div><div>Fee</div><div>Time</div><div>Entries</div></li>
    ${rows}
  </ul>
  ${items.length ? '' : '<p class="empty">No bounties are open right now.</p>'}
</section>`;
}
