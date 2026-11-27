/** sessionStorage token handling: the token lives for the tab only. */
const TOKEN_KEY = "entrelacs.access-token";

export const session = {
  get(): string | null {
    try {
      return window.sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string): void {
    try {
      window.sessionStorage.setItem(TOKEN_KEY, token);
    } catch {
      // Storage unavailable (private mode): the session dies with the page.
    }
  },
  clear(): void {
    try {
      window.sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      // Ignore.
    }
  },
};
