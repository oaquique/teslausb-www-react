# TeslaUSB React UI — Comprehensive Audit

**Date:** 2026-04-17 (overnight run)
**Scope:** `src/`, `public/filebrowser.js`, `public/filebrowser.css`, `index.html`, `vite.config.js`, `package.json`
**Reference:** `~/.claude/CLAUDE.md` Design System (authoritative)
**Audit passes run (6):** Design System conformance (React), Legacy filebrowser audit, Accessibility + responsive, Bugs / perf / code quality, `ui-ux-pro-max` review, `frontend-design` craft critique

---

## Executive summary

**Health:** The React app is well-structured Preact code with sensible component boundaries and a recently-codified Design System in `~/.claude/CLAUDE.md`. The new ID3 metadata panel (shipped today) is the only fully-conformant surface. Everything else predates the Design System and has drift — mostly hardcoded colors, wrong font stack, missing focus/a11y primitives, and aggressive polling that burns the Pi's CPU and the car's WiFi.

**What to fix first:** 4 P0 items (XSS holes, logic bugs, missing focus rings, color-only status indicators). After that, the highest ROI is replacing the 4-parallel-poll pattern with a single coalesced endpoint or SSE stream — saves ~75% of the current background work on the Pi.

**Strategic question:** The legacy `public/filebrowser.js` (1,400 lines of vanilla JS with documented XSS holes and no keyboard support) sits awkwardly inside a Preact app. Two paths: (a) patch the worst bugs and leave it; (b) rewrite as a Preact component over a weekend. Recommend (a) now, (b) as a follow-up sprint. Details in §7.

**Tally:** ~110 findings across the 6 passes. 8 critical (P0), 41 high (P1), 44 medium (P2), 17 nice-to-have (P3).

**Estimated total effort:** 40–55 hours for everything down to P2. Core fix pack (P0 + top P1) is 12–16 hours.

---

## Priority legend

- **P0 — CRITICAL**: security, correctness, or accessibility ship-blockers. Fix this week.
- **P1 — HIGH**: significant UX or perf pain, visible to every user. Plan into next iteration.
- **P2 — MEDIUM**: polish, secondary perf, maintainability. Batch into a dedicated cleanup PR.
- **P3 — LOW**: future consideration or micro-polish.

---

## 1. P0 — Ship-blockers (fix first)

| # | File:Line | Issue | Fix |
|---|-----------|-------|-----|
| 1.1 | `public/filebrowser.js:102` | **XSS** — drive label interpolated into `innerHTML` with no escape. Attacker-controllable if drive labels come from config. | Run `this.escapeHtml(this.drives[0].label)` (helper already exists at line 706). |
| 1.2 | `public/filebrowser.js:744` | **XSS** — tree item label from server response `innerHTML`-injected unescaped. | Wrap `label` in `this.escapeHtml()`. |
| 1.3 | `public/filebrowser.js:91` | **XSS** — drive selector dropdown HTML built with unescaped labels. | Same fix. |
| 1.4 | `public/filebrowser.js:786` | **Logic bug** — `if (type.indexOf("text") !== 1)` — should be `!== -1`. Response-type check is broken; likely never matched in production. | Change `!== 1` → `!== -1`. |
| 1.5 | `src/services/api.js:49` | **Bug** — `listDirectory` malforms query string: `encodeURIComponent` applied twice, params concatenated without keys. Request hits server as `?/mnt/music&` instead of `?root=/mnt/music&path=...`. | Use `URLSearchParams`; verify endpoint actually works. |
| 1.6 | `src/styles/index.css` (no focus-visible rules anywhere for `.btn` / `.nav-link` / `.toggle-btn` / `.action-btn`) | **a11y blocker** — tabbing through the UI shows no focus indicator. Keyboard users can't tell where they are. | Add `.btn:focus-visible, .nav-link:focus-visible, .toggle-btn:focus-visible, .action-btn:focus-visible { outline: 2px solid var(--accent, #2563eb); outline-offset: 2px; }`. One rule covers all. |
| 1.7 | `src/App.jsx:65-67`, `src/styles/index.css:790-799` | **a11y blocker** — "Connected" / "Disconnected" badge + sync status dots rely on color alone. Fails WCAG 1.4.1. | Pair each color with an SVG icon (✓ checkmark, ✕ cross, ⟳ spinner, ⚠ warning) and ensure text label. Status dot should sit next to a one-word state ("Idle", "Syncing", "Error"). |
| 1.8 | `public/filebrowser.js:827` + tree entries | **a11y blocker** — file/directory entries use `onclick` only, no `onkeydown`. Tree is non-operable by keyboard. The `.fb-barbutton` toolbar items are `<div>`s with background-image icons, no `<button>`, no `aria-label`. | Convert `.fb-barbutton` divs to `<button aria-label="…">`. Add keyboard handlers (Enter/Space) to tree entries, or migrate to `<button>` elements. Audio overlay also needs Escape-key handler (currently only close-button click works). |

