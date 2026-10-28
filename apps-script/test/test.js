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
r=call({action:'remove',token:A,table:'cars',id:car});ok(!r.ok,'car w/ money not deletable');
r=call({action:'remove',token:A,table:'cars',id:car2});ok(r.ok,'empty car deleted');
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
r=call({action:'uploadFile',token:A2,id:doc.id,name:'new.jpg',mimeType:'image/jpeg',base64:'data:image/jpeg;base64,'+Buffer.from('jpg!').toString('base64')});ok(r.ok&&r.data.file_id!==f1&&ctx.DriveApp._files[f1].trashed,'replace file trashes old one');
r=call({action:'save',token:A2,table:'car_documents',row:{id:doc.id,file_id:'hack',notes:'x'}});ok(r.ok&&r.data.file_id!=='hack','file fields cannot be overwritten by save');
r=call({action:'uploadFile',token:A2,id:doc.id,name:'big.bin',base64:Buffer.alloc(11*1024*1024).toString('base64')});ok(!r.ok&&/too big/.test(r.error),'10 MB limit');
const D2=call({action:'login',username:'rahim',password:'driver1'});
// driver doc
r=call({action:'save',token:A2,table:'car_documents',row:{driver_id:drv,doc_type:'Iqama',expiry_date:'2027-05-05'}});ok(r.ok&&r.data.driver_name,'driver document saved');
r=call({action:'save',token:A2,table:'car_documents',row:{doc_type:'Other'}});ok(!r.ok,'document needs car or driver');
r=call({action:'removeFile',token:A2,id:doc.id});ok(r.ok&&!r.data.file_id,'remove file');
}

console.log(fails?fails+' FAILED':'ALL PASSED');
