// The detail views, loaded lazily by import(): a bounty's page, its
// leaderboard and an account's public profile. Each renders from one API
// answer already fetched by the router.

import { date, esc, isLive, money, timeLeft } from './format.js';

/** The pot as it stands: the sponsor's reward plus entry fees paid in. */
const pot = (b) => money(b.potUsd ?? b.rewardAmount);

/** The entry fee, when the bounty charges one. */
const fee = (b) => (b.entryFeeUsd ? money(b.entryFeeUsd) : '—');

/** A chip for a bounty's state: calm (days ahead), hot (under a day), over. */
function chip(b) {
  if (!isLive(b)) return '<span class="chip over">ended</span>';
  const hours = (new Date(b.deadline).getTime() - Date.now()) / 3600000;
  return `<span class="chip ${hours < 24 ? 'hot' : 'calm'}">${esc(timeLeft(b.deadline))}</span>`;
}

/** Markdown-lite for a bounty's rules: headings, lists, code and paragraphs.
 * Every line is escaped first, so the source text can carry no markup. */
function describe(text) {
  let html = '';
  let list = null;
  const closeList = () => { if (list) { html += `</${list}>`; list = null; } };
  const inline = (s) => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.trimEnd();
    if (line.startsWith('```')) { closeList(); continue; }
    if (/^#{1,4} /.test(line)) {
      closeList();
      const level = Math.min(line.match(/^#+/)[0].length + 1, 5);
      html += `<h${level}>${inline(line.replace(/^#+ /, ''))}</h${level}>`;
    } else if (/^[-*] /.test(line)) {
      if (list !== 'ul') { closeList(); html += '<ul>'; list = 'ul'; }
      html += `<li>${inline(line.slice(2))}</li>`;
    } else if (/^\d+\. /.test(line)) {
      if (list !== 'ol') { closeList(); html += '<ol>'; list = 'ol'; }
      html += `<li>${inline(line.replace(/^\d+\. /, ''))}</li>`;
    } else if (line === '') {
      closeList();
    } else {
      closeList();
      html += `<p>${inline(line)}</p>`;
    }
  }
  closeList();
  return html;
}

/** One leaderboard entry's avatar: make.fun's images send
 * Cross-Origin-Resource-Policy: same-origin, so crossorigin="anonymous" goes
 * on the img before the src or the browser refuses to render it. */
function avatar(url, handle) {
  return url
    ? `<img crossorigin="anonymous" class="face" width="22" height="22" alt="${esc(handle)}'s avatar" src="${esc(url)}">`
    : '';
}

export function bountyPage(b) {
  const slug = encodeURIComponent(b.slug);
  const rewards = Object.entries(b.rewards || {});
  const live = isLive(b);
  return `<article>
  <p class="crumb"><a href="#/">← All bounties</a></p>
  <div class="headrow"><h1>${esc(b.title)}</h1>${chip(b)}</div>
  <p class="sum">${esc(b.summary || '')}</p>
  <div class="facts">
    <div class="fact"><span class="k">Live pot</span><span class="v big">${pot(b)}</span>${Number(b.entryFeesUsd) > 0 ? `<span class="k">incl. ${money(b.entryFeesUsd)} in fees</span>` : ''}</div>
    <div class="fact"><span class="k">Entry fee</span><span class="v">${fee(b)}</span></div>
    <div class="fact"><span class="k">Deadline</span><span class="v">${date(b.deadline)}</span><span class="k">${live ? esc(timeLeft(b.deadline)) : 'ended'}</span></div>
    <div class="fact"><span class="k">Entries</span><span class="v">${b.submissionCount ?? 0}</span></div>
    ${b.sponsor ? `<div class="fact"><span class="k">Sponsor</span><span class="v">${esc(b.sponsor.name)}${b.sponsor.isVerified ? ' ✓' : ''}</span></div>` : ''}
  </div>
  <nav class="tabs">
    <a class="tab on" aria-current="page" href="#/bounty/${slug}">Overview</a>
    <a class="tab" href="#/bounty/${slug}/leaderboard">Leaderboard</a>
  </nav>
  ${rewards.length ? `<h2>Rewards</h2>
  <table class="rewards"><tr><th>Place</th><th>Base</th><th>Amount now</th></tr>
  ${rewards.map(([place, base]) => {
    const now = (b.rewardsNow || []).find((r) => String(r.place) === place);
    return `<tr><td>${esc(place)}</td><td>${money(base)}</td><td>${now ? money(now.amountUsd) : money(base)}</td></tr>`;
  }).join('')}
  </table>` : ''}
  <h2>Rules</h2>
  <div class="description">${describe(b.rules || b.description)}</div>
</article>`;
}

export function leaderboardPage(b, lb) {
  const slug = encodeURIComponent(b.slug);
  const entries = lb.entries || [];
  const rate = (v) => (v == null ? '—' : `${(v / 10000).toFixed(2)}%`);
  return `<article>
  <p class="crumb"><a href="#/bounty/${slug}">← ${esc(b.title)}</a></p>
  <div class="headrow"><h1>${esc(lb.title || 'Leaderboard')}</h1><span class="chip calm">${b.submissionCount ?? 0} entries</span></div>
  <nav class="tabs">
    <a class="tab" href="#/bounty/${slug}">Overview</a>
    <a class="tab on" aria-current="page" href="#/bounty/${slug}/leaderboard">Leaderboard</a>
  </nav>
  ${entries.length ? `<table class="lb">
    <tr><th>#</th><th>Entrant</th><th>Entry</th>${lb.columns.map((c) => `<th>${esc(c.title)}</th>`).join('')}</tr>
    ${entries.map((e) => `<tr>
      <td>${e.rank}</td>
      <td><a class="who" href="#/u/${encodeURIComponent(e.handle)}">${avatar(e.image, e.handle)}${esc(e.handle)}</a></td>
      <td class="etitle" title="${esc(e.title || '')}">${esc(e.title || '')}</td>
      ${lb.columns.map((c) => `<td>${c.key === 'judge' ? rate(e.values && e.values[c.key]) : c.key.startsWith('judge_') && e.values && e.values[c.key] != null ? rate(e.values[c.key]) : esc((e.display && e.display[c.key]) ?? '—')}</td>`).join('')}
    </tr>`).join('')}
  </table>
  <p class="note">Judge win rate with its 90% interval; size is the dossier's byte count.</p>`
    : '<p class="empty">No scored entries yet — rates show once the judge grades them.</p>'}
</article>`;
}

export function profilePage(p) {
  const rec = p.record || {};
  const sols = p.solutions || [];
  const stats = [
    ['Entered', rec.competitions_entered],
    ['Placed', rec.competitions_placed],
    ['Won', rec.competitions_won],
    ['Best place', rec.best_placement],
    ['Prizes', p.payouts && p.payouts.total ? money(p.payouts.total) : rec.prize_usd != null ? money(rec.prize_usd) : null],
    ['Joined', p.joined_at ? date(p.joined_at) : null],
  ].filter(([, v]) => v != null);
  return `<article>
  <div class="who-head">
    ${p.avatar ? `<img crossorigin="anonymous" class="face big" width="56" height="56" alt="" src="${esc(p.avatar.url)}">` : ''}
    <div>
      <h1>${esc(p.display_name || p.handle)}</h1>
      <p class="k">@${esc(p.handle)}${p.house ? ' · house' : ''}${p.github_login ? ` · <a href="https://github.com/${esc(p.github_login)}" rel="noopener">github/${esc(p.github_login)}</a>` : ''}</p>
      ${p.bio ? `<p class="sum">${esc(p.bio)}</p>` : ''}
    </div>
  </div>
  <div class="facts">
    ${stats.map(([k, v]) => `<div class="fact"><span class="k">${k}</span><span class="v">${esc(v)}</span></div>`).join('')}
  </div>
  <h2>Entries</h2>
  ${sols.length ? `<ul class="sols">
    ${sols.map((s) => `<li>
      <a class="title" href="#/bounty/${encodeURIComponent((s.competition && s.competition.slug) || '')}">${esc(s.title || (s.competition && s.competition.title) || '')}</a>
      <p class="meta"><span class="cat">${esc((s.competition && s.competition.title) || '')}</span>
        ${s.competition && s.competition.reward_usd ? `<span>${money(s.competition.reward_usd)} pot</span>` : ''}
        ${s.placement ? `<span class="chip hot">place ${esc(s.placement)}</span>` : ''}
        ${s.prize_usd ? `<span>${money(s.prize_usd)}</span>` : ''}</p>
    </li>`).join('')}
  </ul>` : '<p class="empty">No entries yet.</p>'}
</article>`;
}
