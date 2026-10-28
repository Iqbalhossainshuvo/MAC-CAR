// Runs Code.gs against an in-memory fake of Google Sheets / Apps Script services.
// Usage: node apps-script/test/test.js apps-script/Code.gs
const {ctx,call,sheets}=require('./harness');
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok',m)};
const msg=ctx.setup();const pw=msg.match(/password: (\S+)/)[1];
let r=call({action:'login',username:'admin',password:'bad'});ok(!r.ok,'bad pw rejected');
r=call({action:'login',username:'ADMIN',password:pw});ok(r.ok,'admin login');const A=r.data.token;
r=call({action:'save',token:A,table:'cars',row:{plate_no:'ABC 1',status:'active',year:'2020'}});ok(r.ok&&r.data.year===2020,'car saved');const car=r.data.id;
r=call({action:'save',token:A,table:'cars',row:{plate_no:'abc 1',status:'active'}});ok(!r.ok,'dup plate blocked');
r=call({action:'save',token:A,table:'cars',row:{plate_no:'XYZ 2',status:'active'}});const car2=r.data.id;
r=call({action:'saveUser',token:A,user:{username:'Karim',full_name:'Karim Uddin',password:'secret1',role:'driver',phone:'0555'}});ok(r.ok&&!r.data.password_hash,'driver created, no hash leak');const drv=r.data.id;
r=call({action:'save',token:A,table:'assignments',row:{car_id:car,driver_id:drv,start_date:'2020-01-01'}});ok(r.ok&&r.data.car_plate==='ABC 1'&&r.data.driver_name==='Karim Uddin','assignment w/ helper cols');
r=call({action:'save',token:A,table:'car_documents',row:{car_id:car,doc_type:'Istimara',expiry_date:'2027-01-01'}});ok(r.ok,'doc');
r=call({action:'save',token:A,table:'incomes',row:{car_id:car,amount:5000,income_date:'2026-10-01',payment_status:'paid',customer_name:'ACME'}});ok(r.ok,'income');
r=call({action:'save',token:A,table:'expenses',row:{car_id:car,category:'fuel',amount:'x',expense_date:'2026-10-01',paid_by:'company',status:'approved'}});ok(!r.ok,'bad number rejected');
r=call({action:'save',token:A,table:'expenses',row:{car_id:car,category:'fuel',amount:100,expense_date:'2026/10/01',paid_by:'company',status:'approved'}});ok(!r.ok,'bad date rejected');
r=call({action:'login',username:'karim',password:'secret1'});ok(r.ok&&r.data.user.role==='driver','driver login');const D=r.data.token;
r=call({action:'data',token:D});ok(r.ok&&r.data.cars.length===1&&r.data.incomes.length===0&&r.data.profiles.length===1&&r.data.docs.length===1,'driver data filtered');
r=call({action:'save',token:D,table:'expenses',row:{car_id:car,category:'fine',amount:300,expense_date:'2026-10-02',status:'approved',driver_id:'someone',odometer:12000}});ok(r.ok&&r.data.status==='pending'&&r.data.driver_id===drv,'driver expense forced pending/own');const exp=r.data.id;
r=call({action:'save',token:D,table:'expenses',row:{car_id:car2,category:'fuel',amount:50,expense_date:'2026-10-02'}});ok(!r.ok,'driver other car blocked');
r=call({action:'save',token:D,table:'incomes',row:{car_id:car,amount:1,income_date:'2026-10-02',payment_status:'paid'}});ok(!r.ok,'driver income blocked');
r=call({action:'save',token:D,table:'expenses',row:{id:exp,amount:1}});ok(!r.ok,'driver edit blocked');
r=call({action:'saveUser',token:D,user:{id:drv,role:'admin',phone:'0999'}});ok(r.ok&&r.data.role==='driver'&&r.data.phone==='0999','driver no escalation');
r=call({action:'saveUser',token:D,user:{username:'x',full_name:'x',password:'123456'}});ok(!r.ok,'driver cannot create user');
r=call({action:'save',token:D,table:'daily_logs',row:{car_id:car,log_date:'2026-10-02',start_odometer:12000,end_odometer:12500,work_details:'trips'}});ok(r.ok,'driver log');
r=call({action:'data',token:A});ok(r.data.cars.find(c=>c.id===car).current_odometer===12500,'odometer bumped');
ok(r.data.profiles.every(p=>!p.password_hash&&!p.salt),'no hashes in admin data');
r=call({action:'save',token:A,table:'expenses',row:{id:exp,status:'approved'}});ok(r.ok&&r.data.status==='approved'&&r.data.amount===300,'admin approves');
r=call({action:'remove',token:A,table:'cars',id:car2});ok(r.ok&&r.data.archived===true,'delete = archive (car hidden, not erased)');
ok(sheets['Cars'].data.some(x=>x[1]==='XYZ 2'),'archived car still in the sheet');
r=call({action:'save',token:A,table:'cars',row:{plate_no:'XYZ 2',status:'active'}});ok(r.ok,'plate of archived car can be reused');const car3=r.data.id;
r=call({action:'restore',token:A,table:'cars',id:car2});ok(!r.ok&&/Another car/.test(r.error),'restore blocked while plate is taken');
call({action:'remove',token:A,table:'cars',id:car3});
r=call({action:'restore',token:A,table:'cars',id:car2});ok(r.ok&&r.data.archived===false,'restore archived car');
r=call({action:'saveUser',token:A,user:{id:drv,full_name:'Karim U'}});
ok(sheets['Expenses'].data[1][4]==='Karim U','driver name synced in sheet');
r=call({action:'saveUser',token:A,user:{id:drv,active:false}});r=call({action:'data',token:D});ok(!r.ok,'inactive driver blocked');
r=call({action:'data',token:A.replace(/.$/,'x')});ok(!r.ok,'tampered token rejected');
ctx._props.GOOGLE_CLIENT_ID='cid';ctx._google={aud:'cid',email:'Owner@gmail.com',email_verified:'true',name:'Owner'};
r=call({action:'googleLogin',credential:'t'});ok(r.ok&&r.data.user.role==='admin','owner google login');
ctx._google={aud:'cid',email:'stranger@gmail.com',email_verified:'true'};r=call({action:'googleLogin',credential:'t'});ok(!r.ok,'stranger google blocked');

