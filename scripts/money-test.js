// Random tests of all money math (salary, company cash, partners). Run: npm run test:money
const dir=require('path').resolve(process.argv[2]||'.money-test');
const {partnerAccount,carSplit,shareCents,partnersShare}=require(dir+'/partners.js');const {cashAccount,driverAccount,salaryDues}=require(dir+'/payroll.js');const {toCents,fromCents,today}=require(dir+'/format.js');
let fails=0;const bad=m=>{if(fails<8)console.log('FAIL',m);fails++};const R=n=>Math.floor(Math.random()*n);const amt=()=>Number((R(900000)/100).toFixed(2));
const now=today();const cm=now.slice(0,7);
const mo=()=>`2026-${String(1+R(Number(cm.slice(5)))).padStart(2,'0')}`;const day=m=>`${m}-${String(1+R(28)).padStart(2,'0')}`;
for(let it=0;it<1500;it++){
 const cars=[{id:'c1',plate_no:'A'},{id:'c2',plate_no:'B'}];
 const incomes=[],expenses=[];for(let i=0;i<R(30);i++){incomes.push({id:'i'+i,car_id:cars[R(2)].id,amount:amt(),income_date:day(mo())});}
 for(let i=0;i<R(30);i++){expenses.push({id:'e'+i,car_id:cars[R(2)].id,amount:amt(),expense_date:day(mo()),status:['approved','pending','rejected'][R(3)],category:'fuel',paid_by:['company','cash','driver'][R(3)],driver_id:'d'});}
 const p1=40+R(30),p2=R(100-p1)+0.5;const shares=[{id:'s1',car_id:'c1',partner_id:'P',share_percent:p1,fee_percent:R(3)*5,start_date:'2026-01-01',end_date:null},{id:'s2',car_id:'c1',partner_id:'Q',share_percent:p2,fee_percent:0,start_date:'2026-03-15',end_date:null},{id:'s3',car_id:'c2',partner_id:'P',share_percent:100,fee_percent:10,start_date:'2026-02-01',end_date:'2026-06-30'}];
 const partnerLedger=[];for(let i=0;i<R(8);i++)partnerLedger.push({id:'l'+i,partner_id:'P',type:['payout','adjust_add','adjust_less'][R(3)],amount:amt(),entry_date:day(mo()),car_id:null});
 const d={cars,incomes,expenses,shares,partnerLedger};
 // split: company + partners = profit exactly
 const months=['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06'].filter(m=>m<=cm);
 for(const sp of [...carSplit(d,'c1',months),...carSplit(d,'c2',months)]){const sum=toCents(sp.company)+sp.parts.reduce((c,x)=>c+toCents(x.amount),0);if(sum!==toCents(sp.profit))bad('split '+sp.month);
   if(toCents(sp.profit)!==toCents(sp.income)-toCents(sp.expense))bad('profit');}
 // partner balance = Σ parts − payouts + adj
 const acc=partnerAccount(d,'P',now);let c=0;
 for(const s of shares.filter(s=>s.partner_id==='P')){for(const sp of carSplit(d,s.car_id,monthsAll(s.start_date,s.end_date))){const x=sp.parts.find(p=>p.share.id===s.id);if(x)c+=toCents(x.amount);}}
 for(const l of partnerLedger)c+=(l.type==='adjust_add'?1:-1)*toCents(l.amount);
 if(toCents(acc.balance)!==c)bad('partner balance '+acc.balance+' vs '+fromCents(c));
 let prev=0;for(const m of [...acc.months].reverse()){if(toCents(m.opening)!==prev)bad('p opening');const cl=prev+toCents(m.share)-toCents(m.paid)+toCents(m.adjust);if(cl!==toCents(m.closing))bad('p closing');prev=cl;}
 const du=acc.dues;if(toCents(du.payable)-toCents(du.owes)!==c)bad('partner dues');
 // partnersShare(all) = Σ all partners' parts
 const all=['P','Q'].reduce((t,p)=>t+partnerAccount({...d,partnerLedger:[]},p,now).lines.reduce((s,l)=>s+l.sign*toCents(l.amount),0),0);
 if(toCents(partnersShare(d))!==all)bad('partnersShare '+partnersShare(d)+' vs '+fromCents(all));
 // cash: balance identity
 const cash=[];for(let i=0;i<R(8);i++)cash.push({id:'k'+i,driver_id:'d',type:['given','returned','to_salary','from_salary'][R(4)],amount:amt(),entry_date:day(mo())});
 const ca=cashAccount({expenses,cash},'d');let k=0;for(const x of cash)k+=(x.type==='given'||x.type==='from_salary'?1:-1)*toCents(x.amount);for(const e of expenses)if(e.paid_by==='cash'&&e.status!=='rejected')k-=toCents(e.amount);
 if(toCents(ca.balance)!==k)bad('cash balance');
 // salary account includes cash settlements and cash-paid fines
 const da=driverAccount({payroll:[],expenses,cash},'d');let sc=0;for(const x of cash){if(x.type==='to_salary')sc-=toCents(x.amount);if(x.type==='from_salary')sc+=toCents(x.amount);}
 for(const e of expenses){if(e.status!=='approved')continue;if(e.paid_by==='driver')sc+=toCents(e.amount);}
 if(toCents(da.balance)!==sc)bad('salary with cash '+da.balance+' vs '+fromCents(sc));
}
function monthsAll(s,e){const out=[];let [y,m]=s.slice(0,7).split('-').map(Number);const last=e&&e.slice(0,7)<cm?e.slice(0,7):cm;while(`${y}-${String(m).padStart(2,'0')}`<=last){out.push(`${y}-${String(m).padStart(2,'0')}`);m++;if(m>12){m=1;y++}}return out;}
// worked example: profit 1000, fee 10%, share 60% → 540; company 460
const ex=carSplit({incomes:[{car_id:'c',amount:1500,income_date:'2026-05-03'}],expenses:[{car_id:'c',amount:500,expense_date:'2026-05-09',status:'approved'}],shares:[{id:'x',car_id:'c',partner_id:'P',share_percent:60,fee_percent:10,start_date:'2026-05-01'}],partnerLedger:[],cars:[]},'c',['2026-05'])[0];
if(ex.parts[0].amount!==540||ex.company!==460){console.log('FAIL example',JSON.stringify(ex));fails++}
console.log(fails?fails+' FAILED':'ALL PASSED (1500 random fleets)');
// salary account: months chain, dues, waive add-back
{
const types=['salary','bonus','advance','deduction','payment','refund'];const sign={salary:1,bonus:1,refund:1,advance:-1,deduction:-1,payment:-1};
let f2=0;
for(let it=0;it<2000;it++){
 const payroll=[],expenses=[];
 for(let i=0;i<R(25);i++){const t=types[R(6)];const m=`2026-${String(1+R(10)).padStart(2,'0')}`;payroll.push({id:'p'+i,driver_id:'d',type:t,amount:amt(),entry_date:day(m),month:t==='salary'?m:null,created_at:String(i)});}
 for(let i=0;i<R(12);i++){expenses.push({id:'e'+i,driver_id:R(5)?'d':'x',category:R(2)?'fine':'fuel',amount:amt(),expense_date:day(`2026-0${1+R(9)}`),status:['approved','pending','rejected'][R(3)],paid_by:['company','driver','cash'][R(3)],waived:!R(3)});}
 const acc=driverAccount({payroll,expenses},'d');let c=0;
 for(const p of payroll)c+=sign[p.type]*toCents(p.amount);
 for(const e of expenses){if(e.driver_id!=='d'||e.status!=='approved')continue;if(e.category==='fine'){if(e.paid_by!=='driver'&&!e.waived)c-=toCents(e.amount)}else if(e.paid_by==='driver')c+=toCents(e.amount);}
 if(toCents(acc.balance)!==c){f2++;continue}
 let prev=0;for(const m of [...acc.months].reverse()){if(toCents(m.opening)!==prev)f2++;prev=toCents(m.closing);}
 const du=salaryDues(acc,'2026-11');if(toCents(du.payable)-toCents(du.owes)!==c)f2++;
}
if(f2){console.log('FAIL salary',f2);fails+=f2}else console.log('ok salary accounts (2000 random)');
}
process.exitCode=fails?1:0;
