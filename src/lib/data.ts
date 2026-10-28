import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { Alert, AppState, Platform } from 'react-native';

import { api, ApiError } from './api';
import { useAuth } from './auth';
import type { Assignment, Car, CarDocument, DailyLog, Expense, Income, Profile } from './types';

/*
 * Local-first data store
 * ----------------------
 * - The whole fleet (what this user may see) is kept in memory AND on the device,
 *   so the app opens instantly with the last known data.
 * - A fresh copy is fetched from Google Sheets in the background (at most every 30 s,
 *   or when the user pulls to refresh).
 * - Saves/deletes update the screen immediately ("optimistic") and go into an
 *   outbox that is sent to Google Sheets in the background, in order. If the phone
 *   is offline, the outbox waits and retries; it survives app restarts.
 */

export type Table = 'cars' | 'car_documents' | 'assignments' | 'incomes' | 'expenses' | 'daily_logs';

export interface FleetData {
  me: Profile | null;
  cars: Car[];
  profiles: Profile[];
  docs: CarDocument[];
  assignments: Assignment[];
  incomes: Income[];
  expenses: Expense[];
  logs: DailyLog[];
}

export const EMPTY_FLEET: FleetData = {
  me: null,
  cars: [],
  profiles: [],
  docs: [],
  assignments: [],
  incomes: [],
  expenses: [],
  logs: [],
};

type ListKey = Exclude<keyof FleetData, 'me'>;
const LIST_OF: Record<Table, ListKey> = {
  cars: 'cars',
  car_documents: 'docs',
  assignments: 'assignments',
  incomes: 'incomes',
  expenses: 'expenses',
  daily_logs: 'logs',
};

const byDesc = <T>(key: keyof T) => (a: T, b: T) => String(b[key] ?? '').localeCompare(String(a[key] ?? ''));

function sortFleet(d: FleetData): FleetData {
  return {
    ...d,
    cars: [...d.cars].sort((a, b) => String(a.plate_no).localeCompare(String(b.plate_no))),
    profiles: [...d.profiles].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '')),
    docs: [...d.docs].sort((a, b) => String(a.expiry_date ?? '9').localeCompare(String(b.expiry_date ?? '9'))),
    assignments: [...d.assignments].sort(byDesc<Assignment>('start_date')),
    incomes: [...d.incomes].sort(byDesc<Income>('income_date')),
    expenses: [...d.expenses].sort(byDesc<Expense>('expense_date')),
    logs: [...d.logs].sort(byDesc<DailyLog>('log_date')),
  };
}

/** One call returns everything this user is allowed to see. */
export async function loadFleet(): Promise<FleetData> {
  return sortFleet(await api<FleetData>('data'));
}

// ---------------------------------------------------------------- store state

type Op =
  | { opId: string; kind: 'save'; table: Table; row: Record<string, any>; tempId?: string }
  | { opId: string; kind: 'remove'; table: Table; id: string };

