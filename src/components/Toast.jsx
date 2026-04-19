import { useEffect, useState } from 'preact/hooks';
import {
  XIcon,
  InfoIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
} from './Icons';

/**
 * Single toast card. Renders a semantic icon, message, and close button.
 * The entrance animation is driven by a `mounted` class that flips on after
 * the first paint — this way the initial slide-up/fade transition actually
 * runs instead of being applied to the starting state.
 *
 * Visual spec comes from the "Toasts & Notifications" section of the Design
 * System: warm-neutral card, 3px left accent border (semantic), subtle shadow,
 * close button on the right. No per-toast aria-live — the container owns that.
 */

const VARIANT_META = {
  info: {
    Icon: InfoIcon,
    // Uses design tokens defined in @theme in src/styles/index.css.
    accent: 'var(--color-info)',
    iconColor: 'var(--color-info)',
    role: 'status',
  },
  success: {
    Icon: CheckCircleIcon,
    accent: 'var(--color-success)',
    iconColor: 'var(--color-success)',
    role: 'status',
  },
  warning: {
    Icon: AlertTriangleIcon,
    accent: 'var(--color-warning)',
    iconColor: 'var(--color-warning)',
    // Warnings get role=alert — they're sticky and the user needs to see them.
    role: 'alert',
  },
  danger: {
    Icon: AlertTriangleIcon,
    accent: 'var(--color-danger)',
    iconColor: 'var(--color-danger)',
    role: 'alert',
  },
};

export function Toast({ id, variant, message, onDismiss }) {
  const meta = VARIANT_META[variant] ?? VARIANT_META.info;
  const { Icon } = meta;

  // Two-phase mount: render once without `.toast--enter`, then flip to
  // enter on the next frame so the CSS transition runs from the initial
  // (translate/opacity 0) state to the mounted state.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <li
      className={`toast ${entered ? 'toast--enter' : ''}`}
      role={meta.role}
      data-variant={variant}
      style={{ borderLeft: `3px solid ${meta.accent}` }}
    >
      <span className="toast__icon" aria-hidden="true" style={{ color: meta.iconColor }}>
        <Icon />
      </span>
      <span className="toast__message">{message}</span>
      <button
        type="button"
        className="toast__close"
        onClick={() => onDismiss(id)}
        aria-label="Dismiss notification"
      >
        <XIcon />
      </button>
    </li>
  );
}

export default Toast;
