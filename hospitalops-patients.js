import {norm,parseDate} from './hospitalops-import.js';

export const patientColumns=['No','No RM','No Registrasi','No SEP','Nama Pasien','Tgl Masuk','Tgl Keluar','Kategori Unit','Unit','Penjamin','Grup Jaminan','Total Tarif Eklaims','Total Amount Billing'];
export const companyColumns=['No','No.RM','No.Reg','Nama Pasien','Nama Dokter','Tanggal Masuk','Tanggal Keluar','UNIT','Penjamin','Hak Kelas','Kelas Perawatan','Perusahaan','No. SEP','No Pegawai/No.Polis','Nama Pegawai','Bagian','Group','Hubungan','Total Billing','Jenis_Asuransi','Total Asuransi','Total Inacbgs','Ket.'];
const companyView=[0,1,2,4,15,5,6,8,9,16,17,18,3,19,20,21,22,23,12,24,25,26,27];
const shortMonths={jan:1,feb:2,mar:3,apr:4,mei:5,may:5,jun:6,jul:7,agu:8,ags:8,agt:8,aug:8,sep:9,okt:10,oct:10,nop:11,nov:11,des:12,dec:12};
export async function readPatientDocument(file){
 if(!file?.size||file.size>75*1024*1024)throw Error('Pilih file Excel atau CSV maksimal 75 MB.');
 if(!/\.(xlsx|xls|csv)$/i.test(file.name))throw Error('Pilih file .xls, .xlsx, atau .csv.');
 const bytes=await file.arrayBuffer();
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./hospitalops-patient-worker.js?v=20261121-patients75',import.meta.url));
  worker.onmessage=({data})=>{worker.terminate();data.error?reject(Error(data.error)):resolve(data.sections)};
  worker.onerror=()=>{worker.terminate();reject(Error('Pembacaan Excel gagal. Coba muat ulang halaman dan unggah kembali.'))};
  worker.postMessage(bytes,[bytes]);
 });
}
function categoryForUnit(value){
 const unit=string(value).toUpperCase();
 if(['FISIOTERAPI','REHABILITASI MEDIK'].includes(unit))return 'REHABILITASI MEDIK';
 if(['MEDICAL CHECK UP','POLIKLINIK VAKSIN'].includes(unit))return 'MCU DAN VAKSIN';
 if(unit.startsWith('POLIKLINIK'))return 'RAWAT JALAN';
 return unit;
}
const months=['januari','februari','maret','april','mei','juni','juli','agustus','september','oktober','november','desember'];
const english=['january','february','march','april','may','june','july','august','september','october','november','december'];
const string=value=>String(value??'').trim();
const aliases={'no rm':['no rm','no rekam medis'],'no registrasi':['no registrasi','no reg','no registrasi pasien'],
 'tgl masuk':['tgl masuk','tanggal masuk'],'tgl keluar':['tgl keluar','tanggal keluar']};
