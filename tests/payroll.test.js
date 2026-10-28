// Salary account math. Run: npm run test:payroll
const { driverAccount, driverCost } = require('../.test-build/payroll.js');
let fails = 0;
const eq = (a, b, m) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    fails++;
    console.log('FAIL', m, 'got', a, 'want', b);
  } else console.log('ok', m);
};
const D = 'd1';
const P = (id, type, amount, date, extra = {}) => ({ id, driver_id: D, type, amount, entry_date: date, month: null, method: null, description: null, created_at: date + 'T10:00:' + id, ...extra });
const E = (id, cat, amount, date, paid_by, status = 'approved', extra = {}) => ({ id, driver_id: D, car_id: 'c1', category: cat, amount, expense_date: date, paid_by, status, created_at: date, ...extra });
const d = {
  payroll: [
    P('1', 'salary', 2500, '2026-09-30', { month: '2026-09' }),
    P('2', 'advance', 800, '2026-09-10'),
    P('3', 'payment', 1500, '2026-10-02'),
    P('4', 'salary', 2500, '2026-10-31', { month: '2026-10' }),
    P('5', 'bonus', 300.1, '2026-10-20'),
    P('6', 'advance', 3000, '2026-10-15'), // takes more than earned
    P('7', 'deduction', 0.2, '2026-10-21'),
    P('x', 'salary', 9999, '2026-10-31', { driver_id: 'other', month: '2026-10' }), // other driver
  ],
  expenses: [
    E('e1', 'fine', 300, '2026-10-05', 'company'), // charged
    E('e2', 'fine', 150, '2026-10-06', 'company', 'approved', { waived: true }), // waived
    E('e3', 'fine', 500, '2026-10-07', 'driver'), // driver paid himself
    E('e4', 'fuel', 120.15, '2026-10-08', 'driver'), // reimbursement
    E('e5', 'fuel', 99, '2026-10-09', 'driver', 'pending'), // not approved yet
    E('e6', 'repair', 400, '2026-10-09', 'company'), // company cost only
    E('e7', 'fine', 200, '2026-10-12', 'company', 'rejected'), // rejected
  ],
};
const a = driverAccount(d, D);
// Sep: +2500 -800 = 1700
// Oct: credits 2500 + 300.10 + 120.15 = 2920.25 ; debits 1500 + 3000 + 0.20 + 300 = 4800.20 ; net -1879.95
// Total: 1700 - 1879.95 = -179.95 (driver owes the company 179.95)
eq(a.balance, -179.95, 'final balance (driver owes 179.95)');
// independent cross-check: add every counted line in halalas
const cross = a.lines.reduce((c, l) => c + l.sign * Math.round(l.amount * 100), 0) / 100;
eq(cross, a.balance, 'cross-check: sum of lines equals balance');
eq(a.months.map((m) => [m.month, m.opening, m.closing]), [['2026-10', 1700, -179.95], ['2026-09', 0, 1700]], 'monthly opening/closing carry over');
const oct = a.months[0];
eq([oct.salary, oct.bonus, oct.advances, oct.fines, oct.deductions, oct.paid, oct.reimbursed], [2500, 300.1, 3000, 300, 0.2, 1500, 120.15], 'october breakdown');
eq(a.lines[a.lines.length - 1].balance, a.balance, 'running balance ends at the balance');
eq(a.lines.filter((l) => l.kind === 'fine').map((l) => [l.amount, l.sign]), [[300, -1], [150, 0]], 'fines: charged and waived shown, driver-paid hidden');
eq(a.lines.length, 10, 'line count: 7 salary-account entries + 2 fines + 1 reimbursement');
const fp = driverAccount({ payroll: [P('a', 'bonus', 0.1, '2026-01-01'), P('b', 'bonus', 0.2, '2026-01-02')], expenses: [] }, D);
eq(fp.balance, 0.3, '0.1 + 0.2 = 0.3 exactly');
eq(driverCost(d, '2026-10-01', '2026-10-31'), 12498.9, 'october driver cost: 2500 + 300.1 - 0.2 - 300 + other 9999');
eq(driverCost(d, '2026-09-01', '2026-09-30'), 2500, 'september driver cost');
console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);
