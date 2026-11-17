import {norm,parseDate,readDocument} from './hospitalops-import.js';

const required=['Ref','RAJAL','RANAP','ORLA'];
const typeMap={
 'perusahaan':'Perusahaan','asuransi':'Perusahaan','pemerintah':'Instansi','mitra rumah sakit':'Rumah Sakit',
 'sekolah':'Sekolah','pesantren':'Sekolah','organisasi':'Organisasi','yayasan':'Lembaga','yayasan non profit':'Lembaga',
 'club olahraga':'Organisasi','komunitas':'Organisasi','dokter':'Dokter Rujukan','dokter rujukan':'Dokter Rujukan',
 'bidan':'Bidan Rujukan','bidan rujukan':'Bidan Rujukan'
};
const serviceMap={'pa':'Patologi Anatomi (PA)','mikro':'Mikrobiologi','radiologi':'Radiologi',
 'laboratorium':'Laboratorium','medical check up':'MCU'};
const inpatient=new Set(['rawat inap','icu','picu','nicu dan perina ii','nicu','perina']);
const months=['januari','februari','maret','april','mei','juni','juli','agustus','september','oktober','november','desember'];
const english=['january','february','march','april','may','june','july','august','september','october','november','december'];
const str=v=>String(v??'').trim();
const code=v=>str(v).toLowerCase().replace(/\s+/g,' ');
const pair=(...values)=>JSON.stringify(values);
const id=(prefix,list)=>prefix+'-'+(list.length+1);
const order=(a,b)=>a.localeCompare(b);

function field(rows,name,fields,optional=[]){
 const keys=rows[0]?.map(norm)||[];
 const columns={};
 for(const [key,aliases] of Object.entries(fields)){
  const index=keys.findIndex(h=>aliases.includes(h));
  if(index<0&&!optional.includes(key))throw new Error('Header '+aliases[0]+' tidak ditemukan di sheet '+name+'.');
  columns[key]=index;
 }
 return (row,key)=>row[columns[key]];
}
function actualDate(value){
 if(value instanceof Date&&!isNaN(value))return value.toISOString().slice(0,10);
 const raw=str(value);
 const simple=parseDate(raw);
 if(simple)return simple;
 const words=norm(raw).split(' ');
 if(words.length!==3)return '';
 const month=Math.max(months.indexOf(words[1]),english.indexOf(words[1]))+1;
 return month?parseDate(words[2]+'-'+month+'-'+words[0]):'';
}
function tally(map,key,values,date){
 const existing=map.get(key);
 if(existing){
  existing.count++;
  if(date<existing.first)existing.first=date;
  if(date>existing.last)existing.last=date;
 }else map.set(key,{values,count:1,first:date,last:date});
}
function transactions(rows,name){
 const pick=field(rows,name,{
  encounter:['no registrasi','no reg'],date:['tgl masuk formated','tanggal masuk formated'],rawDate:['tgl masuk','tanggal masuk'],
  category:['kategori unit'],unit:['unit'],group:['grup jaminan','group payor'],payer:['penjamin'],
  kind:['jenis'],procedure:['layanan','tindakan'],doctor:['nama dokter','dokter']
 },['date','rawDate','category','kind','procedure','doctor']);
 const seen=new Set();
 return function* (include=()=>true){
  for(const row of rows.slice(1)){
   const encounter=str(pick(row,'encounter'));
   if(!/^\d[\d.\-]*$/.test(encounter)||seen.has(encounter)||!include(row,pick))continue;
   const date=actualDate(pick(row,'date'))||actualDate(pick(row,'rawDate'));
   if(!date)continue;
   seen.add(encounter);
   yield {date,unit:str(pick(row,'unit')),payer:str(pick(row,'payer')),group:str(pick(row,'group')),
    kind:code(pick(row,'kind')),procedure:str(pick(row,'procedure')),doctor:str(pick(row,'doctor'))};
  }
 };
}

