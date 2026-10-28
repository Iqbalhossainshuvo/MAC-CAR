import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { deleteRow, editShare } from '@/components/editors';
import type { FormConfig } from '@/components/FormSheet';
import { saveRow, type FleetData } from '@/lib/data';
import { fmtDate, money, today } from '@/lib/format';
import { carSplit, partnersPercent } from '@/lib/partners';
import { monthLabel, recentMonths } from '@/lib/payroll';
import type { Car } from '@/lib/types';

import { Badge, Button, C, F, IconBtn, IconTile, KV, ListCard, ListItem, Row } from './ui';

/** Ownership of a car: rented (rent to the owner) or shared (partners and their % with the monthly split). */
export function CarOwnership({
  d,
  car,
  canEditCar,
  canPartners,
  canEditPartners,
  canAddExpense,
  open,
  reload,
}: {
  d: FleetData;
  car: Car;
  canEditCar: boolean;
  canPartners: boolean;
  canEditPartners: boolean;
  canAddExpense: boolean;
  open: (c: FormConfig | null) => void;
  reload: () => void | Promise<void>;
}) {
  const own = car.ownership ?? 'own';
  const month = today().slice(0, 7);
  const shares = d.shares.filter((s) => s.car_id === car.id);

  if (own === 'rented') {
    const rentThisMonth = d.expenses.filter((e) => e.car_id === car.id && e.category === 'rent' && e.expense_date.slice(0, 7) === month && e.status !== 'rejected');
    const addRent = () =>
      saveRow('expenses', {
        car_id: car.id,
        category: 'rent',
        amount: car.monthly_rent,
        expense_date: today(),
        paid_by: 'company',
        status: 'approved',
        description: `Rent for ${monthLabel(month)}${car.rent_owner ? ` to ${car.rent_owner}` : ''}`,
      }).then(() => reload());
    return (
      <ListCard title="Rented car" accent={C.blue}>
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <KV label="Owner" value={car.rent_owner || '-'} />
          <KV label="Owner phone" value={car.rent_owner_phone || '-'} />
          <KV label="Rent per month" value={car.monthly_rent != null ? money(car.monthly_rent) : '-'} />
          <KV label="Rent period" value={`${fmtDate(car.rent_start)} → ${car.rent_end ? fmtDate(car.rent_end) : 'open'}`} />
          <Row style={{ gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {rentThisMonth.length ? (
              <Badge text={`${monthLabel(month)} rent added · ${money(rentThisMonth.reduce((c, e) => c + Number(e.amount), 0))}`} tone="green" />
            ) : (
              <Badge text={`${monthLabel(month)} rent not added`} tone="amber" />
            )}
            {canAddExpense && !rentThisMonth.length && car.monthly_rent ? (
              <Button small icon="add-circle-outline" title={`Add rent ${money(car.monthly_rent)}`} onPress={addRent} />
            ) : null}
          </Row>
          <Text style={{ color: C.muted, fontSize: 12, marginTop: 6 }}>Rent is a car expense, so the car’s profit is shown after rent.</Text>
        </View>
      </ListCard>
    );
  }

  if (own !== 'shared' || !canPartners) return null;
  const held = partnersPercent(d, car.id);
  const split = carSplit(d, car.id, recentMonths(6));

  return (
    <ListCard
      title={`Partners · company ${Math.max(0, Math.round((100 - held) * 100) / 100)}%`}
      accent={C.magenta}
      right={canEditPartners ? <Button title="Add" icon="add" small onPress={() => editShare(open, reload, d, car.id)} /> : undefined}
    >
      {shares.length ? (
        shares.map((s) => (
          <ListItem
            key={s.id}
            onPress={() => router.push(`/admin/partner/${s.partner_id}`)}
            left={<IconTile icon="pie-chart" color={C.magenta} size={38} />}
            title={`${d.profiles.find((p) => p.id === s.partner_id)?.full_name ?? s.partner_name ?? 'Partner'} · ${s.share_percent}%`}
            subtitle={`${Number(s.fee_percent) ? `Fee ${s.fee_percent}% · ` : ''}from ${fmtDate(s.start_date)}${s.end_date ? ` to ${fmtDate(s.end_date)}` : ''}${s.notes ? ` · ${s.notes}` : ''}`}
            right={
              canEditPartners ? (
                <Row style={{ gap: 6 }}>
                  <IconBtn icon="create-outline" label="Edit share" onPress={() => editShare(open, reload, d, car.id, s)} />
                  <IconBtn icon="trash-outline" color={C.red} label="Delete share" onPress={() => deleteRow('car_shares', s.id, 'this share', reload)} />
                </Row>
              ) : undefined
            }
          />
        ))
      ) : (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <Text style={{ color: C.muted }}>No partners yet. Tap Add to give a partner a % of this car.</Text>
        </View>
      )}
      {shares.length ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 2 }}>
          <Text style={{ color: C.text, fontFamily: F.semi, marginBottom: 4 }}>Profit split by month</Text>
          {split.map((m) => (
            <View key={m.month} style={{ paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.border }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ color: C.text, fontFamily: F.semi }}>{m.label}</Text>
                <Text style={{ color: m.profit < 0 ? C.red : C.green, fontFamily: F.bold }}>{money(m.profit)}</Text>
              </Row>
              <Text style={{ color: C.muted, fontSize: 12 }}>
                {m.parts.map((x) => `${d.profiles.find((p) => p.id === x.share.partner_id)?.full_name ?? 'Partner'} ${money(x.amount)}`).join(' · ')}
                {m.parts.length ? ' · ' : ''}Company {money(m.company)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </ListCard>
  );
}
