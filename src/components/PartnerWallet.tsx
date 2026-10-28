import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { deleteRow, editPartnerEntry } from '@/components/editors';
import type { FormConfig } from '@/components/FormSheet';
import type { FleetData } from '@/lib/data';
import { fmtDate, money } from '@/lib/format';
import { carSplit, partnerAccount } from '@/lib/partners';
import { carriedNote, monthLabel, recentMonths } from '@/lib/payroll';
import type { Profile } from '@/lib/types';

import { Badge, Button, C, Empty, F, HeroCard, IconBtn, IconTile, ListCard, ListItem, Row } from './ui';

/**
 * A partner's wallet: profit (or loss) share of every shared car, month by month,
 * minus what was paid out. 0 = fully paid. Unpaid months carry forward with a note.
 */
export function PartnerWallet({
  d,
  partner,
  admin,
  open,
  reload,
}: {
  d: FleetData;
  partner: Profile;
  admin?: boolean;
  open?: (c: FormConfig | null) => void;
  reload?: () => void | Promise<void>;
}) {
  const acc = useMemo(() => partnerAccount(d, partner.id), [d, partner.id]);
  const [all, setAll] = useState(false);
  const can = !!(admin && open && reload);
  const myShares = d.shares.filter((s) => s.partner_id === partner.id);
  const months = recentMonths(6);
  const bal = acc.balance;
  const you = admin ? (partner.full_name || '').split(' ')[0] : 'you';

  const lines = [...acc.lines].reverse();
  const shown = all ? lines : lines.slice(0, 12);

  return (
    <View>
      <HeroCard colors={bal < 0 ? ['#F59E8B', '#E5484D', '#C2416B'] : undefined}>
        <Row style={{ gap: 8 }}>
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="wallet" size={16} color="#fff" />
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.92)', fontFamily: F.semi, fontSize: 14 }}>
            {bal > 0 ? (admin ? `Company owes ${you}` : 'Company owes you') : bal < 0 ? (admin ? `${you} owes (losses)` : 'You owe (losses)') : 'Wallet settled'}
          </Text>
        </Row>
        <Text style={{ color: '#fff', fontFamily: F.display, fontSize: 32, marginTop: 10 }} numberOfLines={1} adjustsFontSizeToFit>
          {money(Math.abs(bal))}
        </Text>
        {acc.dues.carried.length ? (
          <View style={{ marginTop: 8, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)' }}>
            <Text style={{ color: '#fff', fontFamily: F.semi, fontSize: 12 }}>{carriedNote(acc.dues, money)}</Text>
          </View>
        ) : null}
        <Text style={{ color: 'rgba(255,255,255,0.88)', fontFamily: F.regular, fontSize: 12, marginTop: 8 }}>
          {myShares.length} car share(s). This month’s figures keep changing until the month ends.
        </Text>
      </HeroCard>

      {can ? (
        <Row style={{ gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <Button small icon="checkmark-done-outline" title="Pay partner" style={{ flexGrow: 1, flexBasis: 140 }} onPress={() => editPartnerEntry(open!, reload!, d, partner, 'payout', undefined, bal)} />
          <Button small variant="light" icon="add-circle-outline" title="Add to wallet" style={{ flexGrow: 1, flexBasis: 140 }} onPress={() => editPartnerEntry(open!, reload!, d, partner, 'adjust_add')} />
          <Button small variant="light" icon="remove-circle-outline" title="Take from wallet" style={{ flexGrow: 1, flexBasis: 140 }} onPress={() => editPartnerEntry(open!, reload!, d, partner, 'adjust_less')} />
        </Row>
      ) : null}

      {acc.dues.byMonth.length ? (
        <ListCard title="Unpaid by month">
          {acc.dues.byMonth.map((m) => (
            <ListItem
              key={m.month}
              left={<IconTile icon="time-outline" color={acc.dues.carried.some((x) => x.month === m.month) ? C.amber : C.primary} size={36} />}
              title={monthLabel(m.month)}
              subtitle={acc.dues.carried.some((x) => x.month === m.month) ? 'Carried forward — not fully paid yet' : 'This month (so far)'}
              right={<Text style={{ fontFamily: F.bold, color: C.text }}>{money(m.amount)}</Text>}
            />
          ))}
        </ListCard>
      ) : null}

      {myShares.map((s) => {
        const car = d.cars.find((c) => c.id === s.car_id);
        const split = carSplit(d, s.car_id, months.filter((m) => m >= s.start_date.slice(0, 7) && (!s.end_date || m <= s.end_date.slice(0, 7))));
        return (
          <ListCard key={s.id} title={`${car?.plate_no ?? 'Car'} · ${s.share_percent}% share${Number(s.fee_percent) ? ` · ${s.fee_percent}% fee` : ''}`}>
            {split.map((m) => {
              const mine = m.parts.find((x) => x.share.id === s.id);
              return (
                <ListItem
                  key={m.month}
                  left={<IconTile icon={m.profit >= 0 ? 'trending-up' : 'trending-down'} color={m.profit >= 0 ? C.green : C.red} size={36} />}
                  title={m.label}
                  subtitle={`Income ${money(m.income)} · Expenses ${money(m.expense)} · ${m.profit >= 0 ? 'Profit' : 'Loss'} ${money(Math.abs(m.profit))}`}
                  right={
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontFamily: F.bold, color: (mine?.amount ?? 0) < 0 ? C.red : C.green }}>{mine ? money(mine.amount) : '-'}</Text>
                      <Text style={{ color: C.muted, fontSize: 11 }}>{admin ? 'partner part' : 'your part'}</Text>
                    </View>
                  }
                />
              );
            })}
            {s.notes ? <Text style={{ color: C.muted, fontSize: 12, paddingHorizontal: 16, paddingTop: 6 }}>{s.notes}</Text> : null}
          </ListCard>
        );
      })}

      <ListCard title="Month by month">
        {acc.months.length ? (
          acc.months.map((m) => (
            <ListItem
              key={m.month}
              left={<IconTile icon="calendar-outline" color={m.closing < 0 ? C.red : C.primary} size={38} />}
              title={monthLabel(m.month)}
              subtitle={[
                m.opening ? `From before ${money(m.opening)}` : null,
                `Share ${m.share >= 0 ? '+' : '−'}${money(Math.abs(m.share))}`,
                m.adjust ? `Correction ${m.adjust >= 0 ? '+' : '−'}${money(Math.abs(m.adjust))}` : null,
                m.paid ? `Paid −${money(m.paid)}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              right={
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontFamily: F.bold, color: m.closing < 0 ? C.red : C.text }}>{money(m.closing)}</Text>
                  <Text style={{ color: C.muted, fontSize: 11 }}>{m.closing === 0 ? 'settled' : 'balance'}</Text>
                </View>
              }
            />
          ))
        ) : (
          <Empty text="No shares yet" icon="pie-chart-outline" />
        )}
      </ListCard>

      <ListCard title={`All entries · ${acc.lines.length}`}>
        {shown.length ? (
          shown.map((l) => (
            <ListItem
              key={l.key}
              left={<IconTile icon={l.kind === 'payout' ? 'checkmark-done-circle' : l.sign > 0 ? 'arrow-down-circle' : 'arrow-up-circle'} color={l.kind === 'payout' ? C.primary : l.sign > 0 ? C.green : C.red} size={38} />}
              title={l.title}
              subtitle={
                <View style={{ gap: 4, marginTop: 2 }}>
                  <Text style={{ color: C.muted, fontSize: 12 }}>{[fmtDate(l.date), l.description].filter(Boolean).join(' · ')}</Text>
                  {l.running ? <Badge text="Month running" tone="amber" /> : null}
                  {can && l.entry ? (
                    <Row style={{ gap: 8 }}>
                      <IconBtn icon="create-outline" label="Edit" onPress={() => editPartnerEntry(open!, reload!, d, partner, l.entry!.type, l.entry)} />
                      <IconBtn icon="trash-outline" color={C.red} label="Delete" onPress={() => deleteRow('partner_ledger', l.entry!.id, 'this entry', reload!)} />
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
          <Empty text="Nothing here yet" icon="list-outline" />
        )}
        {lines.length > 12 ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 6 }}>
            <Button small variant="ghost" title={all ? 'Show less' : `Show all ${lines.length}`} onPress={() => setAll((x) => !x)} />
          </View>
        ) : null}
      </ListCard>
    </View>
  );
}