export function buildCohortDemo(sections){
 const sheets=new Map(sections.map(s=>[str(s.name).toUpperCase(),s.rows]));
 for(const name of required)if(!sheets.has(name.toUpperCase()))throw new Error('Workbook perlu memuat sheet '+required.join(', ')+'.');
 const ref=sheets.get('REF');
 // Ref has two Penjamin columns. The master sits immediately left of Tipe Penjamin.
 const typeCol=ref[0]?.findIndex(v=>norm(v)==='tipe penjamin')??-1;
 if(typeCol<1||norm(ref[0][typeCol-1])!=='penjamin')throw new Error('Kolom Penjamin dan Tipe Penjamin tidak ditemukan berdampingan di Ref.');
 const partners=[],byName=new Map();
 for(const row of ref.slice(1)){
  const sourceType=str(row[typeCol]),type=typeMap[norm(sourceType)];
  const name=str(row[typeCol-1]),key=code(name);
  if(!name||!type||byName.has(key))continue;
  const partner={id:id('cohort-partner',partners),name,type,sourceType,note:'Sumber Ref · Tipe Penjamin '+sourceType};
  partners.push(partner);
  byName.set(key,partner);
 }
 if(!partners.length)throw new Error('Tidak ada mitra dengan tipe yang dikenali di Ref.');
 const patientMonths={out:{},in:{}},additional=new Map(),referralGroups=new Map();
 let latest='';
 function patients(type,name,include){
  const grouped=new Map();
  for(const row of transactions(sheets.get(name),name)(include)){
   const month=row.date.slice(0,7),fields=[row.unit||'Unit belum tercatat',row.doctor||'—',row.procedure||'—',row.group||'Tidak tercatat'];
   tally(grouped,pair(month,...fields),[month,fields],row.date);
   if(row.date>latest)latest=row.date;
  }
  for(const {values:[month,fields],count} of grouped.values())(patientMonths[type][month]??=[]).push([...fields,count]);
 }
 patients('out','RAJAL',(row,get)=>['rawat jalan','rehabilitasi medik','mcu dan vaksin'].includes(code(get(row,'category'))));
 patients('in','RANAP',(row,get)=>inpatient.has(code(get(row,'category'))));
 for(const row of transactions(sheets.get('ORLA'),'ORLA')()){
  const month=row.date.slice(0,7), service=serviceMap[row.kind]||serviceMap[code(row.unit)]||row.unit||'Lainnya';
  tally(additional,pair(month,service),[month,service,'ORLA'],row.date);
  if(row.date>latest)latest=row.date;
  const partner=byName.get(code(row.payer));
  if(!partner||![serviceMap.pa,serviceMap.mikro,serviceMap.laboratorium,serviceMap.radiologi].includes(service)||
    norm(partner.sourceType)!=='mitra rumah sakit')continue;
  tally(referralGroups,pair(partner.id,service,month),[partner,service,month],row.date);
 }
 if(sheets.has('TK JR')){
  for(const row of transactions(sheets.get('TK JR'),'TK JR')()){
   const month=row.date.slice(0,7);
   tally(additional,pair(month,'TK JR'),[month,'Kunjungan TK / JR','TK JR'],row.date);
  }
 }
 if(!latest||!Object.keys(patientMonths.out).length||!Object.keys(patientMonths.in).length){
  throw new Error('Data kunjungan RAJAL atau RANAP belum dapat dibaca.');
 }
 const pipeline=[],referrals=[],byOpportunity=new Map();
 for(const {values:[partner,service,month],count,first} of [...referralGroups.values()].sort((a,b)=>order(a.first,b.first))){
  const key=pair(partner.id,service);
  if(!byOpportunity.has(key)){
   const opportunity={id:id('cohort-opportunity',pipeline),name:service+' · '+partner.name,partnerId:partner.id,
    partnerType:partner.type,service,owner:'Belum ditetapkan',date:first,status:'Siap Rujuk / Jadwal Layanan',
    note:'Peluang terbentuk dari realisasi ORLA. Nama mitra dicocokkan dengan Penjamin bertipe Mitra Rumah Sakit di Ref.'};
   byOpportunity.set(key,opportunity);
   pipeline.push(opportunity);
  }
  referrals.push({id:id('cohort-referral',referrals),opportunityId:byOpportunity.get(key).id,name:partner.name,
   partnerType:partner.type,service,referralType:'Rujukan pemeriksaan ke RS Ummi',date:first,count,status:'Selesai',
   note:'Agregat ORLA bulan '+month+'. Tanggal menunjukkan transaksi pertama yang tercatat pada bulan tersebut.'});
 }
 const services=[...additional.values()].map(({values:[month,service,source],count})=>({month,service,source,count}));
 const availableMonths=[...new Set([...Object.keys(patientMonths.out),...Object.keys(patientMonths.in),...services.map(r=>r.month)])].sort(order);
 return {latest,patientMonths,availableMonths,services,records:{partners,pipeline,referrals}};
}

export async function openCohortDemo(file){
 if(!/\.xlsx$/i.test(file?.name||''))throw new Error('Pilih unduhan workbook Excel berformat .xlsx.');
 return buildCohortDemo(await readDocument(file,{sheets:[...required,'TK JR'],maxSize:25*1024*1024}));
}
