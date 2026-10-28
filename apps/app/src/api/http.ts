import Constants from 'expo-constants';
import { Platform } from 'react-native';

const fromConfig = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;

const configured = process.env.EXPO_PUBLIC_API_URL ?? fromConfig ?? 'http://localhost:4000';

/**
 * Base address of the API, without the version prefix. "same-origin" is for
 * a web build served next to the API, so the session cookie stays first party.
 */
export const API_URL = (
  configured === 'same-origin' && typeof window !== 'undefined' && window.location ? window.location.origin : configured
).replace(/\/$/, '');
export const API_BASE = `${API_URL}/api/v1`;
export const IS_WEB = Platform.OS === 'web';

/** Error from the API, with a message the person can read. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True when the request never reached the server. */
  get offline() {
    return this.status === 0;
  }
}

/** Plain language for errors that come back without a useful message. */
function friendly(status: number, code: string, message?: string): string {
  if (message && !/^(internal|bad request)/i.test(message)) return message;
  if (status === 0) return 'No connection to the server. Check your signal and try again.';
  if (status === 401) return code === 'session_revoked' ? 'This device was signed out. Sign in again.' : 'Your session ended. Sign in again.';
  if (status === 403) return 'You do not have access to this.';
  if (status === 404) return 'That could not be found. It may have been removed.';
  if (status === 409) return 'Someone changed this at the same time. Reload and try again.';
  if (status === 429) return 'Too many tries. Wait a minute and try again.';
  if (status >= 500) return 'The server had a problem. Try again in a moment.';
  return code === 'VALIDATION_ERROR' ? 'Some of the details are not right. Check them and try again.' : `The server turned this down (error ${status}). Try again, and tell your supervisor if it keeps happening.`;
}

export interface TokenSource {
  getAccessToken: () => string | null;
  /** Gets a fresh access token. Returns null if the session is over. */
  refresh: () => Promise<string | null>;
  onSessionEnded: () => void;
}

let tokens: TokenSource | null = null;

export function setTokenSource(source: TokenSource) {
  tokens = source;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Skip the bearer token, for sign in and refresh. */
  anonymous?: boolean;
  signal?: AbortSignal;
  /** Raw body, for file uploads. Sent as is. */
  form?: FormData;
  /** Give up after this long and treat it as no connection. */
  timeoutMs?: number;
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  const url = new URL(`${API_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function send(path: string, opts: RequestOptions, token: string | null): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token && !opts.anonymous) headers.Authorization = `Bearer ${token}`;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let signal = opts.signal;
  if (opts.timeoutMs && !signal) {
    const ctrl = new AbortController();
    timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
    signal = ctrl.signal;
  }
  try {
    return await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? (opts.body !== undefined || opts.form ? 'POST' : 'GET'),
      headers,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      // The web dashboard keeps its refresh token in an httpOnly cookie.
      credentials: IS_WEB ? 'include' : 'omit',
      signal,
    });
  } catch (err) {
    // Our own timeout counts as no connection; a caller's abort is passed on.
    if ((err as Error).name === 'AbortError' && !timer) throw err;
    throw new ApiError(0, 'NETWORK', friendly(0, 'NETWORK'));
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    const code = err?.code ?? `HTTP_${res.status}`;
    throw new ApiError(res.status, code, friendly(res.status, code, err?.message), err?.details);
  }
  return data as T;
}

/**
 * Call the API. Adds the access token, and on a 401 refreshes once and
 * retries, so screens never deal with expiry themselves.
 */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const token = opts.anonymous ? null : (tokens?.getAccessToken() ?? null);
  let res = await send(path, opts, token);

  if (res.status === 401 && !opts.anonymous && tokens) {
    const fresh = await tokens.refresh();
    if (!fresh) {
      tokens.onSessionEnded();
      return parse<T>(res);
    }
    res = await send(path, opts, fresh);
    if (res.status === 401) tokens.onSessionEnded();
  }
  return parse<T>(res);
}
