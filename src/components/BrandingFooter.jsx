/**
 * BrandingFooter — reusable herewhat product footer block.
 *
 * Visual pattern (matches JobCommand, NotaMarcata, LaliWeb and the
 * rest of the herewhat product family):
 *   1. descriptive line  — what this product is
 *   2. "by herewhat."    — optional authorship attribution + logomark
 *   3. v{version}        — monospace version number
 *
 * Designed to move verbatim into @herewhat/branding-footer once a
 * second React consumer imports it. Keep this file product-agnostic —
 * all strings flow through props; no host-app imports. The CSS lives
 * under `.sidebar-branding*` in the host app's stylesheet so it can
 * theme the border/color per light-or-dark sidebar.
 *
 * Props:
 *   description (string, required)
 *     One-line product description. When `credit=true` this is
 *     followed by the word "by" and the logomark, so write it as
 *     a noun phrase: "The React UI for TeslaUSB" — not a sentence.
 *   version (string, required)
 *     The running bundle's version, typically Vite-injected via
 *     __APP_VERSION__.
 *   credit? (boolean, default true)
 *     Toggle the "by [herewhat logo]" authorship attribution. Set
 *     to false for internal/unbranded deployments where product
 *     identity + version are enough.
 *   creditHref? (string, default https://digital.theherewhat.com)
 *     Destination for the logo link.
 *   creditLogoSrc? (string, default /herewhat-logo.png)
 *     Path to the logomark asset. Use /herewhat-logo.png on light
 *     sidebars and /herewhat-logo-white.png on dark sidebars.
 *   creditAlt? (string, default 'herewhat.')
 *     Alt text for the logomark.
 *
 * Design tokens consumed (must exist in :root):
 *   --space-4, --text-xs, --text-tertiary, --font-mono, --border-subtle
 *
 * Hugo/static-HTML counterpart should render the same structure so
 * the `.sidebar-branding*` CSS applies unchanged:
 *   <div class="sidebar-branding">
 *     <p>{description}{credit ? ' by' : ''}</p>
 *     [optional <p class="sidebar-branding-logo">…logo link…</p>]
 *     <p class="sidebar-branding-version">v{version}</p>
 *   </div>
 */
export function BrandingFooter({
  description,
  version,
  credit = true,
  creditHref = 'https://digital.theherewhat.com',
  creditLogoSrc = '/herewhat-logo.png',
  creditAlt = 'herewhat.',
}) {
  return (
    <div className="sidebar-branding">
      <p>
        {description}
        {credit ? ' by' : ''}
      </p>
      {credit && (
        <p className="sidebar-branding-logo">
          <a
            href={creditHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={creditAlt}
          >
            <img src={creditLogoSrc} alt={creditAlt} />
          </a>
        </p>
      )}
      <p className="sidebar-branding-version" aria-label={`Version ${version}`}>
        v{version}
      </p>
    </div>
  );
}

export default BrandingFooter;
