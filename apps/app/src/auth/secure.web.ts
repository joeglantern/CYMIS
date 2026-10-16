// On the web the refresh token is an httpOnly cookie the page cannot read.
// Nothing is stored here on purpose.
export const secureToken = {
  async get(): Promise<string | null> {
    return null;
  },
  async set(_token: string): Promise<void> {
    // Cookie is set by the server.
  },
  async clear(): Promise<void> {
    // Cookie is cleared by the server on sign out.
  },
};
