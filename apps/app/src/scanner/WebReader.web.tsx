// The browser build reads frames directly (see ocr.web.ts), so there is no
// hidden reader to mount here.
export function useWebReaderReady() {
  return true;
}

export const webReader = {
  async read(_uri: string): Promise<string | null> {
    return null;
  },
};

export function WebReader() {
  return null;
}
