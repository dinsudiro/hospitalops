import {payerKey} from './hospitalops-directory.js';

export const cooperationTypes=['MCU','Rujukan Pasien','Rujukan Laboratorium','Rujukan Radiologi','PKRS / Edukasi','Lainnya'];
const mouStatuses=['Belum dicatat','Belum ada','Dalam proses','Ada PKS / MoU'];
const categorySuggestions=['Umum / Pribadi','BPJS Kesehatan','BPJS Ketenagakerjaan','Jasa Raharja','Perusahaan','Asuransi','Instansi','Lembaga','Komunitas','Organisasi','Sekolah','Mitra Rumah Sakit','Mitra Faskes','Klinik','Dokter Rujukan','Bidan Rujukan','Yayasan','Lainnya'];
export function sortPartners(groups,key='billing',direction='descending'){
 const sign=direction==='ascending'?1:-1;
 const numeric=['patientCount','visitCount','billing'].includes(key);
 return [...groups].sort((a,b)=>{
  const delta=numeric?Number(a[key])-Number(b[key]):String(a[key]||'').localeCompare(String(b[key]||''),'id-ID',{sensitivity:'base',numeric:true});
  return sign*delta||a.name.localeCompare(b.name);
 });
}
export function partnerProfileValues(values,old={}){
 const text=key=>String(values[key]??'').trim();
 const name=text('name').replace(/\s+/g,' '),type=text('type').replace(/\s+/g,' ');
 const lengths={name:180,type:100,location:400,picName:140,picPhone:60,cooperationOther:300,note:700};
 for(const [key,max] of Object.entries(lengths))if(text(key).length>max)throw Error('Isi profil melebihi panjang yang tersedia.');
 if(!name||!type||!mouStatuses.includes(values.mouStatus))throw Error('Lengkapi nama, kategori, dan status kerja sama.');
 const selected=[...new Set(values.cooperations||[])];
 if(selected.some(v=>!cooperationTypes.includes(v)))throw Error('Pilihan kerja sama tidak sesuai.');
 return {...old,name,type,location:text('location'),picName:text('picName'),picPhone:text('picPhone'),
  contact:text('picName'),mouStatus:values.mouStatus,agreementId:text('agreementId'),cooperations:selected,
  cooperationOther:selected.includes('Lainnya')?text('cooperationOther'):'',note:text('note')};
}

