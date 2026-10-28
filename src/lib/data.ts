import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { api } from './api';
import type { Assignment, Car, CarDocument, DailyLog, Expense, Income, Profile } from './types';

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

const byDesc = <T>(key: keyof T) => (a: T, b: T) => String(b[key] ?? '').localeCompare(String(a[key] ?? ''));

/** One call returns everything this user is allowed to see. */
export async function loadFleet(): Promise<FleetData> {
  const d = await api<FleetData>('data');
  return {
    ...d,
    cars: [...d.cars].sort((a, b) => a.plate_no.localeCompare(b.plate_no)),
    profiles: [...d.profiles].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '')),
    docs: [...d.docs].sort((a, b) => String(a.expiry_date ?? '9').localeCompare(String(b.expiry_date ?? '9'))),
    assignments: [...d.assignments].sort(byDesc<Assignment>('start_date')),
    incomes: [...d.incomes].sort(byDesc<Income>('income_date')),
    expenses: [...d.expenses].sort(byDesc<Expense>('expense_date')),
    logs: [...d.logs].sort(byDesc<DailyLog>('log_date')),
  };
}

// Cache so switching screens is instant; every screen refreshes in the background on focus.
let cache: FleetData | null = null;

export function useFleet() {
  const [data, setData] = useState<FleetData>(cache ?? EMPTY_FLEET);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const reload = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const d = await loadFleet();
      cache = d;
      setData(d);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const lookups = useMemo(() => {
    const carById = new Map(data.cars.map((c) => [c.id, c]));
    const personById = new Map(data.profiles.map((p) => [p.id, p]));
    return { carById, personById };
  }, [data]);

  return { data, loading, error, reload, ...lookups, firstLoad: loading && !cache };
}

export function clearFleetCache() {
  cache = null;
}

/** Insert (no id) or update (with id) a row. Shows an alert on error. */
export async function saveRow(table: Table, row: Record<string, any>): Promise<boolean> {
  try {
    await api('save', { table, row });
    return true;
  } catch (e: any) {
    notify('Could not save', e?.message);
    return false;
  }
}

export async function removeRow(table: Table, id: string): Promise<boolean> {
  try {
    await api('remove', { table, id });
    return true;
  } catch (e: any) {
    notify('Could not delete', e?.message);
    return false;
  }
}

export async function saveUser(user: Record<string, any>): Promise<Profile | null> {
  try {
    return await api<Profile>('saveUser', { user });
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