let state: FleetData = EMPTY_FLEET;
let userKey: string | null = null;
let hydrated = false; // true once we have cache or a first server answer
let lastSync = 0;
let syncing = false;
let manual = false;
let syncError: string | null = null;
let offline = false;
let outbox: Op[] = [];
let sending = false;
let version = 0; // bumps on every local change
const idMap = new Map<string, string>(); // temp id → real id
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());
const newId = () => `tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const cacheKey = () => `maccar.cache.${userKey}`;
const outboxKey = () => `maccar.outbox.${userKey}`;

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function persistSoon() {
  if (!userKey) return;
  if (persistTimer) clearTimeout(persistTimer);
  const key = userKey;
  persistTimer = setTimeout(() => {
    if (key !== userKey) return;
    AsyncStorage.setItem(cacheKey(), JSON.stringify(state)).catch(() => {});
    AsyncStorage.setItem(outboxKey(), JSON.stringify(outbox)).catch(() => {});
  }, 300);
}

function setState(next: FleetData, local = true) {
  state = next;
  if (local) version++;
  emit();
  persistSoon();
}

/** Load the device copy for this user, then refresh from the server. */
async function initStore(uid: string) {
  if (userKey === uid) return;
  userKey = uid;
  state = EMPTY_FLEET;
  hydrated = false;
  outbox = [];
  idMap.clear();
  lastSync = 0;
  emit();
  try {
    const [cached, box] = await Promise.all([AsyncStorage.getItem(cacheKey()), AsyncStorage.getItem(outboxKey())]);
    if (userKey !== uid) return;
    if (cached) {
      state = JSON.parse(cached);
      hydrated = true;
    }
    if (box) outbox = JSON.parse(box);
  } catch {
    // ignore broken cache
  }
  emit();
  sync(true);
}

/** Forget everything in memory (sign out). The device copy stays for that user. */
export function clearFleetCache() {
  userKey = null;
  state = EMPTY_FLEET;
  hydrated = false;
  outbox = [];
  idMap.clear();
  emit();
}

/** Fetch a fresh copy from Google Sheets. */
async function sync(force = false, byUser = false) {
  if (!userKey) return;
  if (syncing) return;
  if (!force && Date.now() - lastSync < 30_000) return;
  if (outbox.length) {
    // send our own changes first so the fresh copy includes them
    processOutbox();
    return;
  }
  syncing = true;
  manual = byUser;
  emit();
  const startVersion = version;
  const uid = userKey;
  try {
    const d = await loadFleet();
    if (uid !== userKey) return;
    lastSync = Date.now();
    syncError = null;
    offline = false;
    if (version === startVersion && outbox.length === 0) setState(d, false);
    else setTimeout(() => sync(true), 500); // local changes happened meanwhile — try again
  } catch (e: any) {
    syncError = e?.message ?? String(e);
    offline = !!(e as ApiError)?.network;
  } finally {
    hydrated = true;
    syncing = false;
    manual = false;
    emit();
  }
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSync(ms = 1500) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => sync(true), ms);
}

let retryTimer: ReturnType<typeof setTimeout> | null = null;

function mapIds<T>(v: T): T {
  if (typeof v === 'string') return (idMap.get(v) ?? v) as T;
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const out: Record<string, any> = {};
    for (const [k, x] of Object.entries(v)) out[k] = mapIds(x);
    return out as T;
  }
  return v;
}

/** Replace a temp id with the real one everywhere in the store. */
function swapId(tempId: string, realId: string) {
  const fix = <T extends Record<string, any>>(r: T): T => {
    let changed = false;
    const o: Record<string, any> = { ...r };
    for (const k of ['id', 'car_id', 'driver_id']) {
      if (o[k] === tempId) {
        o[k] = realId;
        changed = true;
      }
    }
    return (changed ? o : r) as T;
  };
  state = {
    ...state,
    cars: state.cars.map(fix),
    docs: state.docs.map(fix),
    assignments: state.assignments.map(fix),
    incomes: state.incomes.map(fix),
    expenses: state.expenses.map(fix),
    logs: state.logs.map(fix),
  };
}

async function processOutbox() {
  if (sending || !userKey || !outbox.length) return;
  sending = true;
  emit();
  let failed = false;
  try {
    while (outbox.length && userKey) {
      const op = mapIds(outbox[0]);
      try {
        if (op.kind === 'save') {
          const saved = await api<Record<string, any>>('save', { table: op.table, row: op.row });
          const key = LIST_OF[op.table];
          if (op.tempId) {
            idMap.set(op.tempId, saved.id);
            swapId(op.tempId, saved.id);
          }
          state = { ...state, [key]: (state[key] as any[]).map((r) => (r.id === saved.id ? { ...r, ...saved } : r)) };
        } else {
          await api('remove', { table: op.table, id: op.id });
        }
        outbox.shift();
        offline = false;
        syncError = null;
        emit();
        persistSoon();
      } catch (e: any) {
        const err = e as ApiError;
        if (err?.network) {
          // offline — keep the queue and retry later
          offline = true;
          failed = true;
          if (retryTimer) clearTimeout(retryTimer);
          retryTimer = setTimeout(processOutbox, 15_000);
          break;
        }
        if (err?.auth) {
          failed = true;
          break;
        }
        // the server refused this change: drop it, tell the user, reload real data
        outbox.shift();
        persistSoon();
        notify(op.kind === 'remove' ? 'Could not delete' : 'Could not save', `${err?.message ?? err}\n\nThe change was undone.`);
        lastSync = 0;
      }
    }
  } finally {
    sending = false;
    emit();
    if (!failed && !outbox.length) scheduleSync(1200);
  }
}

function enqueue(op: Op) {
  outbox.push(op);
  persistSoon();
  processOutbox();
}

// retry when the app comes back to the foreground / browser comes online
AppState.addEventListener('change', (s) => {
  if (s === 'active') {
    processOutbox();
    sync(false);
  }
});
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    processOutbox();
    sync(true);
  });
}

// ---------------------------------------------------------------- hooks

export function useSyncStatus() {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    listeners.add(force);
    return () => {
      listeners.delete(force);
    };
  }, []);
  return { pending: outbox.length, sending, syncing, offline, error: syncError };
}

export function useFleet() {
  const { user } = useAuth();
  const [, force] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    listeners.add(force);
    return () => {
      listeners.delete(force);
    };
  }, []);

  useEffect(() => {
    if (user?.id) initStore(user.id);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      sync(false);
    }, []),
  );

  const data = state;
  const lookups = useMemo(() => {
    const carById = new Map(data.cars.map((c) => [c.id, c]));
    const personById = new Map(data.profiles.map((p) => [p.id, p]));
    // links opened with a temporary id keep working after the real id arrives
    for (const [tmp, real] of idMap) {
      if (carById.has(real)) carById.set(tmp, carById.get(real)!);
    }
    return { carById, personById };
  }, [data]);

  return {
    data,
    /** spinner for pull-to-refresh */
    loading: syncing && manual,
    error: hydrated && !data.cars.length && !data.profiles.length ? syncError : null,
    /** Ask for a fresh copy (non-blocking). */
    reload: async () => {
      sync(true, true);
    },
    firstLoad: !hydrated,
    ...lookups,
  };
}

// ---------------------------------------------------------------- mutations (instant)

function defaults(table: Table, row: Record<string, any>): Record<string, any> {
  const me = state.me;
  const now = new Date().toISOString();
  const base: Record<string, any> = { created_at: now };
  if (me && me.role !== 'admin' && (table === 'expenses' || table === 'daily_logs')) {
    base.driver_id = me.id;
    if (table === 'expenses') base.status = 'pending';
  }
  const car = row.car_id ? state.cars.find((c) => c.id === row.car_id) : null;
  if (car) base.car_plate = car.plate_no;
  return base;
}

/** Insert (no id) or update (with id) a row. The screen updates at once; Google Sheets is updated in the background. */
export async function saveRow(table: Table, row: Record<string, any>): Promise<boolean> {
  const key = LIST_OF[table];
  const list = state[key] as any[];
  if (row.id) {
    const id = idMap.get(row.id) ?? row.id;
    setState(sortFleet({ ...state, [key]: list.map((r) => (r.id === id ? { ...r, ...row, id } : r)) }));
    enqueue({ opId: newId(), kind: 'save', table, row: { ...row, id } });
  } else {
    const tempId = newId();
    // Admin values win over defaults; for drivers the server-enforced values (own id, pending) win.
    const local = state.me?.role === 'admin' ? { ...defaults(table, row), ...row, id: tempId } : { ...row, ...defaults(table, row), id: tempId };
    setState(sortFleet({ ...state, [key]: [local, ...list] }));
    enqueue({ opId: newId(), kind: 'save', table, row, tempId });
  }
  return true;
}

export async function removeRow(table: Table, id: string): Promise<boolean> {
  const real = idMap.get(id) ?? id;
  const key = LIST_OF[table];
  let next: FleetData = { ...state, [key]: (state[key] as any[]).filter((r) => r.id !== real) };
  if (table === 'cars') {
    // documents, driver history and daily reports of the car go with it
    next = {
      ...next,
      docs: next.docs.filter((d) => d.car_id !== real),
      assignments: next.assignments.filter((a) => a.car_id !== real),
      logs: next.logs.filter((l) => l.car_id !== real),
    };
  }
  setState(next);
  enqueue({ opId: newId(), kind: 'remove', table, id: real });
  return true;
}

/** Put a row that the server already saved into the local store (no sync needed). */
export function putLocal(table: Table, row: Record<string, any>) {
  const key = LIST_OF[table];
  const list = state[key] as any[];
  const exists = list.some((r) => r.id === row.id);
  setState(sortFleet({ ...state, [key]: exists ? list.map((r) => (r.id === row.id ? { ...r, ...row } : r)) : [row, ...list] }), false);
}

/** Has this row reached Google Sheets yet? (files can only be attached after that) */
export function isSynced(id: string) {
  return !id.startsWith('tmp-') || idMap.has(id);
}

export function realId(id: string) {
  return idMap.get(id) ?? id;
}

/** Users need the server (password hashing, unique usernames), so this one waits. */
export async function saveUser(user: Record<string, any>): Promise<Profile | null> {
  try {
    const saved = await api<Profile>('saveUser', { user });
    const exists = state.profiles.some((p) => p.id === saved.id);
    setState(
      sortFleet({
        ...state,
        profiles: exists ? state.profiles.map((p) => (p.id === saved.id ? { ...p, ...saved } : p)) : [...state.profiles, saved],
        me: state.me?.id === saved.id ? { ...state.me, ...saved } : state.me,
      }),
    );
    return saved;
  } catch (e: any) {
    notify('Could not save user', e?.message);
    return null;
  }
}

export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

export function confirm(title: string, message: string, okText = 'Delete'): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: okText, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
