/**
 * What survives a language switch. Switching changes the `[locale]` segment, so Next.js
 * remounts the page; the JavaScript context stays, so values handed over here are picked
 * up by the remounted components (scroll position, an unsent form with its files).
 */

const carriers = new Map<string, () => unknown>();
const carried = new Map<string, unknown>();

/** Registers a getter whose value is handed to the next mount after a language switch. */
export function registerCarry(key: string, get: () => unknown): () => void {
  carriers.set(key, get);
  return () => {
    if (carriers.get(key) === get) carriers.delete(key);
  };
}

/** Called by the language switcher just before it navigates. */
export function carryAll(extra: Record<string, unknown> = {}) {
  carried.clear();
  for (const [key, get] of carriers) carried.set(key, get());
  for (const [key, value] of Object.entries(extra)) carried.set(key, value);
}

/**
 * Reads a carried value. Safe in render: a render React throws away (as it may during the
 * switch's transition) leaves the value for the render that commits.
 */
export function peekCarried<T>(key: string): T | undefined {
  return carried.get(key) as T | undefined;
}

/** Forgets a carried value; call once the component that used it has committed. */
export function forgetCarried(key: string) {
  carried.delete(key);
}

/** Returns the carried value once, then forgets it. For effects, not render. */
export function takeCarried<T>(key: string): T | undefined {
  const value = peekCarried<T>(key);
  forgetCarried(key);
  return value;
}

export type ScrollAnchor = { id: string; offset: number };

/** The overview section on the reading line (a quarter down the viewport), and where it sits. */
export function currentScrollAnchor(): ScrollAnchor | null {
  const line = window.innerHeight / 4;
  const sections = document.querySelectorAll<HTMLElement>("main section[id]");
  for (const section of sections) {
    const { top, bottom } = section.getBoundingClientRect();
    if (top <= line && bottom > line) return { id: section.id, offset: top };
  }
  return null;
}

/** Puts the same section back at the same place after the page re-renders in another language. */
export function restoreScrollAnchor(anchor: ScrollAnchor) {
  const section = document.getElementById(anchor.id);
  if (!section) return;
  const top = section.getBoundingClientRect().top + window.scrollY - anchor.offset;
  window.scrollTo({ top, behavior: "instant" });
}
