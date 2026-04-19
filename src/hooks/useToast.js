import { createContext, h } from 'preact';
import { useCallback, useContext, useMemo, useRef, useState } from 'preact/hooks';

/**
 * Toast notification system — Preact context + provider + consumer hook.
 *
 * Surfaces four semantic variants (info / success / warning / danger) plus a
 * `dismiss(id)` escape hatch. The provider owns the toast queue and exposes
 * stable callbacks; the container subscribes via `useToastState()` and is
 * responsible for rendering. The split keeps Toast rendering logic out of
 * this file so hook-only consumers don't pull in JSX they don't need.
 *
 * Design System rules enforced here:
 *   - Default auto-dismiss 4s.
 *   - `warning` and `danger` never auto-dismiss (user dismisses).
 *   - Newest toast is prepended so the stack reads newest-on-top bottom-right.
 *   - Max 3 visible is enforced by the container, not here — we keep the
 *     queue whole so overflow can be handled there if we ever want to.
 */

const DEFAULT_DURATION_MS = 4000;

// Variants that the user must dismiss manually. Errors and warnings linger
// because auto-dismissing a failure message loses information the user needs.
const STICKY_VARIANTS = new Set(['warning', 'danger']);

const ToastContext = createContext(null);

let nextId = 1;
const makeId = () => `toast-${nextId++}`;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  // Track dismiss timers so we can clear them if a toast is dismissed early
  // (prevents a late timer from trying to remove an already-gone toast).
  const timersRef = useRef(new Map());

  const clearTimer = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const dismiss = useCallback(
    (id) => {
      clearTimer(id);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    },
    [clearTimer]
  );

  const show = useCallback(
    (variant, message, options = {}) => {
      const id = options.id ?? makeId();
      const sticky = STICKY_VARIANTS.has(variant);
      // Explicit `duration: null` or `0` also means sticky; otherwise fall
      // back to the variant default.
      const duration =
        options.duration === null || options.duration === 0
          ? null
          : (options.duration ?? (sticky ? null : DEFAULT_DURATION_MS));

      setToasts((prev) => {
        // Dedupe by id: if a toast with this id already exists, replace it
        // in place. Callers use this to upgrade "Running…" → "Done" without
        // the user seeing two toasts briefly stacked.
        const existingIdx = prev.findIndex((t) => t.id === id);
        const next = { id, variant, message, createdAt: Date.now() };
        if (existingIdx >= 0) {
          const copy = prev.slice();
          copy[existingIdx] = next;
          return copy;
        }
        // Newest on top → prepend.
        return [next, ...prev];
      });

      // Reset any existing timer for this id before scheduling a new one.
      clearTimer(id);
      if (duration != null) {
        const timer = setTimeout(() => dismiss(id), duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [clearTimer, dismiss]
  );

  // Stable variant helpers — memoized so consumers don't re-render from
  // identity churn on every provider render.
  const api = useMemo(
    () => ({
      info: (message, options) => show('info', message, options),
      success: (message, options) => show('success', message, options),
      warning: (message, options) => show('warning', message, options),
      danger: (message, options) => show('danger', message, options),
      dismiss,
    }),
    [show, dismiss]
  );

  const value = useMemo(() => ({ toasts, api }), [toasts, api]);

  return h(ToastContext.Provider, { value }, children);
}

/**
 * Consumer hook for publishers of toasts. Returns only the publish API —
 * doesn't subscribe to the toast list, so components using this don't
 * re-render when toasts come and go.
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast() must be used inside a <ToastProvider>');
  }
  return ctx.api;
}

/**
 * Internal hook used by <ToastContainer /> to read the live toast list.
 * Kept separate from useToast() so publisher components don't subscribe
 * to queue changes they don't care about.
 */
export function useToastState() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToastState() must be used inside a <ToastProvider>');
  }
  return { toasts: ctx.toasts, dismiss: ctx.api.dismiss };
}
