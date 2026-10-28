import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { Button, C, Card, Chips, Empty, F, IconTile, ListCard, ListItem, Loading, Screen, type IconName } from '@/components/ui';
import { restoreRow, useFleet, type FleetData, type Table } from '@/lib/data';
import { carName, fmtDate, money, personName } from '@/lib/format';
import { PAY_LABEL } from '@/lib/payroll';
import { usePerm, type Area } from '@/lib/perms';
import { CATEGORY_LABEL } from '@/lib/types';
import { NoAccess } from '@/components/NoAccess';

type Kind = 'all' | Table;

interface Item {
  table: Table;
  id: string;
  icon: IconName;
  title: string;
  sub: string;
  at: string;
  by: string;
  carDoc?: boolean;
}

/** permission area of an archived row (same rule as the server) */
function areaOf(i: Item): Area {
  if (i.table === 'car_documents') return i.carDoc ? 'cars' : 'drivers';
  return ({ cars: 'cars', assignments: 'cars', daily_logs: 'drivers', incomes: 'income', expenses: 'expenses', payroll: 'salary' } as const)[i.table];
}

const KIND_LABEL: Record<Kind, string> = {
  all: 'All',
  expenses: 'Expenses',
  incomes: 'Income',
  payroll: 'Salary',
  cars: 'Cars',
  car_documents: 'Documents',
  assignments: 'Assignments',
  daily_logs: 'Daily reports',
};

/** Everything that was "deleted": hidden in the app, still in the Google Sheet, can be restored. */
export default function Archive() {
  const { all, carById, personById, firstLoad } = useFleet();
  const [kind, setKind] = useState<Kind>('all');
  const perm = usePerm();

  const items = useMemo(() => collect(all, carById, personById).filter((i) => perm.can(areaOf(i))), [all, carById, personById, perm]);
  const shown = kind === 'all' ? items : items.filter((i) => i.table === kind);

  if (!perm.can('archive')) return <NoAccess what="the archive" />;
  if (firstLoad) return <Loading />;

  return (
    <Screen>
      <Card>
        <Text style={{ color: C.text, fontFamily: F.bold, fontSize: 16 }}>Nothing is ever deleted</Text>
        <Text style={{ color: C.muted, fontFamily: F.regular, marginTop: 4, lineHeight: 20 }}>
          When you delete something it moves here. It is hidden everywhere in the app and not counted in totals, but it stays in your
          Google Sheet. Tap Restore to bring it back.
        </Text>
      </Card>
      <Chips<Kind>
        options={['all', 'expenses', 'incomes', 'payroll', 'cars', 'car_documents', 'assignments', 'daily_logs']}
        value={kind}
        onChange={setKind}
        labels={Object.fromEntries(
          (Object.keys(KIND_LABEL) as Kind[]).map((k) => [k, `${KIND_LABEL[k]}${k === 'all' ? ` (${items.length})` : ''}`]),
        )}
      />
      <View style={{ height: 8 }} />
      <ListCard title={`Archived · ${shown.length}`}>
        {shown.length ? (
          shown.map((i) => (
            <ListItem
              key={`${i.table}:${i.id}`}
              left={<IconTile icon={i.icon} color={C.gray} size={40} />}
              title={i.title}
              subtitle={
                <View style={{ marginTop: 3, gap: 2 }}>
                  <Text style={{ color: C.muted, fontSize: 12, fontFamily: F.regular }}>{i.sub}</Text>
                  <Text style={{ color: C.muted, fontSize: 11, fontFamily: F.regular }}>
                    {KIND_LABEL[i.table]} · archived {fmtDate(i.at.slice(0, 10))}
                    {i.by ? ` by ${i.by}` : ''}
                  </Text>
                </View>
              }
              right={
                perm.can(areaOf(i), 'edit') ? (
                  <Button small variant="ghost" icon="arrow-undo-outline" title="Restore" onPress={() => restoreRow(i.table, i.id)} />
                ) : undefined
              }
            />
          ))
        ) : (
          <Empty text="Nothing archived" icon="archive-outline" />
        )}
      </ListCard>
    </Screen>
  );
}

function collect(d: FleetData, cars: Map<string, any>, people: Map<string, any>): Item[] {
  const by = (id?: string | null) => (id ? personName(people.get(id)) : '');
  const car = (id?: string | null) => (id ? carName(cars.get(id)) : '');
  const out: Item[] = [];
  const push = (table: Table, r: any, icon: IconName, title: string, sub: string) => {
    if (r.archived) out.push({ table, id: r.id, icon, title, sub, at: r.archived_at ?? '', by: by(r.archived_by), carDoc: !!r.car_id });
  };
  for (const e of d.expenses)
    push('expenses', e, 'trending-down', `${CATEGORY_LABEL[e.category]} · ${money(e.amount)}`, [fmtDate(e.expense_date), car(e.car_id), by(e.driver_id), e.description].filter(Boolean).join(' · '));
  for (const i of d.incomes) push('incomes', i, 'trending-up', `Income · ${money(i.amount)}`, [fmtDate(i.income_date), car(i.car_id), i.customer_name].filter(Boolean).join(' · '));
  for (const p of d.payroll)
    push('payroll', p, 'wallet-outline', `${PAY_LABEL[p.type]} · ${money(p.amount)}`, [fmtDate(p.entry_date), by(p.driver_id), p.month, p.description].filter(Boolean).join(' · '));
  for (const c of d.cars) push('cars', c, 'car-sport-outline', carName(c), c.status);
  for (const x of d.docs) push('car_documents', x, 'document-outline', x.doc_type, [car(x.car_id) || by(x.driver_id), x.expiry_date ? `expires ${fmtDate(x.expiry_date)}` : ''].filter(Boolean).join(' · '));
  for (const a of d.assignments)
    push('assignments', a, 'swap-horizontal', `${by(a.driver_id)} → ${car(a.car_id)}`, `${fmtDate(a.start_date)} → ${a.end_date ? fmtDate(a.end_date) : 'now'}`);
  for (const l of d.logs) push('daily_logs', l, 'clipboard-outline', `Daily report · ${fmtDate(l.log_date)}`, [car(l.car_id), by(l.driver_id)].filter(Boolean).join(' · '));
  return out.sort((a, b) => b.at.localeCompare(a.at));
}