**P0 effort: 4–6 hours.**

---

## 2. P1 — High-impact wins

### 2.1 Performance (the Pi + weak WiFi story)

- **[P1] Coalesce status polling** — `src/hooks/useStatus.js:36–40` + `src/components/Dashboard.jsx:34–37`: four independent pollers running simultaneously (status every 5s, config every 5s, storage every 5s, log-tail every 3s, music-sync 1.5s, cam-sync 1.5s). Merge into one `/cgi-bin/status.sh?include=all` endpoint returning `{status, config, storage, sync}` as JSON. Use ETag / `If-Modified-Since` for conditional. Reduces request count by ~75% and eliminates waterfall contention on the Pi's single CPU.
- **[P1] Replace polling with Server-Sent Events** — `src/hooks/useLogTail.js`, `useMusicSyncProgress`, `useCamSyncProgress`. A single SSE connection to `/cgi-bin/events.sh` pushing only diffs would save another ~80% of the remaining bandwidth. Good follow-up after 2.1a.
- **[P1] Lazy-load FileBrowser + jsmediatags** — `src/components/FileBrowser.jsx:22–40` always loads ~100 KB of scripts on mount, even if the user never visits Files. Move script injection into a `useEffect` gated on `activeTab === 'files'`.
- **[P1] Virtualize the log viewer** — `src/components/LogViewer.jsx:200–204` re-renders all ≤1000 lines on every update with `key={idx}`. Use a stable key (line content hash or source offset) and virtualize (e.g., `react-virtualized` port, or roll a simple windowed list) once line count exceeds 200.
- **[P1] Race condition + leak: BLE pairing loop** — `src/components/Sidebar.jsx:71-79`. A 60-iteration × 2-second loop runs async with no mount check; if user navigates away mid-pair, the loop keeps calling `setBleStatus` on an unmounted component. Add an `abortRef` / `mountedRef` pattern or AbortController.
- **[P1] `useLogTail` stale-closure trap** — `src/hooks/useLogTail.js:72`. The comment says "don't depend on refresh to avoid recreation" which is a smell. `logFileRef` workaround works by accident; refactor properly or convert to SSE.

### 2.2 Accessibility (beyond the P0 set)

- **[P1] Icon-only buttons missing `aria-label`** — 30-minute sweep. Files: `Header.jsx:40` (refresh), `Sidebar.jsx:117–210` (speed test, USB toggle, reboot, BLE pair), `LogViewer.jsx:151–161` (clear/download/refresh). Every icon button needs a label describing the action.
- **[P1] `index.html:5` has `user-scalable=no`** — blocks pinch-zoom, WCAG 1.4.4 violation. Remove it.
- **[P1] Modals lack focus-trap and Escape handling** — Audio overlay (`public/filebrowser.js:602–644`) has `role="dialog"` but doesn't move focus into itself, doesn't trap tab order, doesn't listen for Escape. Any `confirm()` dialogs the Sidebar calls are also jarring on mobile; replace with a proper `<dialog>` or Preact confirmation component.
- **[P1] `prefers-reduced-motion` not honored globally** — `src/styles/index.css:793–799` pulse/spin/slideIn animations have no reduced-motion guard. Only the audio overlay (which I added today) honors it. Wrap all animation declarations or add a single `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }` as a safety net.
- **[P1] Touch targets <44px** — `.btn` (24–28px tall via `padding: 6px 12px`), `.nav-link` (32px), filebrowser splitter (3px hit target). Bump all interactive elements to `min-height: 44px` on mobile. Existing `@media (pointer: coarse)` block in `index.css:2154-2172` is a good foundation — extend it.
- **[P1] Semantic HTML gaps** — Dashboard sections use `<div class="section-title">` instead of `<h2>`. App shell uses div-soup; wrap in `<header>` / `<nav>` / `<main>` / `<aside>` per `~/.claude/CLAUDE.md`.
- **[P1] Color contrast margin cases** — `.storage-legend-value` at `#78716c` on `#faf9f7` is ~4.2:1, below 4.5 for normal text. Bump to `#44403c` (text-body). Verify all uses of `--text-secondary` as text.

