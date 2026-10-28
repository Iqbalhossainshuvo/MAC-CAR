import { confirm, removeRow, saveRow, saveUser, type FleetData, type Table } from '@/lib/data';
import {
  assignFields,
  carFields,
  docFields,
  editUserFields,
  expenseFields,
  incomeFields,
  newUserFields,
  profileFields,
} from '@/lib/forms';
import { today } from '@/lib/format';
import type { Assignment, Car, CarDocument, Expense, Income, Profile } from '@/lib/types';

import type { FormConfig } from './FormSheet';

type Open = (c: FormConfig | null) => void;
type Reload = () => void | Promise<void>;

const saver =
  (table: Table, reload: Reload, id?: string) =>
  async (v: Record<string, any>) => {
    const ok = await saveRow(table, id ? { ...v, id } : v);
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

export function editDoc(open: Open, reload: Reload, carId: string, doc?: CarDocument) {
  open({
    title: doc ? `Edit ${doc.doc_type}` : 'Add document',
    fields: docFields,
    initial: doc ?? { doc_type: 'Istimara' },
    onSubmit: async (v) => saver('car_documents', reload, doc?.id)({ ...v, car_id: carId }),
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
  if (!(await confirm(`Delete ${what}?`, 'This cannot be undone.'))) return;
  if (await removeRow(table, id)) await reload();
}
