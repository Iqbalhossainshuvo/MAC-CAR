import { confirm, currentMe, notify, removeRow, saveRow, saveUser, type FleetData, type Table } from '@/lib/data';
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
  SALARY_KEYS,
} from '@/lib/forms';
import { today } from '@/lib/format';
import { can } from '@/lib/perms';
import { CASH_LABEL, monthLabel, monthLastDay, PAY_LABEL, recentMonths, salaryPartsText } from '@/lib/payroll';
import type { Assignment, Car, CarDocument, CarShare, CashEntry, Expense, Income, PartnerEntry, PayEntry, PayType, Profile } from '@/lib/types';

import type { FieldDef, FormConfig } from './FormSheet';

/** A manager (not admin) only manages driver logins: no role / permissions, salary only with salary:edit. */
function userFieldsForMe(fields: FieldDef[]): FieldDef[] {
  const me = currentMe();
  if (!me || me.role === 'admin') return fields;
  return fields
    .filter((f) => f.key !== 'role' && f.key !== 'permissions')
    .filter((f) => !SALARY_KEYS.includes(f.key) || can(me, 'salary', 'edit'))
    .map((f) => (SALARY_KEYS.includes(f.key) ? { ...f, showIf: undefined } : f));
}

/** Older drivers only have a single monthly salary: show it as the basic salary. */
function withSalaryParts(p: Profile): Record<string, any> {
  const hasParts = SALARY_KEYS.some((k) => (p as any)[k] != null);
  return hasParts || p.monthly_salary == null ? p : { ...p, basic_salary: p.monthly_salary };
}

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
    initial: car ? { ...car, ownership: car.ownership ?? 'own' } : { status: 'active', ownership: 'own' },
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
    // a manager who cannot approve does not get the Status field (new entries wait for approval)
    fields: can(currentMe(), 'approve') ? expenseFields(d.cars, d.profiles) : expenseFields(d.cars, d.profiles).filter((f) => f.key !== 'status'),
    initial: { expense_date: today(), paid_by: 'company', status: can(currentMe(), 'approve') ? 'approved' : 'pending', category: 'fuel', ...e },
    onSubmit: saver('expenses', reload, e?.id),
  });
}