### 2.3 Design System conformance

Full inventory in §4. Top P1 items:

- **[P1] Wrong font stack** — `index.html:16` imports **IBM Plex Sans + DM Sans**, but the Design System requires **Manrope (headings) + DM Sans (body) + JetBrains Mono (code)**. Manrope is missing entirely. `src/styles/index.css:8` also sets `--font-heading: 'DM Sans'` which should be `'Manrope'`. Fix the Google Fonts import and the two CSS vars.
- **[P1] Widespread hardcoded colors in inline styles** — e.g., `src/components/VideoViewer.jsx` has 10+ literals (`#333`, `#fff`, `#78716c`, `#2563eb`) in inline `style={{…}}`; `LogViewer.jsx:188–214` has 5 hardcoded greys; `FileBrowser.jsx:98-142` has large inline style blocks. Replace with CSS vars and class names.
- **[P1] Off-grid spacing** — `VideoViewer.jsx:273/295/317` uses `padding: '6px 10px'` (10px off-grid); `SyncStatus.jsx:179` uses `marginTop: '0.75rem'` (≈12px but via a fractional rem). Snap to 4px grid.
- **[P1] Legacy `filebrowser.css` palette drift** — 8 occurrences of `#0095f6` (should be `#2563eb`), 8 of Lato (should be DM Sans / Manrope), 7 of `#1f2937` dark-mode leakage text. One focused pass fixes all.

### 2.4 UX feedback & flows

- **[P1] No toast/progress for long-running ops** — Reboot takes 30-60s, speed test ~10s, BLE pairing up to 120s. Currently just a button spinner, then the page goes blank (reboot) or the spinner stops (speed test). Add a toast system (`aria-live="polite"`) with non-auto-dismiss for reboot ("Restarting — reconnect in ~60s"), auto-dismiss for speed test.
- **[P1] Route state not preserved** — `src/App.jsx:21-23` holds `activeTab` in React state only. Refresh bounces back to Dashboard. Persist to `localStorage` or add URL routing (`#/viewer`, `#/files`) so users can deep-link and back-button works.
- **[P1] Mobile text truncation** — `.info-value` shows WiFi SSID / IP / hostname at 10–11px on 375px phones and overflows. Set `max-width` + `text-overflow: ellipsis`, or wrap and bump size to 13–14px.

**P1 effort: ~16 hours.**

---

## 3. P2 — Polish, maintainability, secondary perf

Selected highlights (full list ~40 items spread across the 6 reports):

- **Error boundaries** — One component crash blanks the whole app. Wrap each tab in a Preact error boundary showing a retry fallback. (`src/App.jsx`)
- **Extract polling into a shared `usePolling(fetcher, interval, enabled)` hook** — at least 4 hooks reimplement the same pattern with subtly different cleanup. Consolidate.
- **Date / locale formatting** — `Intl.NumberFormat` and `Intl.DateTimeFormat` nowhere to be seen. Timestamps display inconsistently. Add a formatting util and use it for all numeric displays, sync rates, storage sizes.
- **Feature-flag helper** — `config?.has_cam === 'yes'` check is duplicated across Dashboard, App, Sidebar. Extract `useConfigFlags()` that returns typed booleans.
- **Move component helpers to utils** — `formatSequenceName` and `formatTimestamp` live inside `VideoViewer.jsx`; should be `src/utils/formatting.js`.
- **`fileClicked` XSS note** — I noticed today when we fixed the audio overlay that the legacy `filebrowser.js` had two other `innerHTML` paths (tree, drive selector). The P0 list above covers them.
- **Touch target on splitter / tree controls** — see §2.2.
- **Bundle-splitting by route** — the Dashboard initial bundle includes VideoViewer (~50 KB gz). Dynamic import per tab saves first-paint.
- **Content-priority on mobile** — dashboard currently shows Sidebar (device info) before main content on mobile. Flip it — user wants storage + sync status above the fold.
- **Empty states everywhere** — `StorageBar.jsx:38-44` shows bare "No storage data available" text. Apply the pattern from the Design System (icon + title + subtitle + action) consistently: empty log viewer, empty file browser, no-camera state, etc.
- **`parseSyncStatus` needs tests** — `src/hooks/useLogTail.js:99–327` is a 230-line state machine with zero tests. One regression in log format and sync status silently breaks.
- **Dead code** — `filebrowser.js:715-733` defines `base64ToBytes` / `bytesToBase64` / `stringEncode` / `stringDecode` and never calls them (`stringEncode` is also a no-op). Delete.

