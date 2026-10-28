import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Logins remembered on this device so the user can sign in with one tap.
 * Phone: stored in the iOS Keychain / Android Keystore (expo-secure-store).
 * Web: stored in this browser's local storage.
 */
export interface SavedLogin {
  username: string;
  password: string;
  name?: string;
  savedAt: number;
}

const KEY = 'maccar.savedLogins';
const MAX = 5;

async function read(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return window.localStorage.getItem(KEY);
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

async function write(v: string) {
  try {
    if (Platform.OS === 'web') window.localStorage.setItem(KEY, v);
    else await SecureStore.setItemAsync(KEY, v);
  } catch {
    // storage unavailable (private mode) — just don't remember
  }
}

export async function getSavedLogins(): Promise<SavedLogin[]> {
  const raw = await read();
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as SavedLogin[];
    return Array.isArray(list) ? list.sort((a, b) => b.savedAt - a.savedAt) : [];
  } catch {
    return [];
  }
}

export async function saveLogin(username: string, password: string, name?: string) {
  const key = username.trim().toLowerCase();
  const list = (await getSavedLogins()).filter((s) => s.username !== key);
  list.unshift({ username: key, password, name, savedAt: Date.now() });
  await write(JSON.stringify(list.slice(0, MAX)));
}

export async function forgetLogin(username: string) {
  const list = (await getSavedLogins()).filter((s) => s.username !== username);
  await write(JSON.stringify(list));
}
