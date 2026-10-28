import { confirm, notify, removeRow, saveRow, saveUser, type FleetData, type Table } from '@/lib/data';
import {
  assignFields,
  carFields,
  docFields,
  driverDocFields,
  editUserFields,
  expenseFields,
  incomeFields,
  newUserFields,
  payFields,
  profileFields,
} from '@/lib/forms';
import { today } from '@/lib/format';
import { monthLabel, monthLastDay, PAY_LABEL, recentMonths } from '@/lib/payroll';
import type { Assignment, Car, CarDocument, Expense, Income, PayEntry, PayType, Profile } from '@/lib/types';

import type { FormConfig } from './FormSheet';

type Open = (c: FormConfig | null) => void;
type Reload = () => void | Promise<void>;

const saver =
  (table: Table, reload: Reload, id?: string) =>
  async (v: Record<string, any>) => {
    const { receipt, ...row } = v;
    const ok = await saveRow(table, id ? { ...row, id } : row, receipt ?? null);
    if (ok) await reload();
    return ok;
  };

export function editCar(open: Open, reload: Reload, car?: Car) {
  open({
    title: car ? `Edit ${car.plate_no}` : 'Add car',
    fields: carFields,
    initial: car ?? { status: 'active' },
    onSubmit: saver('cars', reload, car?.id),
  });
}

/** Add / edit a document of a car ({ carId }) or of a driver ({ driverId }). */
export function editDoc(open: Open, reload: Reload, owner: { carId?: string; driverId?: string }, doc?: CarDocument) {
  const forDriver = !!owner.driverId;
  open({
    title: doc ? `Edit ${doc.doc_type}` : forDriver ? 'Add driver document' : 'Add car document',
    fields: forDriver ? driverDocFields : docFields,
    initial: doc ?? { doc_type: forDriver ? 'Iqama' : 'Istimara' },
    footer: doc ? undefined : 'After saving, use “Upload file” or “Take photo” on the document to attach a scan.',
    onSubmit: async (v) =>
      saver('car_documents', reload, doc?.id)({ ...v, car_id: owner.carId ?? null, driver_id: owner.driverId ?? null }),
  });
}

export function editAssignment(open: Open, reload: Reload, d: FleetData, a?: Partial<Assignment>) {
  open({
    title: a?.id ? 'Edit driver assignment' : 'Assign driver to car',
    fields: assignFields(d.cars, d.profiles),
    initial: { start_date: today(), ...a },
    footer: 'Tip: when a driver changes car, end the old assignment (set "To date") and add a new one.',
    onSubmit: saver('assignments', reload, a?.id),
  });
}

export function editIncome(open: Open, reload: Reload, d: FleetData, i?: Partial<Income>) {
  open({
    title: i?.id ? 'Edit income' : 'Add income',
    fields: incomeFields(d.cars, d.profiles),
    initial: { income_date: today(), payment_status: 'paid', ...i },
    onSubmit: saver('incomes', reload, i?.id),
  });
}

export function editExpense(open: Open, reload: Reload, d: FleetData, e?: Partial<Expense>) {
  open({
    title: e?.id ? 'Edit expense' : 'Add expense',
    fields: expenseFields(d.cars, d.profiles),
    initial: { expense_date: today(), paid_by: 'company', status: 'approved', category: 'fuel', ...e },
    onSubmit: saver('expenses', reload, e?.id),
  });
}

export function newUser(open: Open, reload: Reload, role: 'driver' | 'admin' = 'driver') {
  open({
    title: role === 'driver' ? 'Add driver (login)' : 'Add user',
    fields: newUserFields,
    initial: { role },
    saveText: 'Create',
    onSubmit: async (v) => {
      const u = await saveUser(v);
      if (u) await reload();
      return !!u;
    },
  });
}

export function editUser(open: Open, reload: Reload, p: Profile) {
  open({
    title: `Edit ${p.full_name || p.username}`,
    fields: editUserFields,
    initial: p,
    onSubmit: async (v) => {
      const u = await saveUser({ ...v, id: p.id });
      if (u) await reload();
      return !!u;
    },
  });
}

export function editDriverProfile(open: Open, reload: Reload, p: Profile) {
  open({
    title: 'Driver details',
    fields: profileFields,
    initial: p,
    onSubmit: async (v) => {
      const u = await saveUser({ ...v, id: p.id });
      if (u) await reload();
      return !!u;
    },
  });
}

export function resetPassword(open: Open, p: Profile) {
  open({
    title: `New password · ${p.full_name || p.username}`,
    fields: [{ key: 'password', label: 'New password', type: 'password', required: true, hint: 'At least 6 characters.' }],
    initial: {},
    saveText: 'Set',
    onSubmit: async (v) => !!(await saveUser({ id: p.id, password: v.password })),
  });
}

export async function deleteRow(table: Table, id: string, what: string, reload: Reload) {
  if (!(await confirm(`Delete ${what}?`, 'It will be hidden everywhere and moved to the Archive. It stays in your Google Sheet and can be restored.'))) return;
  if (await removeRow(table, id)) await reload();
}

/** Add or edit a salary-account entry (salary, advance, bonus, deduction, payment, refund). */
export function editPay(
  open: Open,
  reload: Reload,
  d: FleetData,
  driver: Profile,
  type: PayType,
  entry?: PayEntry,
  suggested?: number,
) {
  const months = recentMonths(14).map((m) => ({ value: m, label: monthLabel(m) }));
  const thisMonth = months[0].value;
  const taken = new Set(d.payroll.filter((p) => p.driver_id === driver.id && p.type === 'salary' && p.id !== entry?.id).map((p) => p.month));
  const freeMonth = months.find((m) => !taken.has(m.value))?.value ?? thisMonth;
  const base =
    type === 'salary'
      ? { month: freeMonth, amount: driver.monthly_salary ?? undefined, entry_date: monthLastDay(freeMonth) > today() ? today() : monthLastDay(freeMonth) }
      : { amount: suggested && suggested > 0 ? suggested : undefined, entry_date: today(), method: type === 'advance' || type === 'payment' ? 'cash' : undefined };
  open({
    title: `${entry ? 'Edit' : 'Add'} ${PAY_LABEL[type].toLowerCase()} · ${driver.full_name || driver.username}`,
    fields: payFields(type, months),
    initial: entry ?? base,
    saveText: entry ? 'Save' : 'Add',
    onSubmit: async (v) => {
      if (type === 'salary' && taken.has(v.month)) {
        notify('Already added', `Salary for ${monthLabel(v.month)} is already in ${driver.full_name || driver.username}'s account.`);
        return false;
      }
      return saver('payroll', reload, entry?.id)({ ...v, type, driver_id: driver.id });
    },
  });
}