---

## 4. Design System conformance matrix

Counts across `src/` + `index.html` + legacy `filebrowser.*`:

| Category | Critical | Major | Minor | Hotspots |
|---|---|---|---|---|
| Color hardcoding | 24 | 11 | 5 | `VideoViewer.jsx`, `LogViewer.jsx`, `FileBrowser.jsx`, `filebrowser.css` (`#0095f6` × 8) |
| Spacing off-grid | 0 | 9 | 6 | Inline padding in `VideoViewer`, `SyncStatus`, `filebrowser.css` (10px, 14px, 0.75rem) |
| Typography drift | 3 critical (fonts) | 12 | 3 | Font imports in `index.html`, Lato in `filebrowser.css` × 8, wrong `--font-heading` |
| Radius mismatches | 0 | 0 | 4 | `filebrowser.css` (6px instead of 4/8) |
| Shadow drift | 0 | 0 | 3 | `filebrowser.css:198`, `:534`, `:709` use Tailwind-default shadows, not the warm `rgba(28,25,23,…)` scale |
| Dark-theme leakage | 3 | 6 | 0 | `VideoViewer` uses `#333`/`#444`/`#fff`; `filebrowser.css` has `#1f2937` × 7 |
| Inline style abuse | — | 6 large blocks | 4 | `FileBrowser.jsx:98–142`, `LogViewer.jsx:119–124`, `VideoViewer.jsx:253–325` |
| Missing Tailwind | 1 root-cause | — | — | Project has no Tailwind. Design System expects `@theme`-driven utilities. Decide whether to migrate or keep hand-written CSS (section §9). |

**Total DS violations:** ~85 across the codebase.

---

## 5. Accessibility + responsive scorecard

### Accessibility
- **Focus indicators**: ❌ Missing on all interactive elements outside the new audio overlay. (P0)
- **Icon-only buttons with label**: ❌ Most are unlabeled. (P1)
- **Touch targets ≥44×44**: ⚠ Partial (`@media pointer: coarse` exists but not enforced on all components). (P1)
- **Color not sole signal**: ❌ Status badges + sync dots. (P0)
- **Reduced-motion honored**: ✅ global safety net shipped in craft pass.
- **Semantic HTML**: ✅ Dashboard/App/LogViewer wrapped in proper `<section>`/`<header>`/`<main>`/`<h2>`/`<h1>` in the a11y pass.
- **Heading hierarchy**: ✅ `<h1>` on topbar, `<h2>` on section titles.
- **Zoom blocked**: ✅ `user-scalable=no` removed from viewport meta.
- **Skip links**: ✅ shipped 2026-04-18. `<a href="#main-content" class="skip-link">Skip to main content</a>` is the first focusable element in `App.jsx`; `.app-main` has `id="main-content"` + `tabIndex="-1"`. CSS hides off-screen until keyboard focus brings it in.
- **`aria-live` on dynamic content**: ✅ sync status card, storage bar wrapper. (Log viewer content deliberately not aria-live — high-volume updates would overwhelm screen readers.)
- **Modal focus trap / Escape**: ⚠ deferred to the filebrowser rewrite (the audio overlay is inside the legacy `filebrowser.js` sprint).