// --- password recovery via the set_password column
r=call({action:'login',username:'nobody',password:'x'});ok(!r.ok&&/not found/.test(r.error),'unknown username message');
r=call({action:'login',username:'admin',password:'bad'});ok(!r.ok&&/Wrong password/.test(r.error),'wrong password message');
{const sh=sheets['Users'];const head=sh.data[0];const ci=head.indexOf('set_password');const ri=sh.data.findIndex(x=>x[1]==='admin');sh.data[ri][ci]=123456;}
r=call({action:'login',username:'admin',password:'123456'});ok(r.ok,'set_password from sheet works (number cell)');
{const sh=sheets['Users'];const ci=sh.data[0].indexOf('set_password');const ri=sh.data.findIndex(x=>x[1]==='admin');ok(sh.data[ri][ci]==='','set_password cleared after use');}
r=call({action:'login',username:'admin',password:'123456 '});ok(r.ok,'trailing space tolerated');
r=call({action:'data',token:r.data.token});ok(r.ok&&r.data.profiles.every(p=>!('set_password' in p)),'set_password never sent to app');


// --- files on documents (Google Drive)
{
const A2=call({action:'login',username:'admin',password:'123456'}).data.token;
const docs=call({action:'data',token:A2}).data.docs;const doc=docs[0];
const b64=Buffer.from('hello pdf').toString('base64');
r=call({action:'uploadFile',token:A2,id:doc.id,name:'istimara.pdf',mimeType:'application/pdf',base64:b64});ok(r.ok&&r.data.file_id&&r.data.file_size===9&&r.data.file_name==='istimara.pdf','upload file');
const f1=r.data.file_id;
r=call({action:'getFile',token:A2,id:doc.id});ok(r.ok&&Buffer.from(r.data.base64,'base64').toString()==='hello pdf'&&r.data.mimeType==='application/pdf','download file');
r=call({action:'uploadFile',token:A2,id:doc.id,name:'new.jpg',mimeType:'image/jpeg',base64:'data:image/jpeg;base64,'+Buffer.from('jpg!').toString('base64')});ok(r.ok&&r.data.file_id!==f1&&!ctx.DriveApp._files[f1].trashed&&/^\[replaced\]/.test(ctx.DriveApp._files[f1].name),'replace keeps old file in Drive (renamed)');
r=call({action:'save',token:A2,table:'car_documents',row:{id:doc.id,file_id:'hack',notes:'x'}});ok(r.ok&&r.data.file_id!=='hack','file fields cannot be overwritten by save');
r=call({action:'uploadFile',token:A2,id:doc.id,name:'big.bin',base64:Buffer.alloc(11*1024*1024).toString('base64')});ok(!r.ok&&/too big/.test(r.error),'10 MB limit');
const D2=call({action:'login',username:'rahim',password:'driver1'});
// driver doc
r=call({action:'save',token:A2,table:'car_documents',row:{driver_id:drv,doc_type:'Iqama',expiry_date:'2027-05-05'}});ok(r.ok&&r.data.driver_name,'driver document saved');
r=call({action:'save',token:A2,table:'car_documents',row:{doc_type:'Other'}});ok(!r.ok,'document needs car or driver');
{const fid=call({action:'data',token:A2}).data.docs.find(x=>x.id===doc.id).file_id;
r=call({action:'removeFile',token:A2,id:doc.id});ok(r.ok&&!r.data.file_id&&!ctx.DriveApp._files[fid].trashed,'remove file detaches it but keeps it in Drive');}
}