const key=row=>JSON.stringify([row[2],row[8].toUpperCase()]);
const bucket=row=>{
 let hash=2166136261;
 for(const char of key(row))hash=Math.imul(hash^char.charCodeAt(0),16777619);
 return 'bucket-'+((hash>>>0)%64);
};
export function patientDate(value){
 if(value instanceof Date&&!isNaN(value))return value.toISOString().slice(0,10);
 if(typeof value==='number'){
  const date=new Date(Date.UTC(1899,11,30)+Math.floor(value)*86400000);
  return parseDate(date.toISOString().slice(0,10));
 }
 const text=string(value);
 if(!text||text==='-'||text==='—')return '';
 const plain=parseDate(text.split(/[T ]\d{2}:/)[0]);if(plain)return plain;
 const parts=norm(text).split(' ');
 if(parts.length!==3)return '';
 const month=shortMonths[parts[1]]||Math.max(months.indexOf(parts[1]),english.indexOf(parts[1]))+1;
 return month?parseDate(parts[2]+'-'+month+'-'+parts[0]):'';
}
export function patientAmount(value){
 if(typeof value==='number')return Number.isFinite(value)?value:null;
 let text=string(value).replace(/^Rp\.?\s*/i,'').replace(/\s/g,'');
 if(!text||text==='-')return 0;
 if(!/^-?[\d.,]+$/.test(text))return null;
 if(text.includes(',')&&text.includes('.')){
  text=text.lastIndexOf(',')>text.lastIndexOf('.')?text.replaceAll('.','').replace(',','.'):text.replaceAll(',','');
 }else if(text.includes(',')){
  text=/^-?\d{1,3}(,\d{3})+$/.test(text)?text.replaceAll(',',''):text.replace(',','.');
 }else if(/^-?\d{1,3}(\.\d{3})+$/.test(text))text=text.replaceAll('.','');
 const number=Number(text);
 return Number.isFinite(number)?number:null;
}
function indices(header){
 const names=header.map(norm);
 return patientColumns.map(c=>names.findIndex(v=>(aliases[norm(c)]||[norm(c)]).includes(v)));
}
function companyIndices(header){
 const names=header.map(norm);
 return companyColumns.map(c=>names.indexOf(norm(c)));
}
export function patientSheets(sections){
 return sections.flatMap(section=>{
  const reportHeader=section.rows.findIndex(row=>companyIndices(row).every(i=>i>=0));
  if(reportHeader>=0)return [{...section,header:reportHeader,format:'company'}];
  const header=section.rows.findIndex(row=>indices(row).every(i=>i>=0));
  return header<0?[]:[{...section,header,format:'legacy'}];
 });
}
export function parsePatientSheet(section){
 const company=section.format==='company',mapping=company?companyIndices(section.rows[section.header]):indices(section.rows[section.header]),rows=new Map(),errors=[];
 let summaries=0,duplicates=0;
 for(let index=section.header+1;index<section.rows.length;index++){
  const raw=section.rows[index],source=mapping.map(i=>raw[i]??'');
  const r=company?[source[0],source[1],source[2],source[12],source[3],source[5],source[6],categoryForUnit(source[7]),source[7],source[8],source[19],source[21],source[18]]:source;
  if(r.every(v=>!string(v)))continue;
  if(/^(grand\s*total|total|subtotal|jumlah)(\b|$)/i.test(string(r[0]))){summaries++;continue}
  if(norm(raw[0])==='no'&&(company?companyIndices(raw):indices(raw)).every(i=>i>=0))continue;
  const dateIn=patientDate(r[5]),dateOut=patientDate(r[6]);
  const amount=(value)=>company&&!string(value)?null:patientAmount(value);
  const amounts=[amount(r[11]),amount(r[12])];
  const badAmount=[r[11],r[12],...(company?[source[20]]:[])].some(v=>string(v)&&patientAmount(v)===null);
  if(!string(r[2])||!string(r[4])||!string(r[7])||!string(r[8])||!dateIn||
   (string(r[6])&&!['-','—','none','null','n/a'].includes(string(r[6]).toLowerCase())&&!dateOut)||dateOut&&dateOut<dateIn||badAmount){
   errors.push('Baris '+(index+1)+' memiliki registrasi, nama, tanggal, kategori, unit, atau nominal yang perlu diperiksa.');
   continue;
  }
  const row=r.map(string);row[5]=dateIn;row[6]=dateOut;row[11]=amounts[0];row[12]=amounts[1];
  if(company)row.push(null,null,...[source[4],source[9],source[10],source[11],source[13],source[14],source[15],source[16],source[17],source[19],
   amount(source[20]),amount(source[21]),source[22]].map((v,i)=>i===10||i===11?v:string(v)));
  const id=key(row);
  if(rows.has(id)){
   if(JSON.stringify(rows.get(id).slice(1))!==JSON.stringify(row.slice(1))){
    errors.push('Baris '+(index+1)+' memiliki registrasi dan unit sama dengan nilai berbeda. Periksa duplikasi di file.');
   }
   duplicates++;
  }else rows.set(id,row);
 }
 if(!rows.size&&!errors.length)errors.push('Tabel belum berisi data pasien.');
 return {rows:[...rows.values()],errors,summaries,duplicates,format:company?'company':'legacy'};
}
export function createPatients(ui){
 const {records,data,heading,panel,button,table,esc,show,form,fmt,money,options}=ui;
 let pending=null,sections=[],fileName='',scope=null,query='',category='',unit='',payor='',payerType='',labExam='',from='',to='',page=1;
 const size=50;
 const enriched=()=>ui.enrich(all());
 const displayColumns=[...companyColumns,'Tipe Penjamin','Jenis Pemeriksaan Lab'];
 const all=()=>records('patient-buckets').flatMap(b=>b.rows||[]);
 function sync(){
  if(scope!==data()){scope=data();query='';category='';unit='';payor='';payerType='';labExam='';from='';to='';page=1;pending=null}
 }
 function view(){
  sync();
  const list=enriched();
  const choices=(col,first)=>options([['',first],...[...new Set(list.map(r=>r[col]))].filter(Boolean).sort()],col===7?category:col===8?unit:col===13?payerType:col===14?labExam:payor);
  const filters='<div class="filters"><input id="patients-query" aria-label="Cari pasien" type="search" placeholder="Cari nama, RM, registrasi, atau penjamin…" value="'+esc(query)+'">'+
   '<select id="patients-category" aria-label="Kategori unit">'+choices(7,'Semua kategori unit')+'</select>'+
   '<select id="patients-unit" aria-label="Unit layanan">'+choices(8,'Semua unit')+'</select>'+
   '<select id="patients-payor" aria-label="Jenis asuransi">'+choices(10,'Semua jenis asuransi')+'</select>'+
   '<select id="patients-type" aria-label="Tipe Penjamin">'+choices(13,'Semua tipe penjamin')+'</select>'+
   '<select id="patients-lab-exam" aria-label="Jenis Pemeriksaan Lab">'+choices(14,'Semua pemeriksaan lab')+'</select>'+
   '<label>Dari <input id="patients-from" aria-label="Tanggal masuk dari" type="date" value="'+esc(from)+'"></label>'+
   '<label>Sampai <input id="patients-to" aria-label="Tanggal masuk sampai" type="date" value="'+esc(to)+'"></label></div>';
  return heading('Data Pasien','Unggah laporan Excel untuk memperbarui data pasien dan billing.',button('Upload Excel','data-patients="upload"','content',true))+
   (ui.demo?'<p class="sub">Data upload berlaku di sesi tab ini. Muat ulang halaman untuk mengakhiri sesi data pasien.</p>':'')+
   panel('Tabel pasien','Kolom mengikuti laporan Rekap Pasien Perusahaan.',filters+'<div id="patients-results">'+results()+'</div>');
 }
 function selected(){
  const text=query.toLowerCase();
  return enriched().filter(r=>(!category||r[7]===category)&&(!unit||r[8]===unit)&&(!payor||r[10]===payor)&&(!payerType||r[13]===payerType)&&(!labExam||r[14]===labExam)&&
   (!from||r[5]>=from)&&(!to||r[5]<=to)&&[r[1],r[2],r[4],r[9]].join(' ').toLowerCase().includes(text))
   .sort((a,b)=>b[5].localeCompare(a[5])||a[2].localeCompare(b[2]));
 }
 function cells(row,index){
  const view=[...companyView.map(i=>row[i]),row[13],row[14]];
  return '<tr>'+view.map((v,i)=>'<td>'+esc(i===0?index+1:i===5||i===6?fmt(v):
   [18,20,21].includes(i)?v===null||v===undefined?'—':money(v):v||'—')+'</td>').join('')+'</tr>';
 }
 function results(){
  const rows=selected(),pages=Math.max(1,Math.ceil(rows.length/size));page=Math.min(page,pages);
  const billing=rows.reduce((sum,r)=>sum+r[12],0),claims=rows.reduce((sum,r)=>sum+r[11],0);
  const body=rows.slice((page-1)*size,page*size).map((r,i)=>cells(r,(page-1)*size+i)).join('');
  const history=records('patient-imports').slice(-1)[0];
  const missing=rows.filter(r=>r[13]==='Belum terpetakan').length;
  const noBilling=rows.filter(r=>r[12]===null||r[12]===undefined).length;
  const insurance=rows.reduce((sum,r)=>sum+Number(r[25]||0),0);
  return '<p class="sub">'+rows.length.toLocaleString('id-ID')+' kunjungan · Total billing '+money(billing)+' · Total Asuransi '+money(insurance)+' · InaCBGs / e-Klaim '+money(claims)+'</p>'+
   (from&&to&&from>to?'<p role="alert">Tanggal sampai harus sama dengan atau setelah tanggal dari.</p>':'')+
   (noBilling?'<p class="sub">'+noBilling.toLocaleString('id-ID')+' kunjungan memiliki Total Billing kosong. Total billing di atas menjumlahkan nilai yang terisi.</p>':'')+
   (missing?'<p class="sub">'+missing+' kunjungan belum terpetakan. Lengkapi nama penjamin di Ref Direktori.</p>':'')+
   table(displayColumns,body||'<tr><td colspan="25">Belum ada data yang sesuai. Pilih Upload Excel untuk memuat laporan.</td></tr>')+
   '<div class="actions">'+button('Sebelumnya','data-patients="previous" '+(page===1?'disabled':''))+
   '<span>Halaman '+page+' / '+pages+'</span>'+button('Berikutnya','data-patients="next" '+(page===pages?'disabled':''))+'</div>'+
   (history?'<p class="sub">Upload terakhir '+esc(history.fileName)+' · '+history.added+' baru · '+history.updated+' diperbarui · '+history.unchanged+' sama.</p>':'');
 }
 function dialog(){
  pending=null;sections=[];
  show('Upload data pasien',form('patient-upload',
   '<p class="sub">Pilih Rekap Pasien Perusahaan (.xls, .xlsx, .csv), maksimal 75 MB. Periksa pratinjau sebelum menyimpan.</p>'+
   '<label>File Excel<input id="patient-file" type="file" accept=".xls,.xlsx,.csv" required></label>'+
   '<label>Mode upload<select id="patient-mode"><option value="replace">Ganti seluruh data pasien dengan file ini</option><option value="merge">Tambah dan perbarui registrasi yang sama</option></select></label>'+
   '<div id="patient-preview"  aria-live="polite">Pilih file untuk melihat pratinjau.</div>','Simpan hasil upload'));
  ui.wide();
  document.querySelector('[data-form="patient-upload"] button.primary').disabled=true;
 }
 function preview(index){
  const section=sections[index],parsed=parsePatientSheet(section);
  pending={...parsed,scope:data()};
  const choices=sections.length>1?'<label>Sheet data<select id="patient-sheet">'+options(sections.map((s,i)=>[String(i),s.name]),String(index))+'</select></label>':'';
  const old=new Map(all().map(r=>[key(r),r]));
  let added=0,updated=0,unchanged=0;
  for(const r of parsed.rows){
   const previous=old.get(key(r));
   if(!previous)added++;
   else if(JSON.stringify(previous.slice(1))===JSON.stringify(r.slice(1)))unchanged++;
   else updated++;
  }
  Object.assign(pending,{added,updated,unchanged});
  document.getElementById('patient-preview').innerHTML=choices+
   '<p>'+parsed.rows.length+' kunjungan terbaca · '+added+' baru · '+updated+' diperbarui · '+unchanged+' sama.</p>'+
   '<p class="sub">'+parsed.duplicates+' duplikasi identik · '+parsed.summaries+' baris total dilewati.</p>'+
   (parsed.errors.length?'<p role="alert">'+parsed.errors.length+' baris perlu diperbaiki.</p><ul>'+parsed.errors.slice(0,5).map(e=>'<li>'+esc(e)+'</li>').join('')+'</ul>':'')+
   table(displayColumns,ui.enrich(parsed.rows.slice(0,5)).map(cells).join(''))+
   '<p class="sub">Pratinjau menampilkan hingga 5 baris. Seluruh baris valid disimpan setelah menekan Simpan.</p>';
  document.querySelector('[data-form="patient-upload"] button.primary').disabled=!!parsed.errors.length||!parsed.rows.length;
 }
 let request=0;
 async function change(target){
  if(target.id==='patient-sheet'){preview(Number(target.value));return true}
  if(target.id==='patient-file'){
   const current=++request,formNode=target.form,file=target.files?.[0],workspace=data();
   pending=null;document.querySelector('[data-form="patient-upload"] button.primary').disabled=true;
   const area=document.getElementById('patient-preview');area.textContent='Membaca file…';
   try{
    const sheets=patientSheets(await readPatientDocument(file));
    if(current!==request||!formNode.isConnected||workspace!==data())return true;
    if(!sheets.length)throw Error('Header belum sesuai. Pilih laporan Rekap Pasien Perusahaan dengan 23 kolom lengkap.');
    fileName=file.name;sections=sheets;preview(0);
   }catch(error){if(current===request&&formNode.isConnected)area.textContent=error.message}
   return true;
  }
  const filters={'patients-query':v=>query=v,'patients-category':v=>category=v,'patients-unit':v=>unit=v,
   'patients-payor':v=>payor=v,'patients-type':v=>payerType=v,'patients-lab-exam':v=>labExam=v,'patients-from':v=>from=v,'patients-to':v=>to=v};
  if(filters[target.id]){filters[target.id](target.value);page=1;document.getElementById('patients-results').innerHTML=results();return true}
  return false;
 }
 function mutate(){
  if(!pending||pending.scope!==data()||pending.errors.length||!pending.rows.length)throw Error('Periksa pratinjau upload terlebih dahulu.');
  const replace=document.getElementById('patient-mode').value==='replace';
  const stored=replace?[]:records('patient-buckets'),byId=new Map(stored.map(b=>[b.id,b]));
  const touched=new Map();
  for(const row of pending.rows){
   const id=bucket(row);
   if(!touched.has(id))touched.set(id,new Map((byId.get(id)?.rows||[]).map(r=>[key(r),r])));
   touched.get(id).set(key(row),row);
  }
  for(const [id,rows] of touched)byId.set(id,{id,rows:[...rows.values()]});
  data().records['patient-buckets']=[...byId.values()];
  const {added,updated,unchanged}=pending;
  const history={id:ui.unique(),fileName,added,updated,unchanged,uploadedAt:new Date().toISOString()};
  data().records['patient-imports']=[...records('patient-imports'),history];
  return {page:'patients',message:added+' kunjungan ditambahkan, '+updated+' diperbarui.'};
 }
 return {view,change,mutate,all,click(d){
  if(d.patients==='upload')dialog();
  if(d.patients==='previous'||d.patients==='next'){page+=d.patients==='next'?1:-1;document.getElementById('patients-results').innerHTML=results()}
 }};
}
