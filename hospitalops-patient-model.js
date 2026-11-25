import {norm as sourceNorm,parseDate} from './hospitalops-import.js';
export const clean=v=>String(v??'').trim();
const norm=v=>sourceNorm(clean(v));
export const matchKey=v=>clean(v).toLocaleLowerCase('id-ID').replace(/\s+/g,' ');
export const sourceCategories=['RAWAT JALAN','RAWAT INAP','IGD','PENUNJANG','TINDAKAN'];
export function sourceCategory(v){const k=norm(v);return ({rajal:'RAWAT JALAN',ranap:'RAWAT INAP','rawat jalan':'RAWAT JALAN','rawat inap':'RAWAT INAP',igd:'IGD',penunjang:'PENUNJANG',tindakan:'TINDAKAN'})[k]||clean(v).toUpperCase()}
export const visitKey=r=>JSON.stringify([clean(r[2]),clean(r[8]).toUpperCase()]);
export function patientKey(r){const rm=clean(r[1]),key=rm.replace(/[^a-z0-9]/gi,'').replace(/^0+/,'').toUpperCase();return key&&!['-','OTC'].includes(rm.toUpperCase())&&!/[\/ :]/.test(rm)?'rm:'+key:'visit:'+visitKey(r)}
export function hashKey(value,prefix='bucket-'){let h=2166136261;for(const c of value)h=Math.imul(h^c.charCodeAt(0),16777619);return prefix+((h>>>0)%64)}
export function patientDate(value){
 if(value instanceof Date&&!isNaN(value))return value.toISOString().slice(0,10);
 if(typeof value==='number'&&Number.isFinite(value)){const d=new Date(Date.UTC(1899,11,30)+Math.floor(value)*86400000);return isNaN(d)?'':parseDate(d.toISOString().slice(0,10))}
 const text=clean(value);if(!text||['-','—','none','null','n/a'].includes(text.toLowerCase()))return '';
 const plain=parseDate(text.split(/[T ]\d{2}:/)[0]);if(plain)return plain;
 const p=norm(text).split(' '),months=['januari','februari','maret','april','mei','juni','juli','agustus','september','oktober','november','desember'],en=['january','february','march','april','may','june','july','august','september','october','november','december'];
 const short={jan:1,feb:2,mar:3,apr:4,mei:5,may:5,jun:6,jul:7,agu:8,ags:8,agt:8,agust:8,aug:8,sep:9,sept:9,okt:10,oct:10,nop:11,nov:11,des:12,dec:12};
 const month=short[p[1]]||Math.max(months.indexOf(p[1]),en.indexOf(p[1]))+1;return p.length===3&&month?parseDate(p[2]+'-'+month+'-'+p[0]):'';
}
export function patientAmount(v){if(typeof v==='number')return Number.isFinite(v)?v:null;let t=clean(v).replace(/^Rp\.?\s*/i,'').replace(/\s/g,'');if(!t||t==='-')return null;if(!/^-?[\d.,]+$/.test(t))return null;if(t.includes(',')&&t.includes('.'))t=t.lastIndexOf(',')>t.lastIndexOf('.')?t.replaceAll('.','').replace(',','.'):t.replaceAll(',','');else if(t.includes(','))t=/^-?\d{1,3}(,\d{3})+$/.test(t)?t.replaceAll(',',''):t.replace(',','.');else if(/^-?\d{1,3}(\.\d{3})+$/.test(t))t=t.replaceAll('.','');return Number.isFinite(Number(t))?Number(t):null}
// Fixed internal positions keep existing patient, partner and chart integrations compatible.
export const importFields=[
 ['number','No.',0,'no|nomor'],['rm','No. RM',1,'no rm|no rekam medis|nomor rm|medical record|medical record number|mrn'],['registration','No. Registrasi',2,'no reg|no registrasi|registrasi|nomor registrasi|encounter id|visit id'],['sep','No. SEP',3,'no sep'],['name','Nama Pasien',4,'nama pasien|patient name|nama'],['admitted','Tanggal Masuk',5,'tanggal masuk|tgl masuk|admission date|tanggal daftar|tgl daftar'],['discharged','Tanggal Keluar',6,'tanggal keluar|tgl keluar|discharge date'],['category','Kategori Sumber',7,'sumber group|kategori sumber|sumber pasien|kategori unit'],['unit','Unit / Poli',8,'unit|poli|unit pelayanan|departemen|department'],['payer','Penjamin',9,'penjamin|nama penjamin|guarantor|asuransi'],['insurance','Jenis Asuransi',10,'jenis asuransi|grup jaminan'],['claims','Total InaCBGs / e-Klaim',11,'total inacbgs|total tarif eklaims|inacbgs'],['billing','Total Billing (sumber)',12,'total billing|total amount billing|total tagihan|total tagihan pasien'],['payerType','Tipe Penjamin (opsional)',13,'tipe penjamin|kategori penjamin'],['doctor','Nama Dokter',15,'nama dokter|dokter|dpjp|doctor'],['careRight','Hak Kelas',16,'hak kelas'],['careClass','Kelas Perawatan',17,'kelas perawatan|kelas'],['company','Perusahaan',18,'perusahaan|company'],['policy','No. Pegawai / Polis',19,'no pegawai no polis|nomor polis|no polis'],['employee','Nama Pegawai',20,'nama pegawai'],['division','Bagian',21,'bagian'],['employeeGroup','Group Pegawai',22,'group'],['relation','Hubungan',23,'hubungan'],['insuranceOriginal','Jenis Asuransi (detail)',24,'jenis asuransi'],['revenue','Pendapatan: Total Asuransi',25,'total asuransi|tagihan penjamin|pendapatan penjamin'],['claimsOriginal','InaCBGs (detail)',26,'total inacbgs'],['billStatus','Status Billing',27,'ket|status billing|keterangan']
];
// Mirrors are filled during parsing rather than mapped twice.
export const mappingFields=importFields.filter(([k])=>!['insuranceOriginal','claimsOriginal'].includes(k));
export function guessMapping(header){const names=header.map(norm);return Object.fromEntries(mappingFields.map(([key,, ,aliases])=>[key,names.findIndex(n=>aliases.split('|').map(norm).includes(n)&&n)]))}
export function guessHeader(rows){let best=0,score=-1;rows.slice(0,60).forEach((r,i)=>{const m=guessMapping(r),s=Object.values(m).filter(v=>v>=0).length+['name','registration','unit','admitted'].filter(k=>m[k]>=0).length*3;if(s>score){score=s;best=i}});return best}
export function referenceGuess(section){const rows=section?.rows||[],header=rows.findIndex(r=>r.some(c=>['tipe penjamin','kategori mitra'].includes(norm(c))));const names=(rows[Math.max(header,0)]||[]).map(norm);let unit=-1,category=-1,best=0;
 for(let c=0;c<Math.max(0,...rows.slice(0,5).map(r=>r.length))-1;c++){const hits=rows.filter(r=>clean(r[c])&&sourceCategories.includes(sourceCategory(r[c+1]))).length;if(hits>best){unit=c;category=c+1;best=hits}}
 return {header:Math.max(header,0),payer:names.findIndex(n=>['penjamin','nama penjamin','nama mitra'].includes(n)),type:names.findIndex(n=>['tipe penjamin','kategori mitra'].includes(n)),unit,category};
}
export function parsePatientReferences(section,config=referenceGuess(section)){
 const payers=new Map(),sources=new Map(),errors=[],warnings=[];let skipped=0;
 const put=(map,k,v,row)=>{if(map.has(k)&&matchKey(map.get(k).type||map.get(k).category)!==matchKey(v.type||v.category)){errors.push('Ref baris '+row+': kategori berbeda untuk '+(v.name||v.unit)+'.');return}map.set(k,v)};
 (section?.rows||[]).forEach((r,i)=>{
  if(i>config.header&&config.payer>=0&&config.type>=0){const name=clean(r[config.payer]),type=clean(r[config.type]);if(name&&type)put(payers,matchKey(name),{name,type},i+1);else if(name||type)skipped++}
  if(config.unit>=0&&config.category>=0){const unit=clean(r[config.unit]),category=sourceCategory(r[config.category]);if(unit&&sourceCategories.includes(category))put(sources,matchKey(unit),{unit,category},i+1)}
 });
 if(skipped)warnings.push(skipped+' referensi penjamin tanpa nama/tipe dilewati.');return {payers:[...payers.values()],sources:[...sources.values()],errors,warnings};
}
export function enrichPatientSources(rows,references){const map=new Map(references.map(r=>[matchKey(r.unit),r.category]));return rows.map(r=>{const out=[...r];out[7]=map.get(matchKey(r[8]))||sourceCategory(r[28]?.sourceInput||r[7]);return out})}
export function applies(field,row){return (!field.category||sourceCategory(row[7])===sourceCategory(field.category))&&(!field.unitContains||matchKey(row[8]).includes(matchKey(field.unitContains)))&&(!field.payerType||matchKey(row[13])===matchKey(field.payerType))}
export function parseMappedPatients(section,mapping,{sources=[],payers=[],fields=[]}={}){
 const errors=[],rows=new Map(),custom=[],sourceMap=new Map(sources.map(r=>[matchKey(r.unit),r.category])),payerMap=new Map(payers.map(r=>[matchKey(r.name),r.type]));let summaries=0,duplicates=0,conflicts=0;
 const must=['name','registration','admitted','unit'];for(const k of must)if(!(Number(mapping[k])>=0))errors.push('Pemetaan wajib belum dipilih: '+mappingFields.find(f=>f[0]===k)[1]+'.');
 const chosen=Object.entries(mapping).filter(([k,v])=>!k.startsWith('custom:')&&Number(v)>=0);const reused=chosen.filter((a,i)=>chosen.some((b,j)=>j<i&&Number(b[1])===Number(a[1])));if(reused.length)errors.push('Satu kolom sumber dipetakan ke beberapa komponen. Periksa pemetaan.');
 if(errors.length)return {rows:[],errors,custom,summaries,duplicates,conflicts:errors.length};
 for(let i=section.header+1;i<section.rows.length;i++){
  const raw=section.rows[i];if(raw.every(v=>!clean(v)))continue;const get=k=>{const col=Number(mapping[k]);return col>=0?(['rm','registration','sep','policy'].includes(k)?section.cellText?.[i]?.[col]??raw[col]:raw[col])??'':''};
  if(/^(grand\s*total|total|subtotal|jumlah)(\b|$)/i.test(clean(get('number')))){summaries++;continue}
  if(norm(get('registration'))===norm(section.rows[section.header][mapping.registration]))continue;
  const row=Array(29).fill('');for(const [k,,pos] of mappingFields)row[pos]=clean(get(k));row[5]=patientDate(get('admitted'));row[6]=patientDate(get('discharged'));row[0]=row[0]||String(i-section.header);row[28]={sourceInput:sourceCategory(get('category'))};
  row[7]=sourceMap.get(matchKey(row[8]))||row[28].sourceInput||(/^(poliklinik|poli)\b/i.test(row[8])?'RAWAT JALAN':sourceCategory(row[8]));
  for(const k of ['billing','revenue','claims'])row[importFields.find(f=>f[0]===k)[2]]=patientAmount(get(k));row[24]=row[10];row[26]=row[11];row[14]=null;row[13]=payerMap.get(matchKey(row[9]))||row[13]||'Belum terpetakan';
  const issues=[];if(!row[2])issues.push('No. Registrasi kosong');if(!row[4])issues.push('Nama Pasien kosong');if(!row[8])issues.push('Unit kosong');if(!row[5])issues.push('Tanggal Masuk tidak terbaca');if(clean(get('discharged'))&&!['-','—','none','null','n/a'].includes(clean(get('discharged')).toLowerCase())&&!row[6])issues.push('Tanggal Keluar tidak terbaca');if(row[6]&&row[6]<row[5])issues.push('Tanggal Keluar sebelum Tanggal Masuk');
  for(const k of ['billing','revenue','claims'])if(clean(get(k))&&!['-','—'].includes(clean(get(k)))&&patientAmount(get(k))===null)issues.push('Nominal '+k+' tidak terbaca');
  const customValues={};for(const f of fields){const col=Number(mapping['custom:'+f.id]??-1);if(col<0||!applies(f,row))continue;try{customValues[f.id]=coerceFieldValue(f,raw[col])}catch(e){issues.push(f.label+': '+e.message)}}
  if(issues.length){errors.push('Baris '+(i+1+(section.rowOffset||0))+': '+issues.join('; ')+'.');continue}
  const id=visitKey(row);if(rows.has(id)){duplicates++;if(JSON.stringify(rows.get(id).slice(1))!==JSON.stringify(row.slice(1))){conflicts++;errors.push('Baris '+(i+1+(section.rowOffset||0))+': registrasi dan unit sama dengan data berbeda.')}continue}
  rows.set(id,row);if(Object.keys(customValues).length)custom.push({row,values:customValues});
 }
 return {rows:[...rows.values()],errors,custom,summaries,duplicates,conflicts,format:'mapped'};
}
export function coerceFieldValue(f,v){if(v===null||v===undefined||clean(v)==='')return null;const t=clean(v);if(f.type==='number'){const n=patientAmount(v);if(n===null)throw Error('gunakan angka');return n}if(f.type==='date'){const d=patientDate(v);if(!d)throw Error('tanggal tidak valid');return d}if(f.type==='checkbox'){if(typeof v==='boolean')return v;if(['1','true','ya','yes'].includes(t.toLowerCase()))return true;if(['0','false','tidak','no'].includes(t.toLowerCase()))return false;throw Error('gunakan Ya / Tidak')}
 if(f.type==='select'&&!(f.options||[]).includes(t))throw Error('pilih nilai dalam daftar');if(f.type==='multiselect'){const a=Array.isArray(v)?v:t.split(';').map(clean);if(a.some(x=>!(f.options||[]).includes(x)))throw Error('pilihan tidak tersedia');return [...new Set(a)]}if(t.length>2000)throw Error('maksimal 2.000 karakter');return t;
}
