import {enrichPatientSources,parsePatientReferences,matchKey} from './hospitalops-patient-model.js?v=20261125-flex1';
import {compareSortValues} from './hospitalops-table-sort.js?v=20261121-sortcards1';
import {norm,readDocument} from './hospitalops-import.js';

export const payerKey=value=>String(value??'').trim().replace(/\s+/g,' ').toLocaleLowerCase('id-ID');
const nameHeaders=['penjamin','nama mitra','nama penjamin'];
const typeHeaders=['tipe penjamin','kategori mitra','tipe mitra'];
export function parseDirectory(sections){
 const reference=sections.filter(s=>norm(s.name)==='ref');
 const candidates=reference.length?reference:sections;
 const map=new Map(),errors=[];let skipped=0;
 for(const section of candidates){
  const header=section.rows.findIndex(r=>r.some(v=>typeHeaders.includes(norm(v))));
  if(header<0)continue;
  const names=section.rows[header].map(norm),typeIndex=names.findIndex(v=>typeHeaders.includes(v));
  const adjacent=typeIndex-1;
  const nameIndex=nameHeaders.includes(names[adjacent])?adjacent:names.findIndex(v=>nameHeaders.includes(v));
  if(nameIndex<0)continue;
  for(const [index,row] of section.rows.slice(header+1).entries()){
   const name=String(row[nameIndex]??'').trim().replace(/\s+/g,' '),type=String(row[typeIndex]??'').trim().replace(/\s+/g,' ');
   if(!name&&!type)continue;
   if(!name||!type){skipped++;continue}
   if(name.length>180||type.length>100){errors.push('Baris '+(header+index+2)+' melebihi panjang nama atau tipe.');continue}
   const key=payerKey(name);
   if(map.has(key)&&payerKey(map.get(key).type)!==payerKey(type))errors.push('Penjamin '+name+' memiliki lebih dari satu tipe di file.');
   else map.set(key,{name,type});
  }
 }
 if(!map.size&&!errors.length)errors.push('Kolom Penjamin dan Tipe Penjamin belum ditemukan. Pilih workbook Cohort atau tabel referensi.');
 return {rows:[...map.values()],errors,skipped};
}
export function enrichPatients(rows,directory){
 const map=new Map();
 for(const entry of directory){
  const key=payerKey(entry.name);
  if(map.has(key)&&payerKey(map.get(key))!==payerKey(entry.type))map.set(key,'Perlu diperiksa');
  else if(!map.has(key))map.set(key,entry.type);
 }
 return rows.map(row=>[...row.slice(0,13),map.get(payerKey(row[9]))||row[13]||'Belum terpetakan',row[14]??null,...row.slice(15)]);
}
function bucket(name){
 let hash=2166136261;for(const c of payerKey(name))hash=Math.imul(hash^c.charCodeAt(0),16777619);
 return 'directory-'+((hash>>>0)%32);
}
export function directoryRecords(rows){
 const buckets=new Map();
 for(const entry of rows){
  const id=bucket(entry.name);
  if(!buckets.has(id))buckets.set(id,{id,rows:[]});
  buckets.get(id).rows.push(entry);
 }
 return [...buckets.values()];
}
export function createDirectory(ui){
 const {data,records,heading,panel,button,table,esc,label,input,show,form}=ui;
 const entries=()=>records('ref-directory').flatMap(b=>b.rows||[]);
 let pending=null,scope=null,query='',page=1,request=0,sortColumn=0,sortDescending=false;
 const action=(name,act,key='',primary=false)=>button(name,'data-directory="'+act+'" data-directory-key="'+esc(key)+'"',primary?'plus':'',primary);
 function put(rows){
  const existing=new Map(records('ref-directory').map(b=>[b.id,b]));
  const touched=new Map();
  for(const r of rows){
   const id=bucket(r.name);
   if(!touched.has(id))touched.set(id,new Map((existing.get(id)?.rows||[]).map(e=>[payerKey(e.name),e])));
   touched.get(id).set(payerKey(r.name),r);
  }
  for(const [id,values] of touched)existing.set(id,{id,rows:[...values.values()]});
  data().records['ref-directory']=[...existing.values()];
 }
 function view(){
  if(scope!==data()){scope=data();query='';page=1;pending=null;sortColumn=0;sortDescending=false}
  return heading('Ref Direktori','Referensi nama penjamin dan Tipe Penjamin untuk Data Pasien.',button('Tarif Lab B2B','data-nav="lab-tariffs"')+action('Upload Ref','upload')+action('Tambah referensi','new','',true))+
   (ui.labPanel?.()||'')+panel('Direktori penjamin','Perubahan tipe langsung digunakan oleh tabel dan visualisasi pasien.',
    '<div class="filters"><input id="directory-query" aria-label="Cari referensi" type="search" placeholder="Cari penjamin atau tipe…" value="'+esc(query)+'"></div>'+
    '<div id="directory-results">'+results()+'</div>');
 }
 function results(){
  const list=entries().filter(e=>payerKey(e.name+' '+e.type).includes(payerKey(query))).sort((a,b)=>compareSortValues(sortColumn===1?a.type:a.name,sortColumn===1?b.type:b.name,sortDescending)||a.name.localeCompare(b.name));
  const pages=Math.max(1,Math.ceil(list.length/50));page=Math.min(page,pages);
  return '<p class="sub">'+list.length+' referensi</p>'+table(['Penjamin / Nama Mitra','Tipe Penjamin','Aksi'],list.slice((page-1)*50,page*50).map(e=>
   '<tr><td>'+esc(e.name)+'</td><td>'+esc(e.type)+'</td><td>'+action('Ubah','edit',payerKey(e.name))+'</td></tr>').join('')||
   '<tr><td colspan="3">Belum ada referensi. Unggah sheet Ref atau tambah referensi.</td></tr>')+
   '<div class="actions">'+button('Sebelumnya','data-directory="previous" '+(page===1?'disabled':''))+'<span>Halaman '+page+' / '+pages+'</span>'+
   button('Berikutnya','data-directory="next" '+(page===pages?'disabled':''))+'</div>';
 }
 function editor(entry,prefill=''){
  const suggestions=[...new Set(entries().map(e=>e.type))].sort();
  show(entry?'Ubah referensi':'Tambah referensi',form('directory-save',
   label('Nama penjamin / mitra',input('name',entry?.name||prefill,'text','required maxlength="180" '+(entry?'readonly':'')))+
   label('Tipe Penjamin',input('type',entry?.type,'text','required maxlength="100" list="directory-types"'))+
   '<datalist id="directory-types">'+suggestions.map(type=>'<option value="'+esc(type)+'"></option>').join('')+'</datalist>',
   'Simpan referensi','data-key="'+esc(entry?payerKey(entry.name):'')+'"'));
 }
 function upload(){
  pending=null;
  show('Upload Ref Direktori',form('directory-import',
   '<p class="sub">Pilih file Cohort dengan sheet Ref, atau tabel berkolom Penjamin dan Tipe Penjamin. Referensi yang sama diperbarui.</p>'+
   label('File referensi','<input id="directory-file" type="file" accept=".xlsx,.xls,.csv" required>')+
   '<div id="directory-preview" aria-live="polite"></div>','Simpan referensi'));
  ui.wide();document.querySelector('[data-form="directory-import"] button.primary').disabled=true;
 }
 async function change(target){
  if(target.id==='directory-query'){query=target.value;page=1;document.getElementById('directory-results').innerHTML=results();return true}
  if(target.id!=='directory-file')return false;
  const token=++request,f=target.form,workspace=data(),area=document.getElementById('directory-preview');
  pending=null;f.querySelector('button.primary').disabled=true;area.textContent='Membaca referensi…';
  try{
   const file=target.files?.[0];
   const sections=await readDocument(file,{maxSize:75*1024*1024}),result=parseDirectory(sections),ref=sections.find(s=>norm(s.name)==='ref');
   const sourceRef=ref?parsePatientReferences(ref):{sources:[],errors:[]};result.sources=sourceRef.sources;result.errors.push(...sourceRef.errors);
   if(token!==request||!f.isConnected||workspace!==data())return true;
   pending={...result,scope:workspace};
   const old=new Map(entries().map(e=>[payerKey(e.name),e]));
   const added=result.rows.filter(e=>!old.has(payerKey(e.name))).length;
   area.innerHTML='<p>'+result.rows.length+' referensi · '+added+' baru · '+(result.rows.length-added)+' sudah terdaftar.</p>'+
    (result.skipped?'<p class="sub">'+result.skipped+' baris dengan nama atau tipe kosong dilewati dan tetap belum terpetakan.</p>':'')+
    (result.errors.length?'<p role="alert">'+result.errors.slice(0,5).map(esc).join('<br>')+'</p>':'')+
    table(['Penjamin','Tipe Penjamin'],result.rows.slice(0,8).map(e=>'<tr><td>'+esc(e.name)+'</td><td>'+esc(e.type)+'</td></tr>').join(''))+
    '<p class="sub">Pratinjau menampilkan hingga 8 referensi.</p>';
   f.querySelector('button.primary').disabled=!!result.errors.length||!result.rows.length;
  }catch(error){if(f.isConnected&&token===request)area.textContent=error.message}
  return true;
 }
 function mutate(f,v){
  if(f.dataset.form==='directory-import'){
   if(!pending||pending.scope!==data()||pending.errors.length||!pending.rows.length)throw Error('Periksa pratinjau referensi.');
   put(pending.rows);
   const map=new Map(records('patient-source-directory').map(r=>[matchKey(r.unit),r]));for(const r of pending.sources||[])map.set(matchKey(r.unit),{...r,id:map.get(matchKey(r.unit))?.id||'source-'+Date.now().toString(36)+'-'+map.size});data().records['patient-source-directory']=[...map.values()];
  }else{
   const name=String(v.name||'').trim().replace(/\s+/g,' '),type=String(v.type||'').trim().replace(/\s+/g,' ');
   if(!name||!type||name.length>180||type.length>100)throw Error('Lengkapi nama dan tipe penjamin.');
   const match=entries().find(e=>payerKey(e.name)===payerKey(name));
   if(!f.dataset.key&&match)throw Error('Penjamin sudah ada. Gunakan Ubah untuk memperbarui tipenya.');
   if(f.dataset.key&&(!match||payerKey(name)!==f.dataset.key))throw Error('Referensi tidak ditemukan. Buka ulang direktori.');
   put([{name,type}]);
  }
  return {page:'directory',message:'Referensi tersimpan. Tipe Penjamin pasien otomatis menyesuaikan.'};
 }
 return {view,change,mutate,entries,put,sort(column,descending){sortColumn=column;sortDescending=descending;page=1;document.getElementById('directory-results').innerHTML=results()},setType:(name,type)=>put([{name,type}]),patients:rows=>ui.enrichLab(enrichPatientSources(enrichPatients(rows,entries()),records('patient-source-directory'))),click(d){
  if(d.directory==='new')return editor(null,d.directoryKey||'');
  if(d.directory==='upload')return upload();
  if(d.directory==='edit'){const entry=entries().find(e=>payerKey(e.name)===d.directoryKey);if(entry)editor(entry)}
  if(['next','previous'].includes(d.directory)){page+=d.directory==='next'?1:-1;document.getElementById('directory-results').innerHTML=results()}
 }};
}
