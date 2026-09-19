/** Gets browser storage without letting a blocked property getter stop startup. */
export function getLocalStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage ?? null;
  } catch {
    return null;
  }
}
