import { defineConfig } from '@playwright/test';

const BASE_URL = process.env.VR_BASE_URL || 'http://tusbm3b';

export default defineConfig({
  testDir: './tests/visual',
  snapshotPathTemplate: 'tests/visual/__snapshots__/{testFilePath}/{projectName}/{arg}{ext}',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  expect: {
    toHaveScreenshot: {
      // Tolerance tuned for live-data UI served from the Pi. Real visual
      // regressions (font/palette/layout shifts) produce 20k+ diff pixels;
      // animation micro-wobble and subpixel antialiasing produce <5k.
      // 0.5% of image = ~6k px on desktop, ~1.5k px on phone.
      maxDiffPixelRatio: 0.005,
      threshold: 0.2,
      animations: 'disabled',
      caret: 'hide',
    },
  },
  projects: [
    {
      name: 'phone-375',
      use: { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 },
    },
    {
      name: 'tablet-portrait-768',
      use: { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2 },
    },
    {
      name: 'tablet-landscape-1024',
      use: { viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2 },
    },
    {
      name: 'desktop-1440',
      use: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
    },
  ],
});