export function partnerBulkValues(items){
 if(!items.length||items.length>50)throw Error('Pilih 1–50 mitra untuk disimpan sekaligus.');
 const keys=new Set();
 return items.map(({values,old={}})=>{
  const key=payerKey(values.name);
  if(keys.has(key))throw Error('Mitra yang sama tidak boleh muncul dua kali.');
  keys.add(key);
  try{return partnerProfileValues(values,old)}catch(error){throw Error(values.name+': '+error.message)}
 });
}
async function stablePartnerId(name){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payerKey(name)));
 return 'partner-'+[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

const validRM=value=>value&&!/^(0+|[-—])$/.test(value);
function patientId(row){
 const rm=String(row[1]??'').trim();
 return validRM(rm)?'rm:'+rm:'registration:'+row[2];
}
export function summarizePartners(rows,profiles=[]){
 const groups=new Map();
 for(const profile of profiles){
  const key=payerKey(profile.name);
  if(!key)continue;
  if(!groups.has(key))groups.set(key,{key,name:profile.name,type:profile.type,profiles:[],rows:[],patients:new Set(),billing:0,missingBilling:0});
  groups.get(key).profiles.push(profile);
 }
 for(const row of rows){
  const key=payerKey(row[9]);if(!key)continue;
  if(!groups.has(key))groups.set(key,{key,name:String(row[9]).trim().replace(/\s+/g,' '),type:'Belum terpetakan',profiles:[],rows:[],patients:new Set(),billing:0,missingBilling:0});
  const group=groups.get(key);
  group.type=row[13]||'Belum terpetakan';
  group.rows.push(row);group.patients.add(patientId(row));group.billing+=Number(row[12])||0;
  if(row[12]===null||row[12]===undefined)group.missingBilling++;
 }
 return [...groups.values()].map(g=>({...g,patientCount:g.patients.size,visitCount:g.rows.length}))
  .sort((a,b)=>b.billing-a.billing||a.name.localeCompare(b.name));
}
export function createPartnerPatients(ui){
 const {rows,profiles,data,heading,panel,button,table,esc,fmt,money,options,show,label,input,select,form}=ui;
 let scope=null,query='',type='',source='',from='',to='',page=1,detailKey='',detailQuery='',detailPage=1,sortKey='billing',sortDirection='descending';
 const size=50;
 let bulk=null,bulkBusy=false;
 const filteredRows=()=>rows().filter(r=>(!from||r[5]>=from)&&(!to||r[5]<=to));
 const groups=()=>summarizePartners(filteredRows(),profiles());
 const find=key=>groups().find(g=>g.key===key);
 const plainButton=(title,action,extra='')=>button(title,'data-partner-patients="'+action+'" '+extra);
 const nameButton=g=>'<button class="rowbtn" data-partner-patients="detail" data-partner-key="'+esc(g.key)+'">'+esc(g.name)+'</button>';
 const profileButton=p=>button('Ubah profil','data-partner-patients="profile" data-partner-key="'+esc(payerKey(p.name))+'" data-profile-id="'+esc(p.id)+'"');
 function reset(){
  if(scope===data())return;
  scope=data();sortKey='billing';sortDirection='descending';query='';type='';source='';from='';to='';page=1;detailKey='';detailQuery='';detailPage=1;
 }
 function view(){
  reset();
  const types=[...new Set(groups().map(g=>g.type))].sort();
  const filters='<div class="filters"><input id="partner-patients-query" type="search" aria-label="Cari mitra" placeholder="Cari penjamin atau kategori…" value="'+esc(query)+'">'+
   '<select id="partner-patients-type" aria-label="Kategori mitra">'+options([['','Semua kategori'],...types],type)+'</select>'+
   '<select id="partner-patients-source" aria-label="Sumber mitra">'+options([['','Semua sumber'],['patients','Data Pasien'],['manual','Profil manual tanpa kunjungan']],source)+'</select>'+
   '<label>Dari <input id="partner-patients-from" type="date" aria-label="Kunjungan dari" value="'+esc(from)+'"></label>'+
   '<label>Sampai <input id="partner-patients-to" type="date" aria-label="Kunjungan sampai" value="'+esc(to)+'"></label></div>';
  return heading('Mitra B2B','Penjamin dari Data Pasien dikelompokkan otomatis menurut kategori di Ref Direktori.',
   button('Data Pasien','data-nav="patients"')+plainButton('Edit massal','bulk-open')+button('Tambah mitra','data-b2b="partner-new"','plus',true))+
   panel('Daftar mitra dan realisasi','Jumlah pasien memakai No RM. Jika No RM kosong atau 0, digunakan No Registrasi. Total billing berasal dari nilai Total Billing yang terisi.',
    filters+'<div id="partner-patients-results">'+results()+'</div>');
 }
 function pager(part,page,pages){
  return '<div class="actions">'+plainButton('Sebelumnya',part+'-previous',page===1?'disabled':'')+'<span>Halaman '+page+' / '+pages+'</span>'+
   plainButton('Berikutnya',part+'-next',page===pages?'disabled':'')+'</div>';
 }
 function selectedGroups(){return sortPartners(groups().filter(g=>(!type||g.type===type)&&payerKey(g.name+' '+g.type).includes(payerKey(query))&&
   (!source||source==='patients'&&g.visitCount>0||source==='manual'&&g.visitCount===0)),sortKey,sortDirection)}
 function results(){
  const selected=selectedGroups();
  const pages=Math.max(1,Math.ceil(selected.length/size));page=Math.min(page,pages);
  const body=selected.slice((page-1)*size,page*size).map(g=>'<tr><td>'+nameButton(g)+
   '<div class="sub">'+(g.visitCount?'Data Pasien':'Profil manual')+'</div></td><td>'+esc(g.type)+'</td><td>'+
   g.patientCount.toLocaleString('id-ID')+'</td><td>'+g.visitCount.toLocaleString('id-ID')+'</td><td>'+(g.visitCount&&g.missingBilling===g.visitCount?'—':money(g.billing))+(g.missingBilling?'<div class="sub">'+g.missingBilling+' billing kosong</div>':'')+'</td><td>'+
   (g.profiles.length?g.profiles.map(profileButton).join(' '):plainButton('Lengkapi profil','profile','data-partner-key="'+esc(g.key)+'"'))+'</td></tr>').join('');
  return (from&&to&&from>to?'<p role="alert">Tanggal sampai harus sama dengan atau setelah tanggal dari.</p>':'')+
   '<p class="sub">'+selected.length+' mitra · '+selected.reduce((s,g)=>s+g.visitCount,0).toLocaleString('id-ID')+' kunjungan · Total billing terisi '+
   money(selected.reduce((s,g)=>s+g.billing,0))+'</p>'+
   partnerTable(body||'<tr><td colspan="6">Belum ada mitra yang sesuai. Unggah laporan Data Pasien untuk menampilkan penjaminnya.</td></tr>')+pager('list',page,pages);
 }
 function partnerTable(body){
  const headers=[['name','Nama mitra / penjamin'],['type','Kategori mitra'],['patientCount','Jumlah pasien'],['visitCount','Kunjungan'],['billing','Total billing']];
  return '<div class="tablewrap"><table><thead><tr>'+headers.map(([key,title])=>'<th scope="col" aria-sort="'+(sortKey===key?sortDirection:'none')+'">'+
   plainButton(title+(sortKey===key?(sortDirection==='ascending'?' ↑':' ↓'):''),'sort','data-sort-key="'+key+'"')+'</th>').join('')+
   '<th scope="col">Profil</th></tr></thead><tbody>'+body+'</tbody></table></div>';
 }
 const documents=(g,p)=>ui.agreements().filter(a=>a.id===p?.agreementId||payerKey(a.partner)===g.key);
 function profileSummary(g){
  const p=g.profiles[0]||{},docs=documents(g,p);
  const rows=[['Kategori mitra',g.type],['Alamat',p.location||'Belum dicatat'],['Nama PIC',p.picName||p.contact||'Belum dicatat'],
   ['Telepon PIC',p.picPhone||'Belum dicatat'],['Status PKS / MoU',p.mouStatus|| (docs.length?'Ada PKS / MoU tercatat':'Belum dicatat')],
   ['Jenis kerja sama',Array.isArray(p.cooperations)&&p.cooperations.length?p.cooperations.map(v=>v==='Lainnya'&&p.cooperationOther?'Lainnya · '+p.cooperationOther:v).join(', '):'Belum dicatat']];
  return '<section class="ops-version"><h3>Profil mitra</h3><dl>'+rows.map(([name,value])=>'<dt>'+esc(name)+'</dt><dd>'+esc(value)+'</dd>').join('')+'</dl>'+
   (docs.length?'<div class="list">'+docs.map(a=>'<p>'+button(a.type+' · '+a.name,'data-ops="detail" data-ops-id="'+esc(a.id)+'"')+
    ' <span class="sub">'+fmt(a.start)+' – '+fmt(a.end)+'</span></p>').join('')+'</div>':'')+
   (p.note?'<p class="sub">'+esc(p.note)+'</p>':'')+
   '<div class="actions">'+(g.profiles.length?g.profiles.map(profileButton).join(' '):plainButton('Lengkapi profil','profile','data-partner-key="'+esc(g.key)+'"'))+'</div></section>';
 }
 function bulkEditor(){
  reset();
  const list=selectedGroups(),start=(page-1)*size,visible=list.slice(start,start+size);
  if(!visible.length){show('Edit massal mitra','<p>Belum ada mitra sesuai filter. Ubah filter atau unggah Data Pasien.</p>');return}
  bulk={scope:ui.workspaceKey?ui.workspaceKey():data(),items:visible.map(g=>{
   const p=g.profiles[0]||{},category=g.type!=='Belum terpetakan'?g.type:p.type||'';
   return {key:g.key,name:g.name,old:p,category};
  })};
  const categories=[...new Set([...categorySuggestions,...list.map(g=>g.type).filter(t=>t&&t!=='Belum terpetakan')])];
  const text=(i,name,value,max,type='text')=>input('bulk-'+i+'-'+name,value,type,'maxlength="'+max+'" aria-label="'+esc(name==='type'?'Kategori '+visible[i].name:name==='location'?'Alamat '+visible[i].name:name==='picName'?'Nama PIC '+visible[i].name:name==='picPhone'?'Telepon PIC '+visible[i].name:name==='cooperationOther'?'Kerja sama lainnya '+visible[i].name:'Catatan '+visible[i].name)+'" '+(name==='type'?'list="bulk-category-options"':''));
  const body=bulk.items.map(({name,old:p,category},i)=>{
   const prefix='bulk-'+i+'-',docs=ui.agreements();
   const agreements=[['','Tidak ditautkan'],...docs.map(a=>[a.id,a.type+' · '+a.partner+' · '+a.name])];
   if(p.agreementId&&!docs.some(a=>a.id===p.agreementId))agreements.push([p.agreementId,'Dokumen sebelumnya (tidak tersedia)']);
   return '<tr data-bulk-row="'+i+'"><td><input type="checkbox" name="'+prefix+'selected" aria-label="Pilih '+esc(name)+'"></td><th scope="row">'+esc(name)+'</th><td>'+text(i,'type',category,100)+'</td><td>'+text(i,'location',p.location,400)+'</td><td>'+text(i,'picName',p.picName||p.contact,140)+'</td><td>'+text(i,'picPhone',p.picPhone,60,'tel')+'</td><td>'+select(prefix+'mouStatus',mouStatuses,mouStatuses.includes(p.mouStatus)?p.mouStatus:'Belum dicatat','aria-label="Status MoU '+esc(name)+'"')+'</td><td>'+select(prefix+'agreementId',agreements,p.agreementId||'','aria-label="Dokumen MoU '+esc(name)+'"')+'</td><td><div class="bulk-cooperations">'+cooperationTypes.map(c=>'<label><input type="checkbox" name="'+prefix+'cooperations" value="'+esc(c)+'" '+(p.cooperations?.includes(c)?'checked':'')+'>'+esc(c)+'</label>').join('')+'</div></td><td>'+text(i,'cooperationOther',p.cooperationOther,300)+'</td><td>'+text(i,'note',p.note,700)+'</td></tr>';
  }).join('');
  const fields='<p>Edit profil langsung di tabel. Baris yang Anda ubah otomatis dipilih. Hanya mitra terpilih yang disimpan; kategori wajib diisi.</p>'+
   '<p class="sub">Menampilkan '+(start+1)+'–'+(start+visible.length)+' dari '+list.length+' mitra sesuai filter. Maksimal 50 mitra per penyimpanan. Untuk mitra berikutnya, simpan lalu gunakan halaman berikutnya atau filter di daftar mitra.</p>'+
   '<div class="bulk-toolbar"><label class="check"><input id="partner-bulk-all" type="checkbox">Pilih semua di halaman ini</label><span id="partner-bulk-count" role="status">0 mitra dipilih</span>'+label('Kategori untuk mitra terpilih',input('bulk-category','','text','id="partner-bulk-category" list="bulk-category-options" maxlength="100"'))+plainButton('Terapkan kategori','bulk-apply')+'</div>'+
   '<datalist id="bulk-category-options">'+categories.map(c=>'<option value="'+esc(c)+'"></option>').join('')+'</datalist>'+
   '<div class="tablewrap bulk-partner-table" tabindex="0" aria-label="Tabel edit massal mitra, geser ke kanan untuk kolom profil lainnya"><table><thead><tr>'+['Pilih','Nama mitra / penjamin','Kategori mitra','Alamat','Nama PIC','Telepon PIC','Status PKS / MoU','Dokumen PKS / MoU','Jenis kerja sama','Kerja sama lainnya','Catatan'].map(c=>'<th scope="col">'+c+'</th>').join('')+'</tr></thead><tbody>'+body+'</tbody></table></div>'+
   '<p class="sub">Geser tabel ke kanan untuk kolom lainnya. Kategori akan memperbarui Ref Direktori dan pemetaan Data Pasien. Memilih status MoU tidak membuat dokumen baru.</p>';
  show('Edit massal mitra',form('partner-bulk-save',fields,'Simpan mitra terpilih'));
  ui.wide();
 }
 function bulkSelection(){
  const f=document.querySelector('[data-form="partner-bulk-save"]');if(!f)return;
  const selected=f.querySelectorAll('[name$="-selected"]:checked').length;
  f.querySelector('#partner-bulk-count').textContent=selected+' mitra dipilih';
  const all=f.querySelector('#partner-bulk-all');all.checked=selected===bulk.items.length;all.indeterminate=selected>0&&selected<bulk.items.length;
 }
 async function bulkMutate(f){
  if(bulkBusy)throw Error('Penyimpanan sedang berjalan.');
  if(!bulk||bulk.scope!==(ui.workspaceKey?ui.workspaceKey():data()))throw Error('Organisasi berubah. Buka ulang edit massal.');
  const workspace=data(),values=new FormData(f),items=bulk.items.flatMap((item,i)=>{
   const prefix='bulk-'+i+'-';if(!values.has(prefix+'selected'))return [];
   const current=profiles().find(p=>p.id===item.old.id);
   if(item.old.id&&JSON.stringify(current)!==JSON.stringify(item.old))throw Error('Profil '+item.name+' berubah. Buka ulang edit massal.');
   const v={name:item.name};
   for(const k of ['type','location','picName','picPhone','mouStatus','agreementId','cooperationOther','note'])v[k]=values.get(prefix+k)||'';
   v.cooperations=values.getAll(prefix+'cooperations');
   return [{values:v,old:current||item.old}];
  });
  const updates=partnerBulkValues(items);
  for(const next of updates){
   const old=items.find(item=>payerKey(item.values.name)===payerKey(next.name)).old;
   if(next.agreementId&&next.agreementId!==old.agreementId&&!ui.agreements().some(a=>a.id===next.agreementId))throw Error('Dokumen MoU '+next.name+' tidak tersedia.');
   if(next.agreementId&&next.mouStatus==='Belum dicatat')next.mouStatus='Ada PKS / MoU';
  }
  bulkBusy=true;
  try{
   for(const next of updates)if(!next.id)next.id=await stablePartnerId(next.name);
   if(workspace!==data())throw Error('Organisasi berubah. Buka ulang edit massal.');
   const stored=new Map(profiles().map(p=>[p.id,p]));
   for(const next of updates)stored.set(next.id,next);
   data().records.partners=[...stored.values()];
   for(const next of updates)ui.setReferenceType(next.name,next.type);
   return {page:'partners',message:updates.length+' profil mitra dan kategori tersimpan. Pemetaan pasien diperbarui.'};
  }finally{bulkBusy=false}
 }
 function editor(profile,key=''){
  const g=key?find(key):profile?find(payerKey(profile.name)):null;
  const p=profile||g?.profiles[0]||{},name=p.name||g?.name||'';
  const category=g?.type&&g.type!=='Belum terpetakan'?g.type:p.type||'';
  const available=ui.agreements(),known=available.find(a=>a.id===p.agreementId);
  const status=mouStatuses.includes(p.mouStatus)?p.mouStatus:known?'Ada PKS / MoU':'Belum dicatat';
  const fields='<div class="ops-grid">'+label('Nama mitra',input('name',name,'text','required maxlength="180" '+(name?'readonly':'')))+
   label('Kategori mitra',input('type',category,'text','required maxlength="100" list="partner-categories"'))+
   '<datalist id="partner-categories">'+[...new Set([...categorySuggestions,category].filter(Boolean))].map(c=>'<option value="'+esc(c)+'"></option>').join('')+'</datalist>'+
   label('Nama PIC',input('picName',p.picName||p.contact,'text','maxlength="140"'))+
   label('Telepon PIC',input('picPhone',p.picPhone,'tel','maxlength="60"'))+
   label('Status PKS / MoU',select('mouStatus',mouStatuses,status))+
   label('Dokumen PKS / MoU',select('agreementId',[['','Pilih dokumen bila sudah tercatat'],...available.map(a=>[a.id,a.type+' · '+a.partner+' · '+a.name])],known?.id||''))+'</div>'+
   label('Alamat','<textarea name="location" maxlength="400">'+esc(p.location)+'</textarea>')+
   '<fieldset class="partner-cooperations"><legend>Jenis kerja sama</legend><div class="ops-grid">'+cooperationTypes.map(c=>'<label class="check"><input type="checkbox" name="cooperations" value="'+esc(c)+'" '+
    (Array.isArray(p.cooperations)&&p.cooperations.includes(c)?'checked':'')+'>'+esc(c)+'</label>').join('')+'</div></fieldset>'+
   label('Kerja sama lainnya',input('cooperationOther',p.cooperationOther,'text','maxlength="300"'))+
   label('Catatan','<textarea name="note" maxlength="700">'+esc(p.note)+'</textarea>')+
   '<p class="sub">Kategori yang disimpan juga diperbarui di Ref Direktori agar klasifikasi pasien tetap konsisten.</p>';
  show(name?'Profil · '+name:'Tambah mitra',form('partner-profile-save',fields,'Simpan profil',
   'data-id="'+esc(p.id||'')+'" data-partner-key="'+esc(g?.key||key||'')+'"'));
  ui.wide();
 }
 async function mutate(f,v){
  if(f.dataset.form==='partner-bulk-save')return bulkMutate(f);
  const workspace=data();
  const id=f.dataset.id,old=id?profiles().find(p=>p.id===id):profiles().find(p=>payerKey(p.name)===payerKey(v.name));
  if(id&&!old)throw Error('Profil tidak ditemukan. Buka ulang mitra.');
  const expected=old?payerKey(old.name):f.dataset.partnerKey;
  if(expected&&payerKey(v.name)!==expected)throw Error('Nama mitra harus sesuai penjamin asal.');
  const next=partnerProfileValues({...v,cooperations:new FormData(f).getAll('cooperations')},old);
  if(next.agreementId&&!ui.agreements().some(a=>a.id===next.agreementId))throw Error('Dokumen tidak tersedia.');
  if(next.agreementId&&next.mouStatus==='Belum dicatat')next.mouStatus='Ada PKS / MoU';
  if(!next.id){
   next.id=await stablePartnerId(next.name);
  }
  if(workspace!==data())throw Error('Organisasi berubah. Buka ulang profil mitra.');
  const existing=profiles().find(p=>p.id===next.id);
  data().records.partners=existing?profiles().map(p=>p.id===next.id?next:p):[...profiles(),next];
  ui.setReferenceType(next.name,next.type);
  return {page:'partners',partnerKey:payerKey(next.name),message:'Profil dan kategori mitra tersimpan.'};
 }
 function detail(){
  const g=find(detailKey);if(!g)return;
  const note=(from||to)?' · Periode '+(from?fmt(from):'awal data')+' – '+(to?fmt(to):'akhir data'):' · Seluruh periode';
  show('Mitra · '+g.name,'<div class="ops-stack">'+profileSummary(g)+'<h3>Pasien dan layanan</h3><p>'+esc(g.type)+note+'</p>'+
   '<p class="sub">'+g.patientCount+' pasien · '+g.visitCount+' kunjungan · Total billing terisi '+money(g.billing)+'</p>'+
   '<label>Cari pasien atau layanan<input id="partner-detail-query" type="search" aria-label="Cari rincian pasien" placeholder="Nama, RM, registrasi, unit, atau pemeriksaan…" value="'+esc(detailQuery)+'"></label>'+
   '<div id="partner-detail-results">'+detailResults()+'</div></div>');
  ui.wide();
 }
 function detailResults(){
  const g=find(detailKey);if(!g)return '<p>Mitra belum tersedia pada filter ini.</p>';
  const selected=g.rows.filter(r=>payerKey([r[1],r[2],r[4],r[8],r[14]].join(' ')).includes(payerKey(detailQuery)))
   .sort((a,b)=>b[5].localeCompare(a[5])||a[2].localeCompare(b[2]));
  const pages=Math.max(1,Math.ceil(selected.length/size));detailPage=Math.min(detailPage,pages);
  return '<p class="sub">'+selected.length+' kunjungan sesuai pencarian · Billing '+money(selected.reduce((sum,r)=>sum+Number(r[12]),0))+'</p>'+
   table(['Nama pasien','No RM','No registrasi','Tanggal masuk','Unit / layanan','Pemeriksaan lab','Billing'],
    selected.slice((detailPage-1)*size,detailPage*size).map(r=>'<tr><td>'+esc(r[4])+'</td><td>'+esc(r[1]||'—')+'</td><td>'+esc(r[2])+'</td><td>'+fmt(r[5])+
     '</td><td>'+esc(r[8])+'</td><td>'+esc(r[14]||'—')+'</td><td>'+(r[12]===null||r[12]===undefined?'—':money(r[12]))+'</td></tr>').join('')||
     '<tr><td colspan="7">Belum ada pasien sesuai pencarian.</td></tr>')+pager('detail',detailPage,pages);
 }
 function change(target){
  if(target.form?.dataset.form==='partner-bulk-save'){
   if(target.id==='partner-bulk-all'){
    target.form.querySelectorAll('[name$="-selected"]').forEach(c=>c.checked=target.checked);
   }else if(target.closest('[data-bulk-row]')&&!target.name.endsWith('-selected')){
    target.closest('[data-bulk-row]').querySelector('[name$="-selected"]').checked=true;
   }
   bulkSelection();return true;
  }
  if(target.id==='partner-detail-query'){
   detailQuery=target.value;detailPage=1;document.getElementById('partner-detail-results').innerHTML=detailResults();return true;
  }
  const fields={'partner-patients-query':v=>query=v,'partner-patients-type':v=>type=v,
   'partner-patients-source':v=>source=v,'partner-patients-from':v=>from=v,'partner-patients-to':v=>to=v};
  if(!fields[target.id])return false;
  fields[target.id](target.value);page=1;document.getElementById('partner-patients-results').innerHTML=results();return true;
 }
 return {view,change,mutate,editor,detailByKey(key){detailKey=key;detailQuery='';detailPage=1;detail()},click(d){
  if(d.partnerPatients==='bulk-open')return bulkEditor();
  if(d.partnerPatients==='bulk-apply'){
   const f=document.querySelector('[data-form="partner-bulk-save"]'),category=f?.querySelector('#partner-bulk-category').value.trim();
   const selected=f?.querySelectorAll('[name$="-selected"]:checked');
   if(!category||!selected?.length){document.getElementById('cloudError').textContent='Pilih mitra dan isi kategori terlebih dahulu.';return}
   selected.forEach(c=>c.closest('tr').querySelector('[name$="-type"]').value=category);
   document.getElementById('cloudError').textContent='';bulkSelection();return;
  }
  if(d.partnerPatients==='profile'){
   const p=profiles().find(p=>p.id===d.profileId);
   editor(p,d.partnerKey);return;
  }
  if(d.partnerPatients==='sort'){
   const keys=['name','type','patientCount','visitCount','billing'];
   if(!keys.includes(d.sortKey))return;
   sortDirection=sortKey===d.sortKey?(sortDirection==='ascending'?'descending':'ascending'):
    ['name','type'].includes(d.sortKey)?'ascending':'descending';
   sortKey=d.sortKey;page=1;document.getElementById('partner-patients-results').innerHTML=results();return;
  }
  if(d.partnerPatients==='detail'){detailKey=d.partnerKey;detailQuery='';detailPage=1;detail();return}
  if(d.partnerPatients.startsWith('list-')){
   page+=d.partnerPatients==='list-next'?1:-1;document.getElementById('partner-patients-results').innerHTML=results();return;
  }
  detailPage+=d.partnerPatients==='detail-next'?1:-1;
  document.getElementById('partner-detail-results').innerHTML=detailResults();
 }};
}
