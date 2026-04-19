import { Toast } from './Toast';
import { useToastState } from '../hooks/useToast';

/**
 * Root-level container for the toast stack. Renders `aria-live="polite"` on
 * itself so screen readers announce new toasts without stealing focus. Per
 * Design System rules we cap visible toasts at 3 — anything older falls off
 * the bottom.
 *
 * Positioning is fixed bottom-right with a 16px inset. The list is reversed
 * visually via flex-direction: column-reverse (see toasts.css) so newest
 * toasts appear on top while remaining first in DOM order (which is the
 * order screen readers will announce them).
 */

const MAX_VISIBLE = 3;

export function ToastContainer() {
  const { toasts, dismiss } = useToastState();
  const visible = toasts.slice(0, MAX_VISIBLE);

  return (
    <ol
      className="toast-container"
      aria-live="polite"
      aria-relevant="additions"
      aria-atomic="false"
    >
      {visible.map((t) => (
        <Toast
          key={t.id}
          id={t.id}
          variant={t.variant}
          message={t.message}
          onDismiss={dismiss}
        />
      ))}
    </ol>
  );
}

export default ToastContainer;