// --- salary account (payroll)
{
const A3=call({action:'login',username:'admin',password:'123456'}).data.token;
const rah=call({action:'saveUser',token:A3,user:{username:'rahim',full_name:'Rahim Mia',password:'driver1',role:'driver'}}).data;
call({action:'save',token:A3,table:'assignments',row:{car_id:car,driver_id:rah.id,start_date:'2020-01-01'}});
const cars0=car;
r=call({action:'saveUser',token:A3,user:{id:rah.id,monthly_salary:'2500.555'}});ok(r.ok&&r.data.monthly_salary===2500.56,'monthly salary saved and rounded');
const P=(row)=>call({action:'save',token:A3,table:'payroll',row:Object.assign({driver_id:rah.id,entry_date:'2026-10-31'},row)});
r=P({type:'salary',amount:2500,month:'2026-10'});ok(r.ok&&r.data.driver_name==='Rahim Mia','salary entry');
r=P({type:'salary',amount:2500,month:'2026-10'});ok(!r.ok&&/already added/.test(r.error),'same month salary blocked');
r=P({type:'salary',amount:2500});ok(!r.ok&&/month/.test(r.error),'salary needs month');
r=P({type:'advance',amount:0});ok(!r.ok,'zero amount blocked');
r=P({type:'advance',amount:-50});ok(!r.ok,'negative amount blocked');
r=P({type:'advance',amount:700,method:'cash'});ok(r.ok,'advance entry');
r=P({type:'bonus',amount:'100.1'});ok(r.ok&&r.data.amount===100.1,'bonus entry');
r=P({type:'loan',amount:5});ok(!r.ok,'unknown type blocked');
r=call({action:'save',token:A3,table:'payroll',row:{driver_id:call({action:'data',token:A3}).data.profiles.find(p=>p.role==='admin').id,type:'bonus',amount:1,entry_date:'2026-10-01'}});ok(!r.ok,'payroll only for drivers');
const R=call({action:'login',username:'rahim',password:'driver1'}).data.token;
r=call({action:'data',token:R});ok(r.ok&&r.data.payroll.length===3&&r.data.payroll.every(x=>x.driver_id===rah.id),'driver sees own salary account');
r=call({action:'save',token:R,table:'payroll',row:{driver_id:rah.id,type:'bonus',amount:9999,entry_date:'2026-10-01'}});ok(!r.ok,'driver cannot add salary entries');
r=call({action:'save',token:R,table:'expenses',row:{car_id:cars0,category:'fine',amount:150,expense_date:'2026-10-05',paid_by:'company',waived:true}});ok(r.ok&&r.data.waived!==true,'driver cannot waive own fine');
r=call({action:'save',token:A3,table:'expenses',row:{id:r.data.id,waived:true,status:'approved'}});ok(r.ok&&r.data.waived===true,'admin waives fine');
r=call({action:'saveUser',token:A3,user:{id:rah.id,full_name:'Rahim Uddin Mia'}});ok(sheets['Payroll'].data.slice(1).every(x=>x[2]==='Rahim Uddin Mia'),'payroll names follow renames');
}

