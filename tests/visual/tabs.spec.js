// Visual regression baseline for the main tab surfaces.
// Run with:  npm run visual:update   (to capture/refresh baseline)
// Run with:  npm run visual           (to compare against baseline)
//
// Target is VR_BASE_URL (defaults to http://tusbm3b). Tests mask dynamic
// regions (timestamps, live counters) so real data drift doesn't fail runs.

import { test, expect } from '@playwright/test';

// Only the tabs whose content is deterministic across runs are baselined
// here. Viewer + Files are intentionally excluded until the filebrowser
// rewrite gives them stable, Preact-managed state — today the legacy
// filebrowser.js loads the tree async with no deterministic completion
// signal, and VideoViewer carries live playback state. Re-enable both
// by adding them to TABS after those rewrites.
//
// fullPage defaults to true but can be disabled per-tab for surfaces
// with large scrollable content where total page height varies run-to-run
// (e.g. the Logs tab — the log-viewer body extends to full content on
// mobile; a few lines rolling in/out shifts every pixel below the change
// point and crosses the diff ratio even with content masking).
const TABS = [
  { label: 'Dashboard', snap: 'dashboard', fullPage: true },
  { label: 'Logs', snap: 'logs', fullPage: false },
];

// CSS injected before each page load to pause animations + hide live data
// that would otherwise cause false diffs (clock ticks, sync % changing,
// uptime counter incrementing).
const STABILIZE_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
  }
  .app-last-update,
  .info-value[data-live],
  .sync-progress-bar,
  .sync-status-text,
  .storage-bar-fill {
    visibility: hidden !important;
  }
`;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Freeze Date so any "ago"-style labels render identically each run.
    const FIXED = new Date('2026-04-18T09:00:00-07:00').getTime();
    const OriginalDate = Date;
    // eslint-disable-next-line no-global-assign
    Date = class extends OriginalDate {
      constructor(...args) {
        if (args.length === 0) return new OriginalDate(FIXED);
        return new OriginalDate(...args);
      }
      static now() {
        return FIXED;
      }
    };
  });
});

for (const { label, snap, fullPage } of TABS) {
  test(`${snap} tab renders`, async ({ page }) => {
    await page.goto('/');
    await page.addStyleTag({ content: STABILIZE_CSS });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.getByRole('button', { name: label, exact: false }).first().click();
    // Give the tab a beat to settle layout after switching.
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot(`${snap}.png`, {
      fullPage,
      mask: [
        page.locator('.app-last-update'),
        page.locator('.sync-progress-bar'),
        page.locator('.storage-bar-fill'),
        // Live text that rolls between runs (log tail, uptime, CPU temp, signal).
        page.locator('.log-viewer-content'),
        page.locator('[data-live]'),
        // Mobile quick-status row carries 3 live dots with pulse animations —
        // mask the whole row to avoid mobile-375 flakiness.
        page.locator('.mobile-quick-status'),
      ],
    });
  });
}
