import { Text, View } from 'react-native';

import { cap, carName, expiryLevel, fmtDate, money, num, personName, today } from '@/lib/format';
import { CATEGORY_LABEL, type Assignment, type Car, type CarDocument, type DailyLog, type Expense, type Income, type Profile } from '@/lib/types';

import { DocFileBar } from './DocFile';
import { Badge, C, ExpiryBadge, F, IconBtn, IconTile, ListItem, Row, statusTone, type IconName } from './ui';

type Lookup<T> = Map<string, T>;

const CAT_ICON: Record<string, IconName> = {
  fuel: 'flame',
  maintenance: 'construct',
  repair: 'hammer',
  fine: 'alert-circle',
  toll: 'cash',
  wash: 'water',
  tyre: 'disc',
  insurance: 'shield-checkmark',
  registration: 'document',
  salary: 'wallet',
  other: 'ellipsis-horizontal-circle',
};

export function Amount({ value, tone }: { value: number; tone: 'in' | 'out' }) {
  return (
    <Text style={{ fontFamily: F.monoBold, color: tone === 'in' ? C.green : C.red, fontSize: 14 }}>
      {tone === 'in' ? '+' : '-'}
      {money(value).replace('SAR ', '')}
    </Text>
  );
}

export function ExpenseRow({
  e,
  cars,
  people,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  showCar = true,
  showDriver = true,
}: {
  e: Expense;
  cars: Lookup<Car>;
  people: Lookup<Profile>;
  onEdit?: () => void;
  onDelete?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  showCar?: boolean;
  showDriver?: boolean;
}) {
  const parts = [
    fmtDate(e.expense_date),
    showCar ? cars.get(e.car_id)?.plate_no : null,
    showDriver && e.driver_id ? personName(people.get(e.driver_id)) : null,
    e.odometer ? `${num(e.odometer)} km` : null,
  ].filter(Boolean);
  return (
    <ListItem
      left={<IconTile icon={CAT_ICON[e.category] ?? 'cash'} color={e.category === 'fine' ? C.red : C.magenta} />}
      title={CATEGORY_LABEL[e.category]}
      subtitle={
        <View style={{ gap: 4, marginTop: 3 }}>
          <Text style={{ color: C.muted, fontSize: 12 }}>{parts.join(' · ')}</Text>
          {e.description || e.reference ? (
            <Text style={{ color: C.text, fontSize: 13 }} numberOfLines={2}>
              {[e.description, e.reference ? `#${e.reference}` : null].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
            {e.status !== 'approved' ? <Badge text={e.status} tone={statusTone(e.status)} /> : null}
            {e.paid_by === 'driver' ? <Badge text="Paid by driver" tone="blue" /> : null}
            {e.category === 'fine' && e.waived ? <Badge text="Fine waived" tone="gray" /> : null}
          </Row>
          {onApprove || onReject || onEdit || onDelete ? (
            <Row style={{ gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              {onApprove ? <IconBtn icon="checkmark" color={C.green} label="Approve" onPress={onApprove} /> : null}
              {onReject ? <IconBtn icon="close" color={C.red} label="Reject" onPress={onReject} /> : null}
              {onEdit ? <IconBtn icon="create-outline" label="Edit" onPress={onEdit} /> : null}
              {onDelete ? <IconBtn icon="trash-outline" color={C.red} label="Delete" onPress={onDelete} /> : null}
            </Row>
          ) : null}
        </View>
      }
      right={<Amount value={e.amount} tone="out" />}
    />
  );
}

export function IncomeRow({
  i,
  cars,
  onEdit,
  onDelete,
  showCar = true,
}: {
  i: Income;
  cars: Lookup<Car>;
  onEdit?: () => void;
  onDelete?: () => void;
  showCar?: boolean;
}) {
  const period = i.period_from || i.period_to ? `${fmtDate(i.period_from)} → ${fmtDate(i.period_to)}` : null;
  return (
    <ListItem
      left={<IconTile icon="arrow-down-circle" color={C.green} />}
      title={i.customer_name || 'Income'}
      subtitle={
        <View style={{ gap: 4, marginTop: 3 }}>
          <Text style={{ color: C.muted, fontSize: 12 }}>
            {[fmtDate(i.income_date), showCar ? cars.get(i.car_id)?.plate_no : null, period].filter(Boolean).join(' · ')}
          </Text>
          {i.description ? (
            <Text style={{ color: C.text, fontSize: 13 }} numberOfLines={2}>
              {i.description}
            </Text>
          ) : null}
          {i.payment_status === 'due' ? <Badge text="Due" tone="amber" /> : null}
        </View>
      }
      right={
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Amount value={i.amount} tone="in" />
          <Row style={{ gap: 6 }}>
            {onEdit ? <IconBtn icon="create-outline" label="Edit" onPress={onEdit} /> : null}
            {onDelete ? <IconBtn icon="trash-outline" color={C.red} label="Delete" onPress={onDelete} /> : null}
          </Row>
        </View>
      }
    />
  );
}

export function LogRow({
  l,
  cars,
  people,
  onDelete,
  showCar = true,
  showDriver = true,
}: {
  l: DailyLog;
  cars: Lookup<Car>;
  people: Lookup<Profile>;
  onDelete?: () => void;
  showCar?: boolean;
  showDriver?: boolean;
}) {
  const km = l.end_odometer != null && l.start_odometer != null ? l.end_odometer - l.start_odometer : null;
  return (
    <ListItem
      left={<IconTile icon="clipboard" color={C.violet} />}
      title={`Daily report · ${fmtDate(l.log_date)}`}
      subtitle={
        <View style={{ gap: 4, marginTop: 3 }}>
          <Text style={{ color: C.muted, fontSize: 12 }}>
            {[
              showCar ? cars.get(l.car_id)?.plate_no : null,
              showDriver ? personName(people.get(l.driver_id)) : null,
              km != null ? `${num(km)} km` : null,
              l.trips != null ? `${l.trips} trips` : null,
              l.cash_collected != null ? `Cash ${money(l.cash_collected)}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {l.work_details ? (
            <Text style={{ color: C.text, fontSize: 13 }} numberOfLines={3}>
              {l.work_details}
            </Text>
          ) : null}
        </View>
      }
      right={onDelete ? <IconBtn icon="trash-outline" color={C.red} label="Delete" onPress={onDelete} /> : undefined}
    />
  );
}

export function DocRow({
  d,
  onEdit,
  onDelete,
  manageFile,
  showFile = true,
}: {
  d: CarDocument;
  onEdit?: () => void;
  onDelete?: () => void;
  /** admin: may upload / replace / remove the attached file */
  manageFile?: boolean;
  showFile?: boolean;
}) {
  const lvl = expiryLevel(d.expiry_date);
  return (
    <ListItem
      left={<IconTile icon="document-text" color={lvl === 'expired' ? C.red : lvl === 'soon' ? C.amber : C.green} />}
      title={d.doc_type}
      subtitle={
        <View style={{ gap: 4, marginTop: 3 }}>
          {d.doc_number ? <Text style={{ color: C.muted, fontSize: 12 }}>No. {d.doc_number}</Text> : null}
          <ExpiryBadge date={d.expiry_date} />
          {showFile ? <DocFileBar doc={d} manage={manageFile} /> : null}
        </View>
      }
      right={
        onEdit || onDelete ? (
          <View style={{ gap: 6, alignSelf: 'flex-start' }}>
            {onEdit ? <IconBtn icon="create-outline" label="Edit document" onPress={onEdit} /> : null}
            {onDelete ? <IconBtn icon="trash-outline" color={C.red} label="Delete document" onPress={onDelete} /> : null}
          </View>
        ) : undefined
      }
    />
  );
}

export function AssignmentRow({
  a,
  cars,
  people,
  mode,
  onEnd,
  onEdit,
  onDelete,
}: {
  a: Assignment;
  cars: Lookup<Car>;
  people: Lookup<Profile>;
  /** show the car or the driver as the title */
  mode: 'car' | 'driver';
  onEnd?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const now = !a.end_date || a.end_date >= today();
  return (
    <ListItem
      left={<IconTile icon={mode === 'car' ? 'car-sport' : 'person'} color={now ? C.green : C.gray} />}
      title={mode === 'car' ? carName(cars.get(a.car_id)) : personName(people.get(a.driver_id))}
      subtitle={
        <View style={{ gap: 4, marginTop: 3 }}>
          <Text style={{ color: C.muted, fontSize: 12 }}>
            {fmtDate(a.start_date)} → {a.end_date ? fmtDate(a.end_date) : 'now'}
          </Text>
          {a.notes ? <Text style={{ color: C.text, fontSize: 13 }}>{a.notes}</Text> : null}
          {!a.end_date ? <Badge text="Driving now" tone="green" /> : null}
        </View>
      }
      right={
        <Row style={{ gap: 6 }}>
          {onEnd && !a.end_date ? <IconBtn icon="stop-circle-outline" color={C.amber} label="End today" onPress={onEnd} /> : null}
          {onEdit ? <IconBtn icon="create-outline" label="Edit" onPress={onEdit} /> : null}
          {onDelete ? <IconBtn icon="trash-outline" color={C.red} label="Delete" onPress={onDelete} /> : null}
        </Row>
      }
    />
  );
}

export function statusLabel(s: string) {
  return cap(s);
}