export function newUser(open: Open, reload: Reload, role: 'driver' | 'manager' | 'admin' | 'partner' = 'driver', title?: string) {
  open({
    title: title ?? (role === 'driver' ? 'Add driver (login)' : 'Add user'),
    fields: userFieldsForMe(newUserFields),
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
    fields: userFieldsForMe(editUserFields),
    initial: withSalaryParts(p),
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
    fields: userFieldsForMe(profileFields),
    initial: withSalaryParts(p),
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
      ? {
          month: freeMonth,
          amount: driver.monthly_salary ?? undefined,
          entry_date: monthLastDay(freeMonth) > today() ? today() : monthLastDay(freeMonth),
          description: salaryPartsText(driver) || undefined,
        }
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

/** Company cash for car work: give, returned, or settle with salary. */
export function editCash(open: Open, reload: Reload, driver: Profile, type: CashEntry['type'], entry?: CashEntry, suggested?: number) {
  const hint: Record<CashEntry['type'], string> = {
    given: 'Money given to the driver for fuel, repairs and other car work. Expenses he enters are taken from it.',
    returned: 'Unused company cash the driver gave back.',
    to_salary: 'The driver keeps this company cash: it is taken from his salary.',
    from_salary: 'The driver spent more than the company cash he had: this is added to his salary.',
  };
  open({
    title: `${entry ? 'Edit' : 'Add'} · ${CASH_LABEL[type]} · ${driver.full_name || driver.username}`,
    fields: [
      { key: 'amount', label: 'Amount (SAR)', type: 'number', required: true, hint: hint[type] },
      { key: 'entry_date', label: 'Date', type: 'date', required: true },
      ...(type === 'given' || type === 'returned'
        ? [
            {
              key: 'method',
              label: 'How',
              type: 'select' as const,
              options: [
                { value: 'cash', label: 'Cash' },
                { value: 'bank', label: 'Bank transfer' },
                { value: 'other', label: 'Other' },
              ],
              allowEmpty: true,
            },
          ]
        : []),
      { key: 'description', label: 'Note', type: 'multiline' },
    ],
    initial: entry ?? { amount: suggested && suggested > 0 ? suggested : undefined, entry_date: today(), method: type === 'given' || type === 'returned' ? 'cash' : undefined },
    saveText: entry ? 'Save' : 'Add',
    onSubmit: async (v) => saver('cash', reload, entry?.id)({ ...v, type, driver_id: driver.id }),
  });
}

/** Add / edit a partner's share in a car. */
export function editShare(open: Open, reload: Reload, d: FleetData, carId: string, share?: CarShare) {
  const partners = d.profiles.filter((p) => p.role === 'partner');
  open({
    title: share ? 'Edit share' : 'Add partner share',
    fields: [
      {
        key: 'partner_id',
        label: 'Partner',
        type: 'select',
        required: true,
        options: partners.map((p) => ({ value: p.id, label: p.full_name || p.username || '', sub: p.active ? '' : 'Inactive' })),
        hint: partners.length ? undefined : 'First create a user with role "Partner" in User.',
      },
      { key: 'share_percent', label: 'Share (%)', type: 'number', required: true, hint: 'Part of the car profit this partner gets, e.g. 50.' },
      { key: 'fee_percent', label: 'Company management fee (%)', type: 'number', hint: 'Optional. Taken from the profit before sharing, e.g. 10.' },
      { key: 'start_date', label: 'From', type: 'date', required: true },
      { key: 'end_date', label: 'Until', type: 'date', hint: 'Leave empty while the partnership runs.' },
      { key: 'notes', label: 'Notes / agreement', type: 'multiline' },
    ],
    initial: share ?? { start_date: today().slice(0, 8) + '01', fee_percent: 0 },
    onSubmit: async (v) => saver('car_shares', reload, share?.id)({ ...v, car_id: carId }),
  });
}

/** Payout to a partner, or a correction of his wallet. */
export function editPartnerEntry(open: Open, reload: Reload, d: FleetData, partner: Profile, type: PartnerEntry['type'], entry?: PartnerEntry, suggested?: number) {
  const myCars = d.shares.filter((s) => s.partner_id === partner.id).map((s) => s.car_id);
  const label = { payout: 'Pay partner', adjust_add: 'Add to wallet', adjust_less: 'Take from wallet' }[type];
  open({
    title: `${entry ? 'Edit' : label} · ${partner.full_name || partner.username}`,
    fields: [
      { key: 'amount', label: 'Amount (SAR)', type: 'number', required: true },
      { key: 'entry_date', label: 'Date', type: 'date', required: true },
      {
        key: 'car_id',
        label: 'Car (optional)',
        type: 'select',
        allowEmpty: true,
        options: d.cars.filter((c) => myCars.includes(c.id)).map((c) => ({ value: c.id, label: c.plate_no })),
      },
      ...(type === 'payout'
        ? [
            {
              key: 'method',
              label: 'Paid by',
              type: 'select' as const,
              allowEmpty: true,
              options: [
                { value: 'cash', label: 'Cash' },
                { value: 'bank', label: 'Bank transfer' },
                { value: 'other', label: 'Other' },
              ],
            },
          ]
        : []),
      { key: 'description', label: 'Note', type: 'multiline', placeholder: type === 'payout' ? 'e.g. Profit for September' : 'Why' },
    ],
    initial: entry ?? { amount: suggested && suggested > 0 ? suggested : undefined, entry_date: today(), method: type === 'payout' ? 'bank' : undefined },
    saveText: entry ? 'Save' : 'Add',
    onSubmit: async (v) => saver('partner_ledger', reload, entry?.id)({ ...v, type, partner_id: partner.id }),
  });
}