### Responsive behavior
- **375px (small phone)**: `.info-value` overflow; text as small as 9–11px; tabs scroll horizontally; dashboard shows sidebar first (wrong priority). **Needs attention.**
- **768px (tablet portrait)**: Generally OK. Sidebar transforms; KPI grid flows to 2-col. No hamburger pattern — sidebar just stacks. Consider the spec'd hamburger + drawer.
- **1024px (tablet landscape)**: Good. 3-col KPI grid.
- **1440px+ (desktop)**: Good but lazy — no max-content-width enforcement on the main area; opportunity to create visual hierarchy via asymmetric card weights (see §8).

---

## 6. Bugs & correctness (summary)

Beyond the P0 logic/XSS items in §1:

- **`src/hooks/useStatus.js:40`** — `useCallback` dep array drops `pollInterval`; stale closure can double-up intervals during fast remount.
- **`src/components/LogViewer.jsx:78`** — effect deps missing `handleGenerateDiagnostics`.
- **`src/components/Dashboard.jsx:52-62`** — feature-flag check (`=== 'yes'`) duplicated in multiple places; if backend ever emits `"true"` one changes silently breaks.
- **`src/services/api.js:423`** — `runSpeedTest` stream reader: AbortError caught, other reader.read() errors can escape.
- **`src/hooks/useMusicSyncProgress.js:62`** — stale closure risk around `refresh` recreated inside effect.
- **`public/filebrowser.js:527`** — selection-rectangle listeners added per invocation; `removeEventListener` can't find them on drag-interrupt → dangling listeners.
- **`public/filebrowser.js:937`** — `ls()` returns a Promise that never resolves if `readfile()` callback never fires (network dies). Add a timeout.
- **`public/filebrowser.js:982`** — `if (srcDir == destPath) { return; }` returns `undefined` where callers expect boolean. Validate it doesn't matter; fix if it does.

---

## 7. Legacy `public/filebrowser.js` — strategic decision

**Current state:**
- 1,400 lines of vanilla JS class instantiated into a DOM node by `FileBrowser.jsx`
- Pre-Design-System palette (Lato, `#0095f6`, `#1f2937`)
- 3 known XSS holes (§1), 1 known logic bug, keyboard navigation broken, no `aria-label` on toolbar buttons
- Today's audio overlay (lines 602–713) IS Design-System-conformant and well-structured; the rest is legacy

**Option A — Patch and leave (12–16h):** Fix the 3 XSS, fix the `indexOf` bug, add `escapeHtml` to all dynamic `innerHTML` sites, add keyboard handlers to tree + file entries, convert toolbar `<div>`s to `<button aria-label="…">`, restyle to warm palette + DM Sans/Manrope, honor reduced-motion. Result: legacy but correct.

**Option B — Incremental Preact rewrite (30–50h, one weekend):** Extract the pure rendering pieces (tree, file list, breadcrumb, drag-drop math, audio player) into Preact components. Keep the backend-facing IO (upload, download, rename, delete) as a thin service. Use `useReducer` for the selection/path/drive state. Result: one less foreign subsystem, easier to evolve, gains all the Design System improvements naturally.

**Recommendation:** **A now, B as a scheduled follow-up.** The XSS holes are real enough that we shouldn't wait for a rewrite. But don't invest heavily polishing a file we'll rewrite.

**Observed in production (2026-04-18, post-hotfix):** tree entries occasionally render at inconsistent font sizes (one item noticeably larger than its siblings in the Music drive). Not investigated — decision is to address it in the rewrite rather than chase legacy CSS cascade issues. Rewrite must enforce one tree-item type style via a single class.

---

## 8. Craft / visual distinction — where the UI lacks a point of view

This section distills the `frontend-design` craft critique. Read it as direction, not prescription.

**The honest take:** This is a competent dashboard that could be any monitoring tool. The warm-stone palette is pleasant but not *owned*. There's no gesture that says "this is a Tesla owner's vehicle brain, not a generic Raspberry Pi status page." The Design System execution is disciplined but safe.

### The one thing
> Add a 2–3px accent-blue (`#2563eb`) left spine to the `.app-main` container, used consistently as a vehicle-instrument-panel metaphor. Then pair it with (a) staggered card entrance on first load, (b) a visibly-alive status dot pulse, (c) an inset shadow on the storage bar so it reads as a physical fuel gauge rather than a flat Tailwind chart.

