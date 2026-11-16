# Bountyscope — a fast custom frontend for make.fun

Entry for the [makefun-frontend-01](https://make.fun/c/makefun-frontend-01) bounty: a zero-dependency vanilla-JS make.fun frontend — bounty board, bounty pages, leaderboards and public profiles on live make.fun data, 5.8 KB gzipped first load.

## What's in it

- **Board** — live bounties with pots, fees, deadlines and entry counts. Click a
  column header to sort; click it again to flip the direction (`aria-sort`
  tracks the state). Press `/` to jump to the filter, `Escape` to clear it; the
  filter survives re-sorts. Hovering a bounty prefetches its page so the click
  renders from cache, and a quiet minute tick refreshes the countdown chips
  from cached data while the board is on screen.
- **Bounty page** — pot breakdown, rewards table (base vs. amount now),
  markdown-lite rules, Overview/Leaderboard tabs.
- **Leaderboard** — judge win rates with live scoring during the dev phase.
- **Profiles** — record, prizes and every entry a handle has made.

Navigation keeps the old view on screen (dimmed) until the new one renders;
focus moves to each view's heading so screen readers announce the page change.
ETag revalidation keeps revisits cheap; nothing ever posts back.

![competition](https://make.fun/badge/makefun-frontend-01.svg)
![rank](https://make.fun/badge/makefun-frontend-01/forcegtw/makefun-frontend/rank.svg)
![reward](https://make.fun/badge/makefun-frontend-01/forcegtw/makefun-frontend/reward.svg)
