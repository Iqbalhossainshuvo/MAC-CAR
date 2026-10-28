import { useAuth } from './auth';
import { useFleet } from './data';
import type { Profile } from './types';

/*
 * Manager (admin assistant) permissions — same rules as the server (Code.gs).
 * Stored on the user as "cars:edit,expenses:view,approve,reports".
 */

export type Area = 'cars' | 'drivers' | 'expenses' | 'income' | 'salary' | 'partners';
export type Flag = 'approve' | 'logins' | 'reports' | 'archive';
export type Level = 'view' | 'edit';
export type Perms = Partial<Record<Area, Level>> & Partial<Record<Flag, true>>;

export const AREAS: { key: Area; label: string; hint: string }[] = [
  { key: 'cars', label: 'Cars', hint: 'Cars, car documents, who drives which car' },
  { key: 'drivers', label: 'Drivers', hint: 'Driver details, driver documents, daily reports' },
  { key: 'expenses', label: 'Expenses', hint: 'Expenses and receipts' },
  { key: 'income', label: 'Income', hint: 'Income from cars' },
  { key: 'salary', label: 'Salary & company cash', hint: 'Salary, advances, incentives, payments, cash given for car work' },
  { key: 'partners', label: 'Partners', hint: 'Car shares, partners\' profit and payouts' },
];

export const FLAGS: { key: Flag; label: string; hint: string }[] = [
  { key: 'approve', label: 'Approve expenses', hint: 'Approve / reject driver entries and waive fines' },
  { key: 'logins', label: 'Driver logins', hint: 'Create driver logins, reset driver passwords, activate / deactivate drivers' },
  { key: 'reports', label: 'Reports & profit', hint: 'Reports, profit and all money totals (read only)' },
  { key: 'archive', label: 'Archive', hint: 'See deleted items and restore them' },
];

const AREA_KEYS = AREAS.map((a) => a.key) as string[];
const FLAG_KEYS = FLAGS.map((f) => f.key) as string[];

export function parsePerms(text?: string | null): Perms {
  const out: Perms = {};
  for (const t of String(text ?? '').split(/[\s,;]+/)) {
    const [k, lvl] = t.trim().toLowerCase().split(':');
    if (AREA_KEYS.includes(k)) {
      const a = k as Area;
      if (out[a] !== 'edit') out[a] = lvl === 'edit' ? 'edit' : 'view';
    } else if (FLAG_KEYS.includes(k)) out[k as Flag] = true;
  }
  return out;
}

export function permsText(p: Perms): string {
  return [...AREAS.filter((a) => p[a.key]).map((a) => `${a.key}:${p[a.key]}`), ...FLAGS.filter((f) => p[f.key]).map((f) => f.key)].join(',');
}

export function isStaff(u?: Pick<Profile, 'role'> | null) {
  return u?.role === 'admin' || u?.role === 'manager';
}

/** can(user, 'cars', 'edit'), can(user, 'expenses') (= view), can(user, 'approve') */
export function can(u: Pick<Profile, 'role' | 'active' | 'permissions'> | null | undefined, what: Area | Flag, level: Level = 'view'): boolean {
  if (!u) return false;
  if (u.role === 'admin') return true;
  if (u.role !== 'manager') return false;
  const p = parsePerms(u.permissions);
  if (FLAG_KEYS.includes(what)) return !!p[what as Flag];
  const have = p[what as Area];
  return level === 'edit' ? have === 'edit' : have === 'view' || have === 'edit';
}

/** Short text for a manager's permissions, e.g. "Cars (edit) · Expenses (view) · Approve" */
export function permsSummary(text?: string | null) {
  const p = parsePerms(text);
  const parts = [
    ...AREAS.filter((a) => p[a.key]).map((a) => `${a.label}${p[a.key] === 'edit' ? '' : ' (view)'}`),
    ...FLAGS.filter((f) => p[f.key]).map((f) => f.label),
  ];
  return parts.length ? parts.join(' · ') : 'No access yet';
}

export interface PermCheck {
  /** admin or manager */
  staff: boolean;
  admin: boolean;
  can: (what: Area | Flag, level?: Level) => boolean;
  /** can read expenses (they also feed salary accounts and reports) */
  seeExpenses: boolean;
  seeMoney: boolean;
}

/** Permissions of the signed-in user (fresh from the latest data sync). */
export function usePerm(): PermCheck {
  const { user } = useAuth();
  const { data } = useFleet();
  const me = data.me && user && data.me.id === user.id ? data.me : user;
  const c = (what: Area | Flag, level?: Level) => can(me, what, level);
  return {
    staff: isStaff(me),
    admin: me?.role === 'admin',
    can: c,
    seeExpenses: c('expenses') || c('approve') || c('salary') || c('reports'),
    seeMoney: c('reports'),
  };
}

/** Which buttons an expense row gets for the signed-in admin / manager. */
export function expenseRowProps(
  p: PermCheck,
  e: { status: string },
  h: { approve?: () => void; reject?: () => void; edit?: () => void; del?: () => void },
) {
  const canApprove = p.can('approve');
  const canEdit = p.can('expenses', 'edit') && (canApprove || e.status === 'pending');
  return {
    onApprove: canApprove ? h.approve : undefined,
    onReject: canApprove ? h.reject : undefined,
    onEdit: canEdit ? h.edit : undefined,
    onDelete: canEdit ? h.del : undefined,
    receipt: { canUpload: canEdit, canRemove: canEdit },
  };
}
