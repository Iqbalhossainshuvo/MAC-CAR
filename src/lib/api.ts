import AsyncStorage from '@react-native-async-storage/async-storage';

/** MAC CAR's Google Apps Script web app (the admin's Google Sheet). */
const DEFAULT_API_URL =
  'https://script.google.com/macros/s/AKfycbwUJEgxN9vIfQm0vNt9IXlK0H7O3LD2_OfWtZoGVrz91SraEe2tOQNImC7XThP_gUFH/exec';

/** The Google Apps Script web app URL (ends with /exec). EXPO_PUBLIC_API_URL overrides the default. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL).trim();
/** OAuth Web client ID for "Sign in with Google" (optional). */
export const GOOGLE_CLIENT_ID = (process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '').trim();

export const isConfigured = /^https:\/\/script\.google(usercontent)?\.com\/.+/.test(API_URL);

const TOKEN_KEY = 'maccar.token';
let token: string | null = null;

export async function loadToken(): Promise<string | null> {
  token = await AsyncStorage.getItem(TOKEN_KEY);
  return token;
}

export async function setToken(t: string | null) {
  token = t;
  if (t) await AsyncStorage.setItem(TOKEN_KEY, t);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  /** true when the session is no longer valid and the user must sign in again */
  auth: boolean;
  constructor(message: string) {
    super(message);
    this.auth = /sign in|not active|session/i.test(message);
  }
}

let onAuthLost: (() => void) | null = null;
export function setOnAuthLost(fn: (() => void) | null) {
  onAuthLost = fn;
}

/**
 * Call the Apps Script backend. A text/plain POST avoids a CORS preflight,
 * which Apps Script cannot answer.
 */
export async function api<T = any>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!isConfigured) throw new ApiError('App is not connected to Google Sheets yet (EXPO_PUBLIC_API_URL missing).');
  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token, ...payload }),
      redirect: 'follow',
    });
  } catch {
    throw new ApiError('No internet connection, or the Google Sheets server could not be reached.');
  }
  const text = await res.text();
  let body: { ok: boolean; data?: T; error?: string };
  try {
    body = JSON.parse(text);
  } catch {
    throw new ApiError('Unexpected reply from the server. Check that the Apps Script is deployed with access "Anyone".');
  }
  if (!body.ok) {
    const err = new ApiError(body.error || 'Something went wrong');
    if (err.auth && token && action !== 'login' && action !== 'googleLogin') onAuthLost?.();
    throw err;
  }
  return body.data as T;
}