### Supporting moves (pick 3–5)

1. **Typography hierarchy with conviction.** Current KPI values at 20px feel undersized. Reserve Manrope 700 @ 28–32px for hero metrics (storage %, sync state headline). Push section labels to 11px uppercase with +0.04em tracking. Everything else stays 13–14px body. Minimalism done right uses *more* typographic effort on the few places that matter.
2. **Tabular figures everywhere data moves.** Storage counters, sync %, version string, uptime — all should use `font-variant-numeric: tabular-nums`. JetBrains Mono only for actual code/version/cron/ID strings. Today's Design System calls this out but it isn't enforced.
3. **Living status indicator.** Current `.sync-status-dot.archiving` fades opacity 0.5→1. Make it *felt*: add a pulsing 2–3px warm-blue glow (`box-shadow: 0 0 6px rgba(37,99,235,.55)`) that breathes in sync with the opacity. A Tesla owner's brain reads pulsing lights as "alive."
4. **First-load orchestration.** Dashboard cards currently pop in simultaneously. Stagger them bottom-left → top-right over 400ms with `animation-delay: calc(var(--i) * 50ms)`. The layout *reveals* itself. Respects reduced-motion gracefully (no stagger, straight fade).
5. **Data-update micro-flash.** When storage % or sync progress updates, a 0.5s opacity tick on the affected numeric registers the change. Today numbers just swap silently.
6. **Warm shadow pair.** Current shadow scale is `rgba(28,25,23, …)`. Add a second warm-tone layer to each stop:
   ```css
   --shadow-sm: 0 1px 2px rgba(28,25,23,.04), 0 1px 2px rgba(183,140,109,.03);
   ```
   Invisible individually; aggregate effect is "less sterile, more physical."
7. **Storage bar as a gauge.** Single change: add `box-shadow: inset 0 2px 4px rgba(28,25,23,.08);` to the bar track. Reads as recessed rather than flat. Echoes a physical instrument without flashy gradients.
8. **Video grid camera boundaries.** In VideoViewer, give each camera cell a 1px `#44403c` border and a 2px grid gap. Reads as discrete camera feeds, not a single video collage. Matches Tesla's own in-car dashcam UI language.

### Anti-patterns to call out
- `.app-status` badges use 2018-era pill shape (`border-radius: 999px`). Consider a more modern 6–8px dot + text, or commit to the pill and make it *larger* and louder.
- Three-section sidebar (System / Network / Snapshots) is the template pattern every admin tool uses. Not broken, but not distinctive. Adding a subtle `background: var(--bg-subtle)` to the most important section (System) would create hierarchy without color.
- Feature badges are text-only. Add icons to each (dashcam camera, music note, lightshow ray) — scans faster, feels less templated.

---

## 9. Open strategic decisions (want input before executing)

1. **Tailwind migration** — Design System assumes Tailwind + `@theme`. Project has hand-written CSS. Migrating is 1–2 days of work. Keep hand-written? Migrate now? Migrate incrementally (new components Tailwind, existing stays)?
2. **Legacy filebrowser** — Option A (patch) or Option B (Preact rewrite)? §7.
3. **Polling strategy** — Stay with coalesced polling, or commit to SSE/WebSocket? SSE is simpler for this use case; WebSocket only if we need bidirectional.
4. ~~**Sibling tree**~~ ✅ RESOLVED 2026-04-18 — `teslausb/` working copy switched to `origin/main-dev` (no React embedded), stale `teslausb/teslausb-www-react/` directory removed. The standalone repo at `teslausb-www-react/` is the sole source of truth. Historical branch `add-react-ui-embedded` is kept on `oaquique/teslausb` for reference but is no longer checked out.
5. **Testing infrastructure** — Currently zero. Vitest + Preact Testing Library is lightweight and would immediately catch regressions in `parseSyncStatus`. Worth 4–6h setup?
6. **Tooling** — No ESLint, no Prettier, no JSDoc/TypeScript. Each would have caught real bugs in this audit. Which (if any) to add?

---

## 10. Suggested execution plan

