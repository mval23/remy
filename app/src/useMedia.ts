import { useSyncExternalStore } from 'react';

/** Wide enough for two columns: an iPad held sideways, or a computer. Matches tablet.css. */
export const WIDE = '(min-width: 1000px)';

/** Whether a CSS media query matches right now; re-renders when it changes (for example, when the iPad is turned). */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const m = window.matchMedia(query);
      m.addEventListener('change', onChange);
      return () => m.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
