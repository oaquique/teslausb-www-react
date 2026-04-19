/**
 * EmptyState — shared empty-state pattern for the TeslaUSB dashboard.
 *
 * Props:
 *   icon     — Icon component (from ./Icons) to render at ~32px
 *   title    — short headline (display font, 16px, weight 600)
 *   subtitle — supporting text (body font, 13–14px, secondary color)
 *   action   — optional child (usually a button or link)
 *   tone     — 'neutral' (default) or 'positive' for soft green gradient
 *   fill     — if true, expand to fill parent's flex space. Use inside
 *              a flex-column parent that otherwise leaves empty vertical
 *              space (e.g., VideoViewer, LogViewer content area).
 *
 * Centered both axes inside its container.
 */
export function EmptyState({ icon: Icon, title, subtitle, action, tone = 'neutral', fill = false }) {
  const toneClass = tone === 'positive' ? 'empty-state--positive' : 'empty-state--neutral';
  const iconToneClass = tone === 'positive' ? 'empty-state__icon--positive' : 'empty-state__icon--neutral';
  const fillClass = fill ? 'empty-state--fill' : '';

  return (
    <div className={`empty-state ${toneClass} ${fillClass}`} role="status">
      {Icon && (
        <div className={`empty-state__icon ${iconToneClass}`} aria-hidden="true">
          <Icon className="empty-state__icon-svg" />
        </div>
      )}
      {title && <p className="empty-state__title">{title}</p>}
      {subtitle && <p className="empty-state__subtitle">{subtitle}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}

export default EmptyState;
