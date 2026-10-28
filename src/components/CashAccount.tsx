import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { deleteRow, editCash } from '@/components/editors';
import type { FormConfig } from '@/components/FormSheet';
import type { FleetData } from '@/lib/data';
import { fmtDate, money } from '@/lib/format';
import { cashAccount } from '@/lib/payroll';
import type { Profile } from '@/lib/types';

import { Badge, Button, C, Empty, F, IconBtn, IconTile, ListCard, ListItem, Row } from './ui';

/**
 * Company cash a driver holds for car work, kept apart from the salary.
 * Expenses he pays "from company cash" are taken from it; at any time the admin can
 * take the leftover back (returned / from salary) or pay what he overspent (via salary).
 */
export function CashAccount({
  d,
  driver,
  admin,
  open,
  reload,
}: {
  d: FleetData;
  driver: Profile;
  admin?: boolean;
  open?: (c: FormConfig | null) => void;
  reload?: () => void | Promise<void>;
}) {
  const acc = useMemo(() => cashAccount(d, driver.id), [d, driver.id]);
  const [all, setAll] = useState(false);
  if (!admin && !acc.lines.length) return null;
  const lines = [...acc.lines].reverse();
  const shown = all ? lines : lines.slice(0, 8);
  const can = !!(admin && open && reload);
  const bal = acc.balance;

  return (
    <ListCard title="Company cash for car work">
      <View style={{ paddingHorizontal: 16, paddingBottom: 8, gap: 6 }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.muted, fontFamily: F.semi, fontSize: 12 }}>
              {bal > 0 ? (admin ? 'Driver holds' : 'You hold') : bal < 0 ? (admin ? 'Driver spent extra (company owes)' : 'You spent extra (company owes you)') : 'Nothing in hand'}
            </Text>
            <Text style={{ color: bal < 0 ? C.blue : bal > 0 ? C.amber : C.text, fontFamily: F.display, fontSize: 26 }}>{money(Math.abs(bal))}</Text>
          </View>
        </Row>
        <Text style={{ color: C.muted, fontFamily: F.regular, fontSize: 12 }}>
          Given {money(acc.given)} · Spent {money(acc.spent)}
          {acc.pendingSpent ? ` (${money(acc.pendingSpent)} waiting approval)` : ''} · Returned {money(acc.returned)}
          {acc.settled ? ` · Settled with salary ${money(Math.abs(acc.settled))}` : ''}
        </Text>
        {can ? (
          <Row style={{ gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
            <Button small icon="add-circle-outline" title="Give cash" style={{ flexGrow: 1, flexBasis: 130 }} onPress={() => editCash(open!, reload!, driver, 'given')} />
            <Button
              small
              variant="light"
              icon="return-down-back-outline"
              title="Returned"
              style={{ flexGrow: 1, flexBasis: 130 }}
              onPress={() => editCash(open!, reload!, driver, 'returned', undefined, bal)}
            />
            {bal !== 0 ? (
              <Button
                small
                variant="light"
                icon="swap-horizontal"
                title={bal > 0 ? 'Take from salary' : 'Add to salary'}
                style={{ flexGrow: 1, flexBasis: 130 }}
                onPress={() => editCash(open!, reload!, driver, bal > 0 ? 'to_salary' : 'from_salary', undefined, Math.abs(bal))}
              />
            ) : null}
          </Row>
        ) : null}
      </View>
      {shown.length ? (
        shown.map((l) => (
          <ListItem
            key={l.key}
            left={<IconTile icon={l.sign > 0 ? 'arrow-down-circle' : 'arrow-up-circle'} color={l.sign > 0 ? C.green : l.expense ? C.magenta : C.amber} size={38} />}
            title={l.label}
            subtitle={
              <View style={{ gap: 4, marginTop: 2 }}>
                <Text style={{ color: C.muted, fontSize: 12 }}>{[fmtDate(l.date), l.description].filter(Boolean).join(' · ')}</Text>
                {l.pending ? <Badge text="Waiting approval" tone="amber" /> : null}
                {can && l.entry ? (
                  <Row style={{ gap: 8 }}>
                    <IconBtn icon="create-outline" label="Edit" onPress={() => editCash(open!, reload!, driver, l.entry!.type, l.entry)} />
                    <IconBtn icon="trash-outline" color={C.red} label="Delete" onPress={() => deleteRow('cash', l.entry!.id, 'this cash entry', reload!)} />
                  </Row>
                ) : null}
              </View>
            }
            right={
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontFamily: F.bold, color: l.sign > 0 ? C.green : C.red }}>
                  {l.sign > 0 ? '+' : '−'}
                  {money(l.amount).replace('SAR ', '')}
                </Text>
                <Text style={{ color: C.muted, fontSize: 11 }}>= {money(l.balance)}</Text>
              </View>
            }
          />
        ))
      ) : (
        <Empty text="No company cash given yet" icon="cash-outline" />
      )}
      {lines.length > 8 ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 6 }}>
          <Button small variant="ghost" title={all ? 'Show less' : `Show all ${lines.length}`} onPress={() => setAll((x) => !x)} />
        </View>
      ) : null}
    </ListCard>
  );
}
