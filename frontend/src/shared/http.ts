const API_PREFIX = '/api';
const TOKEN_KEY = 'secure-chat.token';

export const tokenStorage = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (token: string): void => localStorage.setItem(TOKEN_KEY, token),
  clear: (): void => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let unauthorizedHandler: (() => void) | null = null;

/** Called when the server rejects the stored token, e.g. because it expired. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: BodyInit;
  contentType?: string;
  /** Set to false for endpoints that must work without a session. */
  authenticated?: boolean;
}

async function send(path: string, options: RequestOptions = {}): Promise<Response> {
  const { method = 'GET', body, contentType, authenticated = true } = options;
  const headers = new Headers();
  if (contentType) headers.set('Content-Type', contentType);

  const token = authenticated ? tokenStorage.get() : null;
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_PREFIX}${path}`, { method, headers, body });
  if (response.ok) return response;

  if (response.status === 401 && token) unauthorizedHandler?.();
  throw new ApiError(response.status, await readErrorMessage(response));
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null && 'error' in body) {
      return String((body as { error: unknown }).error);
    }
  } catch {
    // The body was not JSON; fall through to the generic message.
  }
  return `Request failed (${response.status})`;
}

export async function getJson<T>(path: string): Promise<T> {
  return (await send(path)).json() as Promise<T>;
}

export async function postJson<T>(
  path: string,
  body: unknown,
  options: { authenticated?: boolean } = {},
): Promise<T> {
  const response = await send(path, {
    method: 'POST',
    body: JSON.stringify(body),
    contentType: 'application/json',
    authenticated: options.authenticated,
  });
  return response.json() as Promise<T>;
}

export async function getBytes(path: string): Promise<ArrayBuffer> {
  return (await send(path)).arrayBuffer();
}

export async function postBytes<T>(path: string, bytes: ArrayBuffer): Promise<T> {
  const response = await send(path, {
    method: 'POST',
    body: bytes,
    contentType: 'application/octet-stream',
  });
  return response.json() as Promise<T>;
}