// --- archive + receipts
{
const A4=call({action:'login',username:'admin',password:'123456'}).data.token;
const R4=call({action:'login',username:'rahim',password:'driver1'}).data.token;
const rah=call({action:'data',token:A4}).data.profiles.find(p=>p.username==='rahim');
// salary archived -> the month can be added again; restoring the old one is blocked
const sal=call({action:'data',token:A4}).data.payroll.find(x=>x.type==='salary'&&x.driver_id===rah.id);
r=call({action:'remove',token:A4,table:'payroll',id:sal.id});ok(r.ok&&r.data.archived,'salary entry archived');
r=call({action:'data',token:R4});ok(!r.data.payroll.some(x=>x.id===sal.id),'driver no longer sees archived entry');
r=call({action:'save',token:A4,table:'payroll',row:{driver_id:rah.id,type:'salary',month:sal.month,amount:2600,entry_date:'2026-10-31'}});ok(r.ok,'same month can be added after archiving the old one');
r=call({action:'restore',token:A4,table:'payroll',id:sal.id});ok(!r.ok&&/already added/.test(r.error),'restoring would duplicate the month: blocked');
// receipts
r=call({action:'save',token:R4,table:'expenses',row:{car_id:car,category:'fuel',amount:80,expense_date:'2026-10-20',paid_by:'driver'}});const ex=r.data.id;
const img=Buffer.from('receipt-image').toString('base64');
r=call({action:'uploadFile',token:R4,table:'expenses',id:ex,name:'bill.jpg',mimeType:'image/jpeg',base64:img});ok(r.ok&&r.data.file_name==='bill.jpg','driver uploads receipt to own expense');
const K4=call({action:'login',username:'karim',password:'secret1'});
r=call({action:'getFile',token:A4,table:'expenses',id:ex});ok(r.ok&&Buffer.from(r.data.base64,'base64').toString()==='receipt-image','admin downloads receipt');
r=call({action:'getFile',token:R4,table:'expenses',id:ex});ok(r.ok,'driver views own receipt');
const other=call({action:'save',token:A4,table:'expenses',row:{car_id:car,category:'repair',amount:10,expense_date:'2026-10-20',paid_by:'company',status:'approved'}}).data.id;
r=call({action:'uploadFile',token:R4,table:'expenses',id:other,name:'x.jpg',mimeType:'image/jpeg',base64:img});ok(!r.ok,'driver cannot upload to someone else\'s expense');
r=call({action:'getFile',token:R4,table:'expenses',id:other});ok(!r.ok,'driver cannot open someone else\'s receipt');
r=call({action:'uploadFile',token:A4,table:'expenses',id:other,name:'inv.pdf',mimeType:'application/pdf',base64:img});ok(r.ok,'admin uploads receipt to any expense');
call({action:'save',token:A4,table:'expenses',row:{id:ex,status:'approved'}});
r=call({action:'removeFile',token:R4,table:'expenses',id:ex});ok(!r.ok,'driver cannot remove receipt after approval');
r=call({action:'uploadFile',token:R4,table:'cars',id:car,name:'x',base64:img});ok(!r.ok,'files only on documents and expenses');
// driver deletes own pending expense = archived, admin still sees it
const p2=call({action:'save',token:R4,table:'expenses',row:{car_id:car,category:'wash',amount:20,expense_date:'2026-10-21',paid_by:'driver'}}).data.id;
r=call({action:'remove',token:R4,table:'expenses',id:p2});ok(r.ok,'driver removes own pending expense');
ok(call({action:'data',token:A4}).data.expenses.find(x=>x.id===p2).archived===true,'admin can still see it in the archive');
ok(!call({action:'data',token:R4}).data.expenses.some(x=>x.id===p2),'driver does not see archived expense');
}

