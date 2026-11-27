import {compareSortValues} from './hospitalops-table-sort.js?v=20261121-sortcards1';
import {patientRevenue,patientRevenueSource} from './hospitalops-patient-metrics.js?v=20261127-revenuefallback1';
import {norm} from './hospitalops-import.js';
import {clean,matchKey,visitKey,mappingFields,guessMapping,guessHeader,referenceGuess,parsePatientReferences,parseMappedPatients} from './hospitalops-patient-model.js?v=20261125-flex1';
export {patientDate,patientAmount} from './hospitalops-patient-model.js?v=20261125-flex1';

export const patientColumns=['No','No RM','No Registrasi','No SEP','Nama Pasien','Tgl Masuk','Tgl Keluar','Kategori Unit','Unit','Penjamin','Grup Jaminan','Total Tarif Eklaims','Total Amount Billing'];
export const companyColumns=['No','No.RM','No.Reg','Nama Pasien','Nama Dokter','Tanggal Masuk','Tanggal Keluar','UNIT','Penjamin','Hak Kelas','Kelas Perawatan','Perusahaan','No. SEP','No Pegawai/No.Polis','Nama Pegawai','Bagian','Group','Hubungan','Total Billing','Jenis_Asuransi','Total Asuransi','Total Inacbgs','Ket.'];
const companyView=[0,1,2,4,15,5,6,8,9,16,17,18,3,19,20,21,22,23,12,24,25,26,27];
const shortMonths={jan:1,feb:2,mar:3,apr:4,mei:5,may:5,jun:6,jul:7,agu:8,ags:8,agt:8,agust:8,aug:8,sep:9,okt:10,oct:10,nop:11,nov:11,des:12,dec:12};
export async function readPatientDocument(file){
 if(!file?.size||file.size>75*1024*1024)throw Error('Pilih file Excel atau CSV maksimal 75 MB.');
 if(!/\.(xlsx|xls|csv)$/i.test(file.name))throw Error('Pilih file .xls, .xlsx, atau .csv.');
 const bytes=await file.arrayBuffer();
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./hospitalops-patient-worker.js?v=20261125-flex1',import.meta.url));
  worker.onmessage=({data})=>{worker.terminate();data.error?reject(Error(data.error)):resolve(data.sections)};
  worker.onerror=()=>{worker.terminate();reject(Error('Pembacaan Excel gagal. Coba muat ulang halaman dan unggah kembali.'))};
  worker.postMessage(bytes,[bytes]);
 });
}
const key=visitKey;
const bucket=row=>{let hash=2166136261;for(const char of key(row))hash=Math.imul(hash^char.charCodeAt(0),16777619);return 'bucket-'+((hash>>>0)%64)};
export function patientSheets(sections){return sections.map(section=>({...section,header:guessHeader(section.rows),format:'mapped'}))}
export function parsePatientSheet(section){return parseMappedPatients(section,section.mapping||guessMapping(section.rows[section.header]))}
export function createPatients(ui){
 const {records,data,heading,panel,button,table,esc,show,form,fmt,money,options}=ui;
 let pending=null,sections=[],fileName='',selectedSheet=0,refSheet=-1,mapping={},refMapping={},profileName='',scope=null,query='',category='',unit='',payor='',payerType='',labExam='',from='',to='',page=1;
 const size=50;
 let sortColumn=5,sortDescending=true;
 const enriched=()=>ui.enrich(all());
 const extraColumns=()=>ui.customFields().filter(f=>f.scope!=='program'&&(!category||!f.category||f.category===category));
 const displayColumns=()=>[...companyColumns,'Tipe Penjamin','Kategori Sumber',...extraColumns().map(f=>f.label)];
 const all=()=>records('patient-buckets').flatMap(b=>b.rows||[]);
 function sync(){
  if(scope!==data()){scope=data();query='';category='';unit='';payor='';payerType='';labExam='';from='';to='';page=1;pending=null;sortColumn=5;sortDescending=true}
 }
 function view(){
  sync();if(!ui.customFields().some(f=>f.id==='patient-lab-exam'))labExam='';
  const list=enriched();
  const choices=(col,first)=>options([['',first],...[...new Set(list.map(r=>r[col]))].filter(Boolean).sort()],col===7?category:col===8?unit:col===13?payerType:col===14?labExam:payor);
  const filters='<div class="filters"><input id="patients-query" aria-label="Cari pasien" type="search" placeholder="Cari nama, RM, registrasi, atau penjamin…" value="'+esc(query)+'">'+
   '<select id="patients-category" aria-label="Kategori sumber">'+choices(7,'Semua sumber layanan')+'</select>'+
   '<select id="patients-unit" aria-label="Unit layanan">'+choices(8,'Semua unit')+'</select>'+
   '<select id="patients-payor" aria-label="Jenis asuransi">'+choices(10,'Semua jenis asuransi')+'</select>'+
   '<select id="patients-type" aria-label="Tipe Penjamin">'+choices(13,'Semua tipe penjamin')+'</select>'+
   (ui.customFields().some(f=>f.id==='patient-lab-exam')?'<select id="patients-lab-exam" aria-label="'+esc(ui.customFields().find(f=>f.id==='patient-lab-exam').label)+'">'+choices(14,'Semua '+ui.customFields().find(f=>f.id==='patient-lab-exam').label)+'</select>':'')+
   '<label>Dari <input id="patients-from" aria-label="Tanggal masuk dari" type="date" value="'+esc(from)+'"></label>'+
   '<label>Sampai <input id="patients-to" aria-label="Tanggal masuk sampai" type="date" value="'+esc(to)+'"></label></div>';
  return heading('Data Pasien','Unggah laporan Excel untuk memperbarui data pasien dan pendapatan.',button('Upload Excel','data-patients="upload"','content',true))+
   (ui.demo?'<p class="sub">'+(ui.persistentDemo?'Data pasien tersimpan di browser ini per organisasi dan tetap ada setelah reload. Gunakan browser dan perangkat yang sama; menghapus data situs akan menghapus salinan lokal.':'Data upload berlaku di sesi tab ini. Muat ulang halaman untuk mengakhiri sesi data pasien.')+'</p>':'')+
   panel('Tabel pasien','Klik nama pasien untuk melihat pendapatan, data perawatan, dan rekap kunjungan pascaranap.',filters+'<div id="patients-results">'+results()+'</div>');
 }
 function selected(){
  const text=query.toLowerCase();
  return enriched().filter(r=>(!category||r[7]===category)&&(!unit||r[8]===unit)&&(!payor||r[10]===payor)&&(!payerType||r[13]===payerType)&&(!labExam||r[14]===labExam)&&
   (!from||r[5]>=from)&&(!to||r[5]<=to)&&[r[1],r[2],r[4],r[9]].join(' ').toLowerCase().includes(text))
   .sort((a,b)=>compareSortValues(sortColumn>=25?ui.readCustom(a,extraColumns()[sortColumn-25]):sortColumn===24?a[7]:a[sortColumn<23?companyView[sortColumn]:13],sortColumn>=25?ui.readCustom(b,extraColumns()[sortColumn-25]):sortColumn===24?b[7]:b[sortColumn<23?companyView[sortColumn]:13],sortDescending)||a[2].localeCompare(b[2]));
 }
 function cells(row,index,previewValues={}){
  const view=[...companyView.map(i=>row[i]),row[13],row[7],...extraColumns().map(f=>ui.formatCustom(previewValues[f.id]??ui.readCustom(row,f)))];
  return '<tr>'+view.map((v,i)=>'<td>'+(i===3?'<button type="button" class="rowbtn" data-patients="detail" data-patient-key="'+esc(key(row))+'">'+esc(v||'—')+'</button>':esc(i===0?row[0]||index+1:i===5||i===6?fmt(v):
   [18,20,21].includes(i)?v===null||v===undefined?'—':money(v):v||'—'))+'</td>').join('')+'</tr>';
 }
 function results(){
  const rows=selected(),pages=Math.max(1,Math.ceil(rows.length/size));page=Math.min(page,pages);
  const billing=rows.reduce((sum,r)=>sum+r[12],0),claims=rows.reduce((sum,r)=>sum+r[11],0);
  const body=rows.slice((page-1)*size,page*size).map((r,i)=>cells(r,(page-1)*size+i)).join('');
  const history=records('patient-imports').slice(-1)[0];
  const missing=rows.filter(r=>r[13]==='Belum terpetakan').length;
  const noRevenue=rows.filter(r=>patientRevenue(r)===null).length;
  const insurance=rows.reduce((sum,r)=>sum+(patientRevenue(r)??0),0);
  return '<p class="sub">'+rows.length.toLocaleString('id-ID')+' kunjungan · Pendapatan '+money(insurance)+' · Total Billing (data sumber) '+money(billing)+' · InaCBGs / e-Klaim '+money(claims)+'</p>'+
   (from&&to&&from>to?'<p role="alert">Tanggal sampai harus sama dengan atau setelah tanggal dari.</p>':'')+
   '<p class="sub">Pendapatan memakai Total Asuransi jika terisi, termasuk 0; jika kosong memakai Total Billing. '+rows.filter(r=>patientRevenueSource(r)==='Total Billing').length.toLocaleString('id-ID')+' kunjungan memakai Total Billing. Kedua kolom tidak dijumlahkan.</p>'+
   (noRevenue?'<p class="sub">'+noRevenue.toLocaleString('id-ID')+' kunjungan belum memiliki nilai pendapatan dari Total Asuransi maupun Total Billing.</p>':'')+
   (missing?'<p class="sub">'+missing+' kunjungan belum terpetakan. Lengkapi nama penjamin di Ref Direktori.</p>':'')+
   table(displayColumns(),body||'<tr><td colspan="'+displayColumns().length+'">Belum ada data yang sesuai. Pilih Upload Excel untuk memuat laporan.</td></tr>')+
   '<div class="actions">'+button('Sebelumnya','data-patients="previous" '+(page===1?'disabled':''))+
   '<span>Halaman '+page+' / '+pages+'</span>'+button('Berikutnya','data-patients="next" '+(page===pages?'disabled':''))+'</div>'+
   (history?'<p class="sub">Upload terakhir '+esc(history.fileName)+' · '+history.added+' baru · '+history.updated+' diperbarui · '+history.unchanged+' sama.'+(history.skipped?' '+history.skipped+' baris bermasalah dilewati.':'')+'</p>':'')+importHistory();
 }
 function importHistory(){const imports=records('patient-imports');return '<details><summary>Riwayat upload ('+imports.length+')</summary>'+table(['File / waktu','Sheet / profil','Baris valid','Dilewati','Pengunggah','Aksi'],imports.slice().reverse().map((r,i)=>'<tr><td>'+esc(r.fileName)+'<div class="sub">'+esc(r.uploadedAt)+'</div></td><td>'+esc(r.sheet||'–')+' / '+esc(r.profileName||'–')+'</td><td>'+Number(r.count??r.added??0)+'</td><td>'+Number(r.skipped||0)+'</td><td>'+esc(r.actor||'Manager')+'</td><td>'+(i===0&&r.undo?button('Batalkan impor terakhir','data-patients="undo" data-import-id="'+esc(r.id)+'"'):'–')+'</td></tr>').join('')||'<tr><td colspan="6">Belum ada upload.</td></tr>')+'</details>'}
 function dialog(){
  pending=null;sections=[];
  show('Upload data pasien',form('patient-upload',
   '<p class="sub">Excel/CSV maksimal 75 MB. Pilih sheet Raw, cocokkan komponen, lalu gunakan Ref untuk penjamin dan kategori sumber.</p>'+
   '<label>File Excel<input id="patient-file" type="file" accept=".xls,.xlsx,.csv" required></label>'+
   '<label>Mode upload<select id="patient-mode"><option value="merge">Tambah dan perbarui registrasi yang sama</option><option value="replace">Ganti seluruh data pasien dengan file ini</option></select></label>'+
   '<div id="patient-mapping"></div><div id="patient-preview" aria-live="polite">Pilih file untuk melihat pemetaan.</div>','Simpan hasil upload'));
  ui.wide();document.querySelector('[data-form="patient-upload"] button.primary').disabled=true;
 }
 function columnChoices(section){return [['-1','Tidak dipetakan'],...(section.rows[section.header]||[]).map((v,i)=>[String(i),'Kolom '+(i+1)+' · '+String(v||'(tanpa judul)').slice(0,90)])]}
 function mappingControls(){
  const s=sections[selectedSheet],signature=JSON.stringify(s.rows[s.header].map(norm)),saved=records('patient-import-profiles').filter(p=>p.signature===signature);
  const mapSelect=(field,col)=>'<select data-patient-map="'+esc(field)+'" aria-label="Pemetaan '+esc(col)+'">'+options(columnChoices(s),String(mapping[field]??-1))+'</select>';
  document.getElementById('patient-mapping').innerHTML='<div class="ops-grid"><label>Sheet data pasien<select id="patient-sheet">'+options(sections.map((s,i)=>[String(i),s.name]),String(selectedSheet))+'</select></label>'+
   '<label>Baris judul kolom<input id="patient-header" type="number" min="1" max="'+Math.min(s.rows.length,100)+'" value="'+(s.header+1)+'"></label>'+
   '<label>Profil pemetaan tersimpan<select id="patient-profile">'+options([['','Pemetaan otomatis'],...saved.map(p=>[p.id,p.name])],'')+'</select></label>'+
   '<label>Nama profil (simpan untuk upload berikutnya)<input id="patient-profile-name" type="text" maxlength="120" value="'+esc(profileName)+'"></label></div>'+
   '<details '+(['name','registration','admitted','unit'].some(k=>mapping[k]<0)?'open':'')+'><summary>Pemetaan kolom · periksa sebelum menyimpan</summary><p class="sub">Wajib: Nama Pasien, No. Registrasi, Tanggal Masuk, Unit. Pendapatan mengutamakan Total Asuransi; jika kosong memakai Total Billing. Petakan kedua kolom sesuai sumber. Kolom lain opsional.</p><div class="ops-grid">'+mappingFields.map(([k,l])=>'<label>'+esc(l)+mapSelect(k,l)+'</label>').join('')+'</div>'+
   '<h3>Kolom custom (opsional)</h3><div class="ops-grid">'+ui.customFields().filter(f=>f.scope!=='program').map(f=>'<label>'+esc(f.label)+mapSelect('custom:'+f.id,f.label)+'</label>').join('')+'</div><p class="sub">Kolom custom yang dipetakan hanya memperbarui nilai terisi. Isian manual lainnya tetap disimpan.</p></details>'+
   '<label>Sheet acuan Ref<select id="patient-ref-sheet">'+options([['-1','Tanpa impor Ref (pakai referensi tersimpan)'],...sections.map((s,i)=>[String(i),s.name])],String(refSheet))+'</select></label>'+
   (refSheet>=0?'<details><summary>Pemetaan Ref · penjamin dan sumber layanan</summary><div class="ops-grid">'+[['payer','Nama penjamin'],['type','Tipe penjamin'],['unit','Unit / layanan'],['category','Kategori sumber']].map(([k,l])=>'<label>'+l+'<select data-patient-ref="'+k+'">'+options(columnChoices(sections[refSheet]),String(refMapping[k]??-1))+'</select></label>').join('')+'</div><p class="sub">Pemetaan unit membaca seluruh sheet, termasuk pasangan unit/kategori di baris pertama.</p></details>':'');
 }
 function chooseSheet(index){selectedSheet=index;const s=sections[index];s.header=guessHeader(s.rows);mapping=guessMapping(s.rows[s.header]);const signature=JSON.stringify(s.rows[s.header].map(norm)),profile=records('patient-import-profiles').find(p=>p.signature===signature);if(profile){mapping={...mapping,...profile.mapping};profileName=profile.name}else profileName='Format '+s.name;mappingControls();preview()}
 function referencePreview(){return refSheet>=0?parsePatientReferences(sections[refSheet],refMapping):{payers:[],sources:[],errors:[],warnings:[]}}
 function preview(){
  const refs=referencePreview(),existingSources=records('patient-source-directory'),sources=[...new Map([...existingSources,...refs.sources].map(r=>[matchKey(r.unit),r])).values()];
  const s=sections[selectedSheet],parsed=parseMappedPatients(s,mapping,{sources,payers:[...ui.references(),...refs.payers],fields:ui.customFields()});
  const combinedErrors=[...refs.errors,...parsed.errors];pending={...parsed,errors:combinedErrors,conflicts:parsed.conflicts+refs.errors.length,scope:data(),refs};
  const old=new Map(all().map(r=>[key(r),r]));let added=0,updated=0,unchanged=0;
  const equivalent=r=>JSON.stringify(r.slice(1,28));
  for(const r of parsed.rows){const prior=old.get(key(r));if(!prior)added++;else if(equivalent(prior)===equivalent(r))unchanged++;else updated++}
  Object.assign(pending,{added,updated,unchanged});
  const custom=Object.entries(mapping).some(([k,v])=>k.startsWith('custom:')&&Number(v)>=0);
  document.getElementById('patient-preview').innerHTML='<p>'+parsed.rows.length+' kunjungan valid · '+added+' baru · '+updated+' diperbarui · '+unchanged+' sama.</p>'+
   '<p class="sub">'+parsed.duplicates+' duplikasi · '+parsed.summaries+' baris total dilewati. '+refs.payers.length+' acuan penjamin dan '+refs.sources.length+' acuan sumber akan digabungkan.</p>'+
   (Number(mapping.revenue)<0?'<p role="status">Total Asuransi belum dipetakan. Pendapatan memakai Total Billing jika tersedia. Nilai kolom sumber tetap dipertahankan.</p>':'')+
   ([...(s.warnings||[]),...refs.warnings].length?'<p role="status">'+[...(s.warnings||[]),...refs.warnings].map(esc).join(' ')+'</p>':'')+
   (combinedErrors.length?'<p role="alert">'+combinedErrors.length+' masalah perlu diperiksa.</p><ul>'+combinedErrors.slice(0,8).map(e=>'<li>'+esc(e)+'</li>').join('')+'</ul>'+(!pending.conflicts&&parsed.rows.length?'<label><input type="checkbox" id="patient-skip-invalid"> Simpan '+parsed.rows.length+' baris valid saja dan lewati '+combinedErrors.length+' baris bermasalah.</label>':''):'')+
   (custom?'<label><input type="checkbox" id="patient-custom-confirm"> Saya setuju memperbarui nilai custom dari kolom yang dipetakan (nilai kosong dilewati).</label>':'')+
   table(displayColumns(),ui.previewEnrich(parsed.rows.slice(0,5)).map((r,i)=>cells(r,i,parsed.custom.find(c=>key(c.row)===key(r))?.values||{})).join(''))+'<p class="sub">Pratinjau hingga 5 baris. Ref terpilih diterapkan saat menyimpan. Isian tambahan dan log kontrol tetap melekat pada identitas yang sama.</p>';
  pending.needsCustomConfirm=custom;updateSave();
 }
 function updateSave(){document.querySelector('[data-form="patient-upload"] button.primary').disabled=!pending?.rows.length||!!pending.conflicts||!!pending.errors.length&&!pending.skipInvalid||pending.needsCustomConfirm&&!pending.customConfirmed}
 let request=0;
 async function change(target){
  if(target.id==='patient-skip-invalid'){if(pending)pending.skipInvalid=target.checked;updateSave();return true}
  if(target.id==='patient-custom-confirm'){if(pending)pending.customConfirmed=target.checked;updateSave();return true}
  if(target.id==='patient-profile-name'){profileName=target.value;return true}
  if(target.dataset.patientMap){mapping[target.dataset.patientMap]=Number(target.value);preview();return true}
  if(target.dataset.patientRef){refMapping[target.dataset.patientRef]=Number(target.value);preview();return true}
  if(target.id==='patient-sheet'){chooseSheet(Number(target.value));return true}
  if(target.id==='patient-header'){const n=Number(target.value);if(Number.isInteger(n)&&n>=1&&n<=Math.min(sections[selectedSheet].rows.length,100)){sections[selectedSheet].header=n-1;mapping=guessMapping(sections[selectedSheet].rows[n-1]);mappingControls();preview()}return true}
  if(target.id==='patient-profile'){const p=records('patient-import-profiles').find(p=>p.id===target.value);mapping=p?{...p.mapping}:guessMapping(sections[selectedSheet].rows[sections[selectedSheet].header]);if(p)profileName=p.name;mappingControls();preview();return true}
  if(target.id==='patient-ref-sheet'){refSheet=Number(target.value);if(refSheet>=0)refMapping=referenceGuess(sections[refSheet]);mappingControls();preview();return true}
  if(target.id==='patient-file'){
   const current=++request,f=target.form,file=target.files?.[0],workspace=data();pending=null;document.querySelector('[data-form="patient-upload"] button.primary').disabled=true;document.getElementById('patient-mapping').innerHTML='';const area=document.getElementById('patient-preview');area.textContent='Membaca file…';
   try{const sheets=patientSheets(await readPatientDocument(file));if(current!==request||!f.isConnected||workspace!==data())return true;if(!sheets.length)throw Error('Tidak ada sheet data.');fileName=file.name;sections=sheets;refSheet=sections.findIndex(s=>norm(s.name)==='ref');if(refSheet>=0)refMapping=referenceGuess(sections[refSheet]);const raw=sections.findIndex(s=>norm(s.name)==='raw');chooseSheet(raw>=0?raw:sections.reduce((best,s,i)=>Object.values(guessMapping(s.rows[s.header]||[])).filter(v=>v>=0).length>Object.values(guessMapping(sections[best].rows[sections[best].header]||[])).filter(v=>v>=0).length?i:best,0));}
   catch(e){if(current===request&&f.isConnected)area.textContent=e.message}return true;
  }
  const filters={'patients-query':v=>query=v,'patients-category':v=>category=v,'patients-unit':v=>unit=v,
   'patients-payor':v=>payor=v,'patients-type':v=>payerType=v,'patients-lab-exam':v=>labExam=v,'patients-from':v=>from=v,'patients-to':v=>to=v};
  if(filters[target.id]){filters[target.id](target.value);page=1;document.getElementById('patients-results').innerHTML=results();return true}
  return false;
 }
 const undoModules=['patient-buckets','ref-directory','patient-source-directory','patient-extra-buckets','patient-import-profiles'];
 const fingerprint=()=>{let h=2166136261;for(const c of JSON.stringify(undoModules.map(k=>records(k))))h=Math.imul(h^c.charCodeAt(0),16777619);return String(h>>>0)};
 function mutate(f){
  if(f?.dataset.form==='patient-undo'){
   const history=records('patient-imports').at(-1);if(!history?.undo||history.id!==f.dataset.id||history.undone)throw Error('Impor ini tidak dapat dibatalkan.');if(fingerprint()!==history.undo.after)throw Error('Data atau referensi telah berubah setelah impor. Pembatalan ditunda agar perubahan baru tidak hilang.');for(const k of undoModules)data().records[k]=history.undo.before[k];data().records['patient-imports']=records('patient-imports').map(r=>r.id===history.id?{...r,undone:true,undo:null}:r);return {page:'patients',message:'Impor terakhir dibatalkan. Data sebelum impor dipulihkan.'};
  }
  if(!pending||pending.scope!==data()||pending.conflicts||pending.errors.length&&!pending.skipInvalid||!pending.rows.length||pending.needsCustomConfirm&&!pending.customConfirmed)throw Error('Periksa pemetaan dan pratinjau upload terlebih dahulu.');
  const before=Object.fromEntries(undoModules.map(k=>[k,structuredClone(records(k))]));
  const replace=document.getElementById('patient-mode').value==='replace';const byId=new Map((replace?[]:records('patient-buckets')).map(b=>[b.id,b])),touched=new Map();
  for(const row of pending.rows){const id=bucket(row);if(!touched.has(id))touched.set(id,new Map((byId.get(id)?.rows||[]).map(r=>[key(r),r])));touched.get(id).set(key(row),row)}
  for(const [id,rows] of touched)byId.set(id,{id,rows:[...rows.values()]});data().records['patient-buckets']=[...byId.values()];
  if(pending.refs.payers.length)ui.putReferences(pending.refs.payers);
  const sourceList=records('patient-source-directory'),sourceMap=new Map(sourceList.map(r=>[matchKey(r.unit),r]));for(const r of pending.refs.sources)sourceMap.set(matchKey(r.unit),{...r,id:sourceMap.get(matchKey(r.unit))?.id||'source-'+ui.unique()});data().records['patient-source-directory']=[...sourceMap.values()];
  ui.writeCustomBatch(pending.custom);
  const signature=JSON.stringify(sections[selectedSheet].rows[sections[selectedSheet].header].map(norm));profileName=clean(document.getElementById('patient-profile-name')?.value||profileName).slice(0,120);
  if(profileName){const old=records('patient-import-profiles').find(p=>p.signature===signature),profile={id:old?.id||'profile-'+ui.unique(),name:profileName,signature,mapping:{...mapping}};data().records['patient-import-profiles']=old?records('patient-import-profiles').map(p=>p.id===old.id?profile:p):[...records('patient-import-profiles'),profile]}
  const {added,updated,unchanged}=pending,history={id:ui.unique(),fileName,sheet:sections[selectedSheet].name,profileName,mapping:{...mapping},refSheet:sections[refSheet]?.name||'',count:pending.rows.length,added,updated,unchanged,skipped:pending.errors.length,actor:ui.actor?.()||'Manager',uploadedAt:new Date().toISOString(),undo:{before,after:fingerprint()}};
  data().records['patient-imports']=[...records('patient-imports').map(({undo,...r})=>r),history];return {page:'patients',message:pending.rows.length+' kunjungan tersimpan. '+pending.errors.length+' baris dilewati.'};
 }
 return {view,change,mutate,all,sort(column,descending){sortColumn=column;sortDescending=descending;page=1;document.getElementById('patients-results').innerHTML=results()},click(d){
  if(d.patients==='upload')dialog();
  if(d.patients==='detail'){const row=enriched().find(r=>key(r)===d.patientKey);if(row)ui.detail(row)}
  if(d.patients==='undo'){const r=records('patient-imports').find(r=>r.id===d.importId);if(r?.undo)show('Batalkan impor terakhir',form('patient-undo','<p>Memulihkan data pasien, pemetaan, dan referensi sebelum upload '+esc(r.fileName)+'. Perubahan setelah impor harus belum terjadi.</p>','Pulihkan data sebelum impor','data-id="'+esc(r.id)+'"'));}
  if(d.patients==='previous'||d.patients==='next'){page+=d.patients==='next'?1:-1;document.getElementById('patients-results').innerHTML=results()}
 }};
}
