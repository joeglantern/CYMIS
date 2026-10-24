import { File } from 'expo-file-system';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

// A second way to read numbers, for builds without the phone's own text
// reader (Expo Go). A hidden browser view runs the same reader the web app
// uses. It loads the reader from the internet the first time, so it needs
// signal to start; with no signal the scanner falls back to typing.

const READER_VERSION = '7.0.0';

const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width">
<script src="https://cdn.jsdelivr.net/npm/tesseract.js@${READER_VERSION}/dist/tesseract.min.js"></script></head><body><script>
(async function () {
  const send = (m) => window.ReactNativeWebView.postMessage(JSON.stringify(m));
  try {
    const worker = await Tesseract.createWorker('eng');
    await worker.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ', tessedit_pageseg_mode: '11' });
    const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    const prep = (img, invert) => {
      const sx = img.width * 0.06, sy = img.height * 0.22, sw = img.width * 0.88, sh = img.height * 0.56;
      const k = Math.min(1, 1400 / sw);
      const c = document.createElement('canvas'); c.width = Math.round(sw * k); c.height = Math.round(sh * k);
      const x = c.getContext('2d'); x.filter = 'grayscale(1) contrast(1.6)' + (invert ? ' invert(1)' : '');
      x.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height); return c;
    };
    window.readFrame = async (id, data) => {
      try {
        const img = await load(data);
        const a = (await worker.recognize(prep(img, false))).data.text || '';
        let text = a;
        if (!/[A-Z]{3}[UJZ]\\s*\\d/.test(a.replace(/\\s+/g, ' '))) text += '\\n' + ((await worker.recognize(prep(img, true))).data.text || '');
        send({ id, text });
      } catch (e) { send({ id, text: '' }); }
    };
    send({ ready: true });
  } catch (e) { send({ failed: String(e) }); }
})();
</script></body></html>`;

type Pending = { resolve: (text: string | null) => void; timer: ReturnType<typeof setTimeout> };

/** What we call on the hidden browser view. */
type ReaderView = { injectJavaScript: (js: string) => void };
let view: ReaderView | null = null;
let ready = false;
let nextId = 1;
const pending = new Map<number, Pending>();
const listeners = new Set<() => void>();
const setReady = (v: boolean) => {
  ready = v;
  listeners.forEach((l) => l());
};

/** True once the hidden reader has loaded and can take frames. */
export function useWebReaderReady() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => ready,
  );
}

export const webReader = {
  async read(uri: string): Promise<string | null> {
    if (!ready || !view) return null;
    let b64: string;
    try {
      b64 = await new File(uri).base64();
    } catch {
      return null;
    }
    const id = nextId++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        resolve(null);
      }, 9000);
      pending.set(id, { resolve, timer });
      view?.injectJavaScript(`window.readFrame(${id}, ${JSON.stringify(`data:image/jpeg;base64,${b64}`)}); true;`);
    });
  },
};

/** Mount this (invisibly) on the scanner screen when the phone has no reader of its own. */
export function WebReader() {
  const ref = useRef<ReaderView>(null);

  useEffect(
    () => () => {
      view = null;
      setReady(false);
      pending.forEach((p) => {
        clearTimeout(p.timer);
        p.resolve(null);
      });
      pending.clear();
    },
    [],
  );

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: { ready?: boolean; failed?: string; id?: number; text?: string };
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.ready) {
      view = ref.current;
      setReady(true);
    } else if (msg.id !== undefined) {
      const p = pending.get(msg.id);
      if (p) {
        clearTimeout(p.timer);
        pending.delete(msg.id);
        p.resolve(msg.text ?? null);
      }
    }
  };

  return (
    <View pointerEvents="none" style={{ position: 'absolute', width: 1, height: 1, opacity: 0, left: -10, top: -10 }}>
      <WebView
        // The library types drop ref in v14, but the component still forwards it.
        {...({ ref } as object)}
        source={{ html, baseUrl: 'https://localhost' }}
        originWhitelist={['*']}
        javaScriptEnabled
        onMessage={onMessage}
        style={{ width: 1, height: 1 }}
      />
    </View>
  );
}