### Day 1 (today/tomorrow) — P0 fix pack (4–6h)
- Escape HTML in 3 filebrowser XSS sites
- Fix `!== 1` → `!== -1` logic bug
- Fix `listDirectory` query string
- Add universal `:focus-visible` rule
- Pair status colors with icons + text labels
- Add Escape-key handler + focus-trap to audio overlay
- Convert filebrowser toolbar to `<button aria-label="…">`
- Remove `user-scalable=no`

### Day 2 — Design System font + palette pass (4–6h)
- Fix `index.html` Google Fonts import (add Manrope, keep DM Sans, add JetBrains Mono)
- Fix `index.css` `--font-heading` and `--font-body` vars
- Sweep inline styles → CSS class/var across VideoViewer, LogViewer, FileBrowser empty/loading states
- Replace `filebrowser.css` `#0095f6`/`#1f2937`/Lato uses

### Day 3 — a11y + responsive pass (4–6h)
- `aria-label` on all icon buttons (30m sweep)
- Global `prefers-reduced-motion` safety net
- Mobile `.info-value` truncation + font bump
- Touch target min-height 44px in `@media (pointer: coarse)`
- Semantic HTML wrappers (`<header>` `<main>` `<aside>` `<h2>`)

### Day 4 — Perf: coalesce polling (3–5h) ✅ SHIPPED 2026-04-18
- Backend: new `/cgi-bin/snapshot.sh` merges status + config + storage + music_sync + cam_sync into one response
- Frontend: `src/services/eventStream.js` singleton polls snapshot.sh every 3s; `useStatus`, `useMusicSyncProgress`, `useCamSyncProgress` all subscribe to it
- Client CGI request rate dropped ~50% (48–60 req/min → 22–32 req/min measured from nginx access.log)
- **SSE was attempted but abandoned**: fcgiwrap (the FastCGI gateway) buffers ~8 KB before flushing to nginx and doesn't support true streaming. True SSE would require replacing fcgiwrap with a streaming-capable FastCGI daemon (e.g. a small Go/Python server nginx proxies to). Not worth the backend rearchitecture for the marginal additional win over merged polling. Note left in `cgi-bin/snapshot.sh` and `src/services/eventStream.js` for future reference.

### Day 5 — Craft polish (3–5h)
- Accent-blue spine on `.app-main`
- Staggered card entrance
- Storage bar inset shadow
- Status dot living pulse
- Typography hierarchy (Manrope hero metrics at 28–32px)
- Data-update micro-flash

### Later sprint — Modernization
- SSE replaces polling
- Preact rewrite of filebrowser (Option B from §7)
- Error boundaries + Vitest setup
- Route state persistence / URL routing
- Virtualized log viewer

### P2/P3 nice-to-haves — closed 2026-04-18

Each item evaluated against the actual user need; decided either
"implemented" or "deliberately not implemented" with rationale so this
never gets re-flagged as tech debt.

- **Skip links** — ✅ **implemented**. Standard WCAG keyboard-a11y
  pattern. First focusable element on the page, hidden off-screen
  until keyboard focus reveals it.
- **Request coalescing via ETag / `If-Modified-Since` on `snapshot.sh`**
  — ✅ **deliberately not implemented.** Every field in the merged
  snapshot changes per poll (uptime ticks every second, CPU temp
  fluctuates, sync bytes transferred). An ETag would essentially never
  match, so `304 Not Modified` would essentially never fire — no
  bandwidth saved. The only way ETag would help is splitting the
  endpoint into rarely-changing (config, hardware) vs always-changing
  (live status), but that undoes the 1-request-per-poll merged-snapshot
  win. Revisit only if the payload becomes genuinely large *and*
  partially-static.
- **Chart accessibility** — ✅ **N/A.** The UI has no data-visualization
  charts. The storage bar is a proportion indicator, already accessible
  via `role="img"` + descriptive `aria-label` (added in the a11y pass).
- **Service worker / offline mode** — ✅ **deliberately not
  implemented.** The UI is a control surface for a device reached over
  network; when the network is gone the user has no actionable task —
  caching stale UI chrome with 2-hour-old sync status doesn't help
  anything. The existing "Reconnecting" connection-state chip on the
  topbar already handles transient WiFi drops. Service-worker
  maintenance overhead (cache busting per deploy, testing matrix,
  debugging stale bundles in the wild) isn't worth the marginal win.
  Revisit only if a concrete offline use case emerges.