// --- manager (admin assistant) with limited permissions
{
const A5=call({action:'login',username:'admin',password:'123456'}).data.token;
const all=call({action:'data',token:A5}).data;
const rah=all.profiles.find(p=>p.username==='rahim');const adminU=all.profiles.find(p=>p.role==='admin');
r=call({action:'saveUser',token:A5,user:{username:'sumon',full_name:'Sumon Manager',password:'manager1',role:'manager',permissions:'cars:edit, expenses:view ,approve,bogus,salary:hack'}});
ok(r.ok&&r.data.role==='manager'&&r.data.permissions==='cars:edit,expenses:view,salary:view,approve','manager created, permissions cleaned');const mgr=r.data.id;
const M=call({action:'login',username:'sumon',password:'manager1'});ok(M.ok&&M.data.user.permissions,'manager login gets permissions');const MT=M.data.token;
let d=call({action:'data',token:MT}).data;
ok(d.incomes.length===0,'no income permission: no income data');
ok(d.expenses.length>0&&d.payroll.length>0,'expenses + salary view: data sent');
ok(d.expenses.every(x=>!x.archived),'no archive permission: archived rows hidden');
ok(d.profiles.find(p=>p.id===rah.id).iqama_no===undefined&&!('license_no' in d.profiles.find(p=>p.id===rah.id)),'no drivers permission: driver details stripped');
ok(!('email' in d.profiles.find(p=>p.id===adminU.id)),'admin profile minimal for manager');
ok(d.docs.every(x=>x.car_id),'only car documents (no drivers permission)');
r=call({action:'save',token:MT,table:'cars',row:{plate_no:'MGR 9',status:'active'}});ok(r.ok,'manager with cars:edit adds car');const mcar=r.data.id;
r=call({action:'save',token:MT,table:'incomes',row:{car_id:mcar,amount:10,income_date:'2026-10-01',payment_status:'paid'}});ok(!r.ok&&/permission/.test(r.error),'manager without income blocked');
r=call({action:'save',token:MT,table:'expenses',row:{car_id:mcar,category:'fuel',amount:10,expense_date:'2026-10-01',paid_by:'company',status:'approved'}});ok(!r.ok,'expenses view only: cannot add');
r=call({action:'save',token:MT,table:'payroll',row:{driver_id:rah.id,type:'bonus',amount:5,entry_date:'2026-10-01'}});ok(!r.ok,'salary view only: cannot add');
const pend=call({action:'save',token:call({action:'login',username:'rahim',password:'driver1'}).data.token,table:'expenses',row:{car_id:car,category:'toll',amount:15,expense_date:'2026-10-22',paid_by:'driver'}}).data.id;
r=call({action:'save',token:MT,table:'expenses',row:{id:pend,status:'approved'}});ok(r.ok&&r.data.status==='approved','manager with approve approves');
r=call({action:'save',token:MT,table:'expenses',row:{id:pend,amount:999}});ok(!r.ok,'approve only: cannot change the amount');
r=call({action:'remove',token:MT,table:'expenses',id:pend});ok(!r.ok,'expenses view only: cannot delete');
r=call({action:'restore',token:MT,table:'cars',id:car2});ok(!r.ok,'no archive permission: cannot restore');
r=call({action:'saveUser',token:MT,user:{username:'x2',full_name:'X',password:'123456'}});ok(!r.ok,'no logins permission: cannot create users');
r=call({action:'saveUser',token:MT,user:{id:mgr,role:'admin',permissions:'income:edit',phone:'011'}});ok(r.ok&&r.data.role==='manager'&&r.data.permissions==='cars:edit,expenses:view,salary:view,approve'&&r.data.phone==='011','manager cannot raise own access');
// second manager: expenses edit without approve, logins, archive, drivers
r=call({action:'saveUser',token:A5,user:{username:'nila',full_name:'Nila',password:'manager2',role:'manager',permissions:'expenses:edit,drivers:edit,logins,archive'}});const m2=r.data.id;
const N=call({action:'login',username:'nila',password:'manager2'}).data.token;
r=call({action:'save',token:N,table:'expenses',row:{car_id:car,category:'repair',amount:40,expense_date:'2026-10-23',paid_by:'company',status:'approved',waived:true}});ok(r.ok&&r.data.status==='pending'&&!r.data.waived,'no approve: own expense saved as pending');const ne=r.data.id;
r=call({action:'save',token:N,table:'expenses',row:{id:ne,amount:45}});ok(r.ok&&r.data.amount===45,'edit pending expense');
r=call({action:'save',token:N,table:'expenses',row:{id:ne,status:'approved'}});ok(!r.ok,'no approve: cannot approve');
r=call({action:'save',token:N,table:'expenses',row:{id:pend,amount:1}});ok(!r.ok,'no approve: cannot change an approved expense');
r=call({action:'saveUser',token:N,user:{username:'newdrv',full_name:'New Driver',password:'123456',role:'admin',monthly_salary:9000}});ok(!r.ok,'manager cannot create an admin');
r=call({action:'saveUser',token:N,user:{username:'newdrv',full_name:'New Driver',password:'123456',monthly_salary:9000}});ok(r.ok&&r.data.role==='driver'&&!r.data.monthly_salary,'manager with logins creates driver (salary needs salary:edit)');
r=call({action:'saveUser',token:N,user:{id:r.data.id,password:'abcdef'}});ok(r.ok&&call({action:'login',username:'newdrv',password:'abcdef'}).ok,'manager resets driver password');
r=call({action:'saveUser',token:N,user:{id:adminU.id,password:'hacked1'}});ok(!r.ok,'manager cannot touch admin');
r=call({action:'saveUser',token:N,user:{id:mgr,active:false}});ok(!r.ok,'manager cannot touch another manager');
d=call({action:'data',token:N}).data;ok(d.expenses.some(x=>x.archived)&&d.payroll.length===0,'archive permission shows archived; no salary data');
ok(d.profiles.find(p=>p.id===rah.id).monthly_salary===undefined,'salary hidden without salary permission');
r=call({action:'restore',token:N,table:'cars',id:car3});ok(!r.ok,'archive but no cars:edit: cannot restore a car');
r=call({action:'save',token:N,table:'car_documents',row:{driver_id:rah.id,doc_type:'License'}});ok(r.ok,'drivers:edit adds driver document');
r=call({action:'save',token:N,table:'car_documents',row:{car_id:car,doc_type:'Insurance'}});ok(!r.ok,'no cars:edit: cannot add car document');
r=call({action:'saveUser',token:A5,user:{id:mgr,active:false}});ok(!call({action:'data',token:MT}).ok,'deactivated manager blocked');
}

