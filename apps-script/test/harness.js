const fs=require('fs'),vm=require('vm'),crypto=require('crypto');
const sheets={};
function mkSheet(name){const data=[];let hidden=[];return{name,data,
 getRange(r,c,nr=1,nc=1){const sh=this;return{
  getValues(){const out=[];for(let i=0;i<nr;i++){const row=[];for(let j=0;j<nc;j++){const v=(data[r-1+i]||[])[c-1+j];row.push(v===undefined?'':v)}out.push(row)}return out},
  setValues(v){for(let i=0;i<nr;i++){data[r-1+i]=data[r-1+i]||[];for(let j=0;j<nc;j++)data[r-1+i][c-1+j]=v[i][j]}return this},
  setValue(v){data[r-1]=data[r-1]||[];data[r-1][c-1]=v;return this},
  setNumberFormats(){return this},setFontWeight(){return this},setBackground(){return this},setFontColor(){return this}}},
 getLastRow(){return data.length},getLastColumn(){return data.reduce((m,r)=>Math.max(m,r.length),0)},
 setFrozenRows(){},hideColumns(){},deleteRow(i){data.splice(i-1,1)}}}
const ctx={console,JSON,Date,Math,String,Number,Object,Array,isNaN,encodeURIComponent,
 SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:n=>sheets[n]||null,insertSheet:n=>(sheets[n]=mkSheet(n))}),flush(){}},
 Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},
  computeDigest:(a,v)=>Array.from(crypto.createHash('sha256').update(typeof v==='string'?Buffer.from(v):Buffer.from(v.map(b=>b&255))).digest()).map(b=>b>127?b-256:b),
  newBlob:function mkBlob(x,type,name){const bl={getBytes:()=>Array.isArray(x)?x:Array.from(Buffer.from(x)),getDataAsString:()=>Buffer.from(x.map?x.map(b=>b&255):x).toString(),getContentType:()=>type,getName:()=>name,setName(n){name=n;return bl},getAs:(t)=>mkBlob(x,t,name)};return bl},
  base64Decode:s=>Array.from(Buffer.from(s,'base64')).map(b=>b>127?b-256:b),
  base64Encode:b=>Buffer.from(b.map(x=>x&255)).toString('base64'),
  base64EncodeWebSafe:b=>(typeof b==='string'?Buffer.from(b):Buffer.from(b.map(x=>x&255))).toString('base64').replace(/\+/g,'-').replace(/\//g,'_'),
  base64DecodeWebSafe:s=>Array.from(Buffer.from(s.replace(/-/g,'+').replace(/_/g,'/'),'base64')),
  computeHmacSha256Signature:(t,k)=>Array.from(crypto.createHmac('sha256',k).update(t).digest()),
  formatDate:(d,tz,f)=>d.toISOString().slice(0,10)},
 PropertiesService:{getScriptProperties:()=>({_p:ctx._props,getProperty(k){return this._p[k]||null},setProperty(k,v){this._p[k]=v}})},_props:{},
 Session:{getEffectiveUser:()=>({getEmail:()=>'owner@gmail.com'}),getScriptTimeZone:()=>'UTC'},
 LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
 ContentService:{MimeType:{JSON:'json'},createTextOutput:t=>({setMimeType(){return t}})},
 Logger:{log:m=>console.log('LOG:',m)},
 DriveApp:(()=>{const files={};let n=0;const mkFile=(blob)=>{const id='f'+(++n);const f={id,blob,trashed:false,name:blob.getName?blob.getName():'file',getId:()=>id,setTrashed(t){f.trashed=t},getBlob:()=>blob,getName:()=>f.name,setName(n){f.name=n}};files[id]=f;return f};
  const folder={getId:()=>'folder1',isTrashed:()=>false,createFile:(b)=>mkFile(b)};
  return {_files:files,createFolder:()=>folder,getFolderById:()=>folder,getFileById:(id)=>{if(!files[id])throw new Error('no file');return files[id]}}})(),
 UrlFetchApp:{fetch:(url,opt)=>{if(ctx._fetch)return ctx._fetch(url,opt);return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(ctx._google)}}},_google:{},
 ScriptApp:{_t:[],getProjectTriggers(){return this._t},deleteTrigger(t){this._t=this._t.filter(x=>x!==t)},newTrigger(h){const S=this;const t={h,getHandlerFunction:()=>h};const b={timeBased:()=>b,atHour:(x)=>{t.hour=x;return b},everyDays:()=>b,inTimezone:()=>b,create:()=>{S._t.push(t);return t}};return b}},
 Charts:{ColumnType:{STRING:'s'},newDataTable(){const d={rows:[],addColumn:()=>d,addRow:(r)=>{d.rows.push(r);return d},build:()=>d};return d},newTableChart(){const c={setDataTable:()=>c,setDimensions:()=>c,build:()=>({getAs:(t)=>ctx.Utilities.newBlob('png',t,'chart')})};return c}}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(process.argv[2],'utf8'),ctx);
const call=(b)=>{ctx._cache={};vm.runInContext('_cache={}',ctx);const r=JSON.parse(ctx.doPost({postData:{contents:JSON.stringify(b)}}));return r};
module.exports={ctx,call,sheets};