- **`aria-live` on toast container** — ⏳ pending. Will land with the
  toast system for long-running ops (reboot / speed test / BLE pair).

### Legacy CSS-var alias deprecation (§X — planned for next pass)

After the Tailwind `@theme` migration, `:root` was reduced to thin
aliases of the `@theme` tokens (2026-04-18). The alias layer prevents
drift but adds indirection and duplicates the "surface area" of names.
Final cleanup: migrate every consumer from the legacy name to the
`@theme` name, then delete the aliases.

**Status: aliases in place, consumers unmigrated.** ~260 `var(--*)`
references across `src/styles/index.css` still use legacy names.

**Migration waves** (execute one family per PR, VR after each):

| Wave | Legacy alias → `@theme` target | Consumer count |
|---|---|---|
| 1 | `--bg-page → --color-page` | 4 |
| 1 | `--bg-card → --color-card` | 12 |
| 1 | `--bg-subtle → --color-subtle` | 10 |
| 1 | `--bg-muted → --color-muted` | 7 |
| 2 | `--border-default → --color-border` | 25 |
| 2 | `--border-subtle → --color-border-subtle` | 7 |
| 2 | `--border-strong → --color-border-strong` | 4 |
| 3 | `--text-primary → --color-ink` | 3 |
| 3 | `--text-heading → --color-heading` | 14 |
| 3 | `--text-body → --color-body` | 11 |
| 3 | `--text-secondary → --color-secondary` | 26 |
| 3 | `--text-tertiary → --color-tertiary` | 10 |
| 4 | `--accent → --color-accent` | 19 |
| 4 | `--accent-hover → --color-accent-hover` | 10 |
| 4 | `--accent-active → --color-accent-active` | 2 |
| 4 | `--accent-subtle → --color-accent-subtle` | 4 |
| 5 | `--success → --color-success` (+ -bg, -border) | 15 |
| 5 | `--danger → --color-danger` (+ -bg, -border) | 23 |
| 5 | `--warning → --color-warning` (+ -bg, -border) | 6 |
| 6 | `--font-body → --font-sans` | 10 |
| 6 | `--font-heading → --font-display` | 15 |

Approach per wave:
1. `sed -i '' 's/var(--bg-page)/var(--color-page)/g' src/styles/index.css` (or a safer bounded edit via the Edit tool)
2. `npm run build && npm run visual` — expect zero diff (names change, values identical)
3. Remove the alias line from `:root`
4. Rerun `visual` — still zero diff (no consumers left to care)

**Kept long-term (no migration target):**
- `--space-1 … --space-10` — explicit named steps are easier to grep than Tailwind arithmetic
- `--radius-pill: 999px` — no `@theme` pill token
- `--success-dark`, `--danger-dark`, `--warning-dark` — dark variants on tinted bg
- `--topbar-*`, `--storage-*` — domain-specific

**When to run this:** after the VideoViewer migration and filebrowser
rewrite, so we're not migrating consumers in files we're about to
replace anyway. Estimated total: 4–6h of focused work across 6 waves.

Not a functional change — it's structural hygiene. Final state: `:root`
is about 1/3 its current size, and `@theme` is unambiguously the single
source of design-system truth.

---

## Appendix — Scope and method

Six parallel audits were run against the codebase:

1. **Design System Conformance (React)** — color/spacing/font/radius/shadow drift across `src/`
2. **Legacy filebrowser audit** — XSS, a11y, palette drift, modernization paths
3. **Accessibility + responsive** — WCAG AA, keyboard, focus, breakpoints, semantic HTML
4. **Bugs / perf / code quality** — race conditions, leaks, stale closures, polling cost
5. **`ui-ux-pro-max` review** — 9-category priority framework (a11y, touch, perf, layout, typography, animation, forms, nav, data)
6. **`frontend-design` craft critique** — point of view, typography craft, memorable details, spatial composition, motion choreography, atmosphere, product identity

Each audit was given the file paths in scope, the authoritative Design System from `~/.claude/CLAUDE.md`, and a word cap to prevent enumerate-everything reports. Findings were deduplicated and prioritized.

Reports are not reproduced in full here; this document is the synthesized, actionable view.