// --- salary structure
{
const A6=call({action:'login',username:'admin',password:'123456'}).data.token;
const rah=call({action:'data',token:A6}).data.profiles.find(p=>p.username==='rahim');
r=call({action:'saveUser',token:A6,user:{id:rah.id,basic_salary:2000,food_allowance:'300.25',housing_allowance:500}});
ok(r.ok&&r.data.monthly_salary===2800.25&&r.data.food_allowance===300.25,'monthly salary = basic + food + housing');
r=call({action:'saveUser',token:A6,user:{id:rah.id,housing_allowance:null}});ok(r.ok&&r.data.monthly_salary===2300.25,'total follows changes');
const R6=call({action:'login',username:'rahim',password:'driver1'}).data.token;
const me=call({action:'data',token:R6}).data.me;ok(me.basic_salary===2000&&me.food_allowance===300.25,'driver sees own salary structure');
r=call({action:'saveUser',token:R6,user:{id:rah.id,basic_salary:99999}});ok(r.ok&&r.data.basic_salary===2000,'driver cannot change salary');
r=call({action:'saveUser',token:A6,user:{username:'newbie',full_name:'New Bie',password:'123456',role:'driver',basic_salary:1500,food_allowance:200}});ok(r.ok&&r.data.monthly_salary===1700,'new driver total computed');
}

console.log(fails?fails+' FAILED':'ALL PASSED');
