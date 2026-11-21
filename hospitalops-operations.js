import {createDocumentUpload} from './hospitalops-documents.js?v=20261121-docflow1';
import {fieldsFor,guess,parseDate,prepareRows,readDocument} from './hospitalops-import.js';

import {partnerTypes,referralTypes} from './hospitalops-b2b.js';

const fields=['type','number','partner','name','scope','start','end','note'];
const DAY=86400000;
const referralStatuses=['Diterima','Terjadwal','Selesai','Batal'];
export function agreementStatus(record,today) {
 const version=[record,...(record.history||[])].find(v=>v.start<=today&&today<=v.end)||record;
 const days=Math.round((Date.parse(version.end)-Date.parse(today))/DAY);
 const name=version.start>today?'Belum mulai':days<0?'Berakhir':days<=30?'Segera berakhir':'Aktif';
 const countdown=version.start>today?'Mulai dalam '+Math.round((Date.parse(version.start)-Date.parse(today))/DAY)+' hari':days<0?'Lewat '+Math.abs(days)+' hari':days===0?'Berakhir hari ini':'Sisa '+days+' hari';
 return {name,countdown,version};
}
export function revise(values,old,today) {
 const next=Object.fromEntries(fields.map(k=>[k,String(values[k]??'').trim()]));
 if(!next.name||!next.partner||!next.scope||!['PKS','MoU'].includes(next.type))throw new Error('Isi judul, mitra, dan ruang lingkup.');
 if(!parseDate(next.start)||!parseDate(next.end)||next.start>next.end)throw new Error('Tanggal berakhir harus sama dengan atau setelah tanggal mulai.');
 const reason=String(values.reason||'').trim();
 if(old&&(!reason||fields.every(k=>next[k]===String(old[k]??''))&&!values.attachmentChanged))throw new Error('Masukkan perubahan dan alasannya.');
 if(old&&values.change==='Perpanjangan'&&next.end<=old.end)throw new Error('Perpanjangan harus memiliki tanggal berakhir yang lebih akhir.');
 const snapshot=old&&Object.fromEntries([...fields,'reason','change','version','savedAt','attachment','patientLinkStatus','patientPartner'].map(k=>[k,old[k]]));
 return {...next,version:(old?.version||0)+1,change:old?values.change:'Pencatatan awal',reason,savedAt:today,history:old?[snapshot,...(old.history||[])]:[]};
}

export function createOperations(ui) {
 const {allowed,mod,records,data,heading,panel,button,table,label,input,select,options,esc,fmt,show,form,today,unique,campaigns,statuses,stages}=ui;
 const text=(k,v,required=false)=>'<textarea name="'+k+'" maxlength="700" '+(required?'required':'')+'>'+esc(v)+'</textarea>';
 const date=(k,v)=>input(k,v,'date','required min="1900-01-01" max="2100-12-31"');
 const menu=()=>ui.modules().filter(id=>allowed(mod(id)));
 const documents=createDocumentUpload({...ui,esc,label,unique});
 let current=null;
 let filter='';
 const find=id=>records('pks').find(p=>p.id===id);
 const marker=status=>'<span class="pill '+(status.name==='Segera berakhir'?'warn':status.name==='Aktif'?'':'neutral')+'">'+status.name+'</span> '+status.countdown;
 function pksView(){
  const rows=records('pks').map(r=>({r,status:agreementStatus(r,today())})).sort((a,b)=>a.status.version.end.localeCompare(b.status.version.end));
  const selected=rows.filter(x=>!filter||x.status.name===filter);
  const body=selected.map(({r,status})=>'<tr><td><button class="rowbtn" data-ops="detail" data-ops-id="'+esc(r.id)+'">'+esc(r.name)+'</button><div class="sub">'+esc(r.number||'')+'</div></td><td>'+esc(r.type)+'</td><td>'+esc(r.partner)+'<div class="sub">'+esc(r.patientPartner?'Penjamin: '+r.patientPartner:r.patientLinkStatus==='not-yet'?'Belum ada penjamin pasien':'Belum ditautkan')+'</div></td><td>'+fmt(status.version.start)+' – '+fmt(status.version.end)+'</td><td>'+marker(status)+'</td><td>'+esc(r.version)+'</td></tr>').join('');
  return heading('PKS / MoU','Pantau masa berlaku dan buka riwayat tiap perjanjian.',button('Tambah perjanjian','data-ops="new"','plus',true))+
   panel('Daftar perjanjian',rows.length+' perjanjian · '+rows.filter(x=>x.status.name==='Segera berakhir').length+' segera berakhir',
    '<div class="filters"><select id="ops-status" aria-label="Status perjanjian">'+options([['','Semua status'],'Aktif','Segera berakhir','Berakhir','Belum mulai'],filter)+'</select></div>'+
    table(['Perjanjian','Jenis','Mitra','Masa berlaku','Status','Versi'],body||'<tr><td colspan="6">Belum ada perjanjian pada filter ini.</td></tr>'))+unlinkedPayers();
 }
 function unlinkedPayers(){
  const linked=records('pks').map(r=>r.patientPartner||(!r.patientLinkStatus?r.partner:''));
  const key=n=>String(n||'').trim().toLowerCase().replace(/\s+/g,' '),names=ui.patientPayers().filter(n=>!linked.some(l=>key(l)===key(n)));
  return '<details class="panel card"><summary>'+names.length+' penjamin pasien belum ditautkan ke PKS / MoU</summary><p class="sub">Penjamin memiliki kunjungan pasien, tetapi belum ada perjanjian yang ditautkan. Pilih mitra untuk mulai mencatat dokumennya.</p><div class="actions">'+names.slice(0,100).map(n=>button(n,'data-ops="new-for-payer" data-ops-payer="'+esc(n)+'"')).join('')+'</div></details>';
 }
 function version(r) {
  return '<div class="ops-version"><strong>Versi '+esc(r.version)+' · '+esc(r.change)+'</strong><p class="sub">'+fmt(r.savedAt)+'</p><dl>'+
   [['Jenis / nomor',r.type+' · '+(r.number||'–')],['Judul',r.name],['Mitra sesuai dokumen',r.partner],['Penjamin Data Pasien',r.patientPartner||'Belum ditautkan'],['Masa berlaku',fmt(r.start)+' – '+fmt(r.end)],['Ruang lingkup',r.scope],['Alasan',r.reason],['Catatan',r.note]]
   .filter(([,v])=>v).map(([k,v])=>'<dt>'+k+'</dt><dd>'+esc(v)+'</dd>').join('')+'</dl>'+(r.attachment?'<p>'+button('Buka dokumen · '+r.attachment.name,'data-ops="document-open" data-ops-id="'+esc(r.attachment.id)+'"')+'</p>':'')+'</div>';
 }
 function detail(r) {
  if(!r)return;
  const status=agreementStatus(r,today());
  show('Detail PKS / MoU','<div class="ops-stack"><p>'+marker(status)+(status.version!==r?' · Berdasarkan versi '+esc(status.version.version):'')+'</p>'+
   version(r)+'<div class="actions">'+button('Atur tautan penjamin','data-ops="link" data-ops-id="'+esc(r.id)+'"')+button('Catat perubahan','data-ops="revise" data-ops-id="'+esc(r.id)+'"','content')+
   button('Catat perpanjangan','data-ops="extend" data-ops-id="'+esc(r.id)+'"','calendar',true)+'</div><h3>Riwayat versi</h3>'+
   ((r.history||[]).map(h=>'<details><summary>Versi '+esc(h.version)+' · '+esc(h.change)+' · '+fmt(h.start)+' – '+fmt(h.end)+'</summary>'+version(h)+'</details>').join('')||'<p class="sub">Belum ada riwayat.</p>')+'</div>');
 }
 function payerChoices(r){
  const values=ui.patientPayers(),saved=r?.patientPartner;
  return [['','Pilih nama penjamin dari Data Pasien'],...values.map(n=>[n,n]),...(saved&&!values.includes(saved)?[[saved,saved+' · Tidak ada di unggahan aktif']]:[])];
 }
 function linkage(r){return '<fieldset class="partner-cooperations"><legend>Tautan ke Data Pasien</legend><div class="ops-grid">'+label('Ketersediaan mitra di Data Pasien',select('patientLinkStatus',[['not-yet','Belum ada nama penjamin di Data Pasien'],['linked','Sudah ada — pilih nama penjamin']],r?.patientPartner?'linked':'not-yet'))+label('Nama penjamin dari Data Pasien',select('patientPartner',payerChoices(r),r?.patientPartner||'',r?.patientPartner?'':'disabled'))+'</div><p class="sub">Nama mitra pada dokumen boleh berbeda dengan nama penjamin pasien. Penautan dipilih pengguna; tidak menebak nama secara otomatis.</p></fieldset>'}
 function validateLink(values,old){
  if(!['linked','not-yet'].includes(values.patientLinkStatus))throw Error('Pilih ketersediaan penjamin di Data Pasien.');
  const name=String(values.patientPartner||'');
  if(values.patientLinkStatus==='linked'&&(!name||!ui.patientPayers().includes(name)&&name!==old?.patientPartner))throw Error('Pilih nama penjamin yang tersedia di Data Pasien.');
  return {patientLinkStatus:values.patientLinkStatus,patientPartner:values.patientLinkStatus==='linked'?name:''};
 }
 function linkEditor(r){show('Tautkan penjamin · '+r.partner,form('ops-pks-link','<p>Nama sesuai dokumen: '+esc(r.partner)+'</p>'+linkage(r),'Simpan tautan','data-ops-id="'+esc(r.id)+'"'));ui.wide()}
 function agreement(r,change) {
  const controls=documents.controls(r?.attachment)+'<div class="ops-grid">'+label('Jenis',select('type',['PKS','MoU'],r?.type||'PKS'))+
   label('Nomor dokumen',input('number',r?.number,'text','maxlength="100"'))+
   label('Nama mitra sesuai PKS / MoU',input('partner',r?.partner,'text','required maxlength="140"'))+
   label('Judul perjanjian',input('name',r?.name,'text','required maxlength="140"'))+
   label('Tanggal mulai',date('start',r?.start||today()))+label('Tanggal berakhir',date('end',r?.end))+'</div>'+
   linkage(r)+label('Ruang lingkup',text('scope',r?.scope,true))+(r?label('Alasan '+change.toLowerCase(),text('reason','',true)):'')+
   label('Catatan',text('note',r?.note));
  show(r?'Catat '+change.toLowerCase():'Tambah PKS / MoU',form('ops-pks',controls,'Simpan','data-ops-id="'+esc(r?.id||'')+'" data-change="'+esc(change||'')+'"'));ui.wide();
 }
 function referralView() {
  const rows=[...records('referrals')].sort((a,b)=>b.date.localeCompare(a.date));
  const body=rows.map(r=>'<tr><td><button class="rowbtn" data-ops="referral-edit" data-ops-id="'+esc(r.id)+'">'+esc(r.name)+'</button><div class="sub">'+esc(r.partnerType)+'</div></td><td>'+
   esc(r.referralType)+'</td><td>'+esc(r.service)+'</td><td>'+fmt(r.date)+'</td><td>'+esc(r.count)+'</td><td>'+esc(r.status)+'</td></tr>').join('');
  return heading('Rujukan Mitra','Catat rujukan pasien langsung dan rujukan pemeriksaan dari mitra ke RS Ummi.',button('Tambah rujukan','data-ops="referral-new"','plus',true))+
   panel('Daftar rujukan',rows.length+' catatan',table(['Mitra','Jenis rujukan','Layanan / pemeriksaan','Tanggal','Jumlah','Status'],body||'<tr><td colspan="6">Belum ada rujukan tercatat.</td></tr>'));
 }
 function referral(r,context) {
  const link=context||ui.referralContext(r?.opportunityId);
  const identity=link?'<p class="sub">'+esc([link.name,link.partnerType,link.service,link.referralType].join(' · '))+'</p>':'<div class="ops-grid">'+
   label('Nama mitra',input('name',r?.name,'text','required maxlength="140"'))+
   label('Jenis mitra',select('partnerType',[['','Pilih jenis mitra'],...partnerTypes],r?.partnerType||'','required'))+
   label('Jenis rujukan',select('referralType',[['','Pilih jenis rujukan'],...referralTypes],r?.referralType||'','required'))+
   label('Layanan / pemeriksaan',input('service',r?.service,'text','required maxlength="140"'))+'</div>';
  const choices=(link?.sample||r?.status==='Sampel dikirim')?[...referralStatuses,'Sampel dikirim']:referralStatuses;
  const controls=identity+'<div class="ops-grid">'+
   label('Tanggal rujukan',date('date',r?.date||today()))+
   label('Jumlah rujukan',input('count',r?.count??1,'number','required min="1" max="999999" step="1"'))+
   label('Status',select('status',choices,r?.status||'Diterima'))+'</div>'+
   label('Catatan',text('note',r?.note));
  show(r?'Edit rujukan':'Tambah rujukan',form('ops-referral',controls,'Simpan','data-ops-id="'+esc(r?.id||'')+'" data-opportunity-id="'+esc(link?.opportunityId||'')+'"'));
 }
 function importView() {
  return heading('Impor Dokumen','Baca dokumen, cocokkan kolom, lalu periksa hasil sebelum menyimpan.')+
   panel('Modul tujuan','Pilih modul agar hasil impor mengikuti kolom HospitalOps.',
    '<div class="actions">'+menu().map(id=>button(mod(id)[1],'data-ops="import" data-ops-id="'+esc(id)+'"','content')).join('')+'</div>');
 }
 function importDialog(id) {
  if(!menu().includes(id))return;
  current={id,sections:[],section:0,header:0,mapping:{},valid:[],ready:false};
  show('Impor ke '+mod(id)[1],'<div class="ops-stack">'+
   label('File Excel, Word, atau PDF','<input id="ops-file" type="file" accept=".xlsx,.xls,.csv,.docx,.pdf">')+
   '<div class="actions">'+button('Unduh contoh CSV','data-ops="template"')+'</div>'+
   '<div id="ops-message" class="sub" role="status">Gunakan tabel dengan judul kolom atau teks berlabel. Maksimal 10 MB dan 100 catatan per impor.</div>'+
   '<div id="ops-sheet-controls"></div><div id="ops-preview"></div></div>');
 }
 function preview(rebuild=false) {
  const sheet=current.sections[current.section],target=document.querySelector('#ops-preview');
  if(!sheet||!target)return;
  const list=fieldsFor(current.id),header=sheet.rows[current.header];
  if(rebuild){
   current.mapping=guess(list,header);
   document.querySelector('#ops-sheet-controls').innerHTML='<div class="ops-grid">'+
    label('Bagian dokumen','<select id="ops-section">'+options(current.sections.map((x,i)=>[i,x.name]),current.section)+'</select>')+
    label('Baris judul kolom','<select id="ops-header">'+options(sheet.rows.slice(0,30).map((r,i)=>[i,'Baris '+(i+1)+' · '+r.slice(0,4).map(x=>String(x).slice(0,32)).join(' / ')]),current.header)+'</select>')+'</div>';
  }
  const result=prepareRows({module:current.id,rows:sheet.rows.slice(current.header+1),fields:list,mapping:current.mapping,campaigns:campaigns(),existing:records(current.id),statuses:current.id==='pipeline'?stages:statuses});
  current.valid=result.filter(r=>!r.issues.length);
  current.ready=current.valid.length>0&&current.valid.length<=100;
  const cols=[[-1,'Lewati'],...header.map((x,i)=>[i,'Kolom '+(i+1)+' · '+String(x).slice(0,80)])];
  const displayed=list.filter(([k])=>current.mapping[k]>=0);
  const sorted=[...result.filter(r=>r.issues.length),...current.valid].slice(0,30);
  const rows=sorted.map(r=>'<tr><td>'+(current.header+r.index+2)+'</td>'+
   displayed.map(([k])=>'<td>'+esc(String(r.item[k]??'–').slice(0,140))+'</td>').join('')+
   '<td>'+esc(r.issues.join(' · ')||'Siap')+'</td></tr>').join('');
  target.innerHTML='<details '+(!current.ready?'open':'')+'><summary>Cocokkan kolom dokumen</summary><div class="ops-grid">'+
   list.map(([k,n])=>label(n,'<select data-ops-field="'+k+'">'+options(cols,current.mapping[k])+'</select>')).join('')+'</div></details>'+
   '<p class="sub" role="status">'+current.valid.length+' siap · '+(result.length-current.valid.length)+' dilewati'+(result.length>30?' · Pratinjau sampai 30 baris':'')+
   (current.valid.length>100?' · Bagi file menjadi beberapa bagian.':'')+'</p>'+
   (rows?table(['Baris',...displayed.map(([,n])=>n),'Pemeriksaan'],rows):'<p class="sub">Belum ada baris data.</p>')+
   (current.ready?form('ops-import','','Simpan '+current.valid.length+' catatan'):'');
 }
 async function change(element) {
  if(element.form?.dataset.form==='ops-pks'&&element.id==='source-document')return documents.change(element,'agreement');
  if(element.name==='patientLinkStatus'&&element.form?.elements.patientPartner){element.form.elements.patientPartner.disabled=element.value!=='linked';if(element.value!=='linked')element.form.elements.patientPartner.value='';return true}

  if(element.id==='ops-status'){filter=element.value;ui.render();document.querySelector('#ops-status')?.focus();return true}
  if(!current)return false;
  if(element.id==='ops-file'){
   const session=current, message=document.querySelector('#ops-message');
   current.ready=false;current.sections=[];document.querySelector('#ops-sheet-controls').innerHTML='';document.querySelector('#ops-preview').innerHTML='';
   if(!element.files.length)return true;
   element.disabled=true;message.textContent='Sedang membaca dokumen…';
   try{
    const result=await readDocument(element.files[0]);
    if(current!==session||!message.isConnected)return true;
    current.sections=result.filter(s=>s.rows.length>1&&s.rows.length<=2000&&s.rows.every(r=>r.length<=100));
    if(!current.sections.length)throw new Error('Tidak ada tabel yang terbaca. Gunakan contoh CSV atau periksa format dokumen.');
    current.section=0;current.header=0;
    message.textContent=element.files[0].name+' · '+current.sections.length+' bagian siap diperiksa.'+(result.length>current.sections.length?' Bagian kosong atau di luar batas ukuran dilewati.':'');
    preview(true);
   }catch(error){if(current===session)message.textContent=error.message}
   finally{element.disabled=false}
   return true;
  }
  if(element.id==='ops-section'){current.section=Number(element.value);current.header=0;preview(true);return true}
  if(element.id==='ops-header'){current.header=Number(element.value);preview(true);return true}
  if(element.dataset.opsField){const key=element.dataset.opsField;current.mapping[key]=Number(element.value);preview();const field=document.querySelector('[data-ops-field="'+key+'"]');field.closest('details').open=true;field.focus();return true}
  return false;
 }
 function template() {
  if(!current)return;
  const csv='\uFEFF'+fieldsFor(current.id).map(([,n])=>'"'+n.replaceAll('"','""')+'"').join(',')+'\r\n';
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');
  link.href=url;link.download='hospitalops-'+current.id+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return {
  pksView,referralView,importView,change,
  newReferral(id){
   const link=ui.referralContext(id);
   if(link&&!link.closed&&allowed(mod('referrals')))referral(null,link);
  },
  click(d){
   if(d.ops==='import')return importDialog(d.opsId);
   if(d.ops==='template')return template();
   if(d.ops==='referral-new'||d.ops==='referral-edit'){
    if(!allowed(mod('referrals')))return;
    if(d.ops==='referral-new')return referral();
    const row=records('referrals').find(r=>r.id===d.opsId);
    if(row)return referral(row);
    return;
   }
   if(!allowed(mod('pks')))return;
   if(d.ops==='document-open'){const attachment=records('pks').flatMap(r=>[r,...(r.history||[])]).map(r=>r.attachment).find(a=>a?.id===d.opsId);if(attachment)documents.open(attachment).catch(error=>document.querySelector('#cloudError').textContent=error.message);return}

   const r=find(d.opsId);
   if(d.ops==='new')agreement();
   if(d.ops==='new-for-payer'){agreement();const f=document.querySelector('[data-form="ops-pks"]');f.elements.patientLinkStatus.value='linked';f.elements.patientPartner.disabled=false;f.elements.patientPartner.value=d.opsPayer;}
   if(d.ops==='detail'&&r)detail(r);
   if(d.ops==='link'&&r)linkEditor(r);
   if(d.ops==='revise'&&r)agreement(r,'Perubahan');
   if(d.ops==='extend'&&r)agreement(r,'Perpanjangan');
  },
  async mutate(f,values){
   if(f.dataset.form==='ops-pks-link'){
    const old=find(f.dataset.opsId);if(!old||!allowed(mod('pks')))throw Error('Perjanjian tidak ditemukan.');
    const next={...old,...validateLink(values,old)};data().records.pks=records('pks').map(r=>r.id===old.id?next:r);
    return {page:'pks',message:'Tautan penjamin tersimpan tanpa mengubah versi perjanjian.'};
   }
   if(f.dataset.form==='ops-referral'){
    if(!allowed(mod('referrals')))throw new Error('Modul dinonaktifkan.');
    const rows=records('referrals');
    const old=rows.find(r=>r.id===f.dataset.opsId);
    if(f.dataset.opsId&&!old)throw new Error('Rujukan tidak ditemukan.');
    const opportunityId=f.dataset.opportunityId||old?.opportunityId||'';
    const link=opportunityId?ui.referralContext(opportunityId):null;
    if(f.dataset.opportunityId&&(!link||(!old&&link.closed)))throw new Error('Peluang rujukan tidak tersedia.');
    const {partnerType,referralType,name:rawName,service:rawService}=link||values;
    const {date,status}=values, name=rawName.trim(),service=rawService.trim(),count=Number(values.count);
    if(!name||!service||(!link&&!partnerTypes.includes(partnerType))||!referralTypes.includes(referralType)||
      (!referralStatuses.includes(status)&&!(status==='Sampel dikirim'&&(link?.sample||old?.status===status)))||parseDate(date)!==date||!Number.isInteger(count)||count<1||count>999999){
     throw new Error('Periksa kembali mitra, layanan, tanggal, dan jumlah rujukan.');
    }
    if(opportunityId&&['Selesai','Sampel dikirim'].includes(status)&&(date>today()||link?.closed)){
     throw new Error('Realisasi rujukan memerlukan peluang yang terbuka dan tanggal hingga hari ini.');
    }
    const next={id:old?.id||unique(),name,partnerType,referralType,service,date,count,status,note:values.note.trim(),...(opportunityId?{opportunityId}:{})};
    data().records.referrals=old?rows.map(r=>r.id===old.id?next:r):[...rows,next];
    return {page:f.dataset.opportunityId&&!old?'pipeline':'referrals',opportunityId:f.dataset.opportunityId&&!old?opportunityId:'',message:'Rujukan tersimpan.'};
   }
   if(f.dataset.form==='ops-pks'){
    if(!allowed(mod('pks')))throw new Error('Modul dinonaktifkan.');
    const old=find(f.dataset.opsId), existing=records('pks');
    if(f.dataset.opsId&&!old)throw new Error('Perjanjian tidak ditemukan.');
    const workspace=data(),link=validateLink(values,old);
    const revised=revise({...values,change:f.dataset.change,attachmentChanged:documents.changed()},old,today());
    const attachment=await documents.save(old?.attachment);
    if(workspace!==data())throw Error('Organisasi berubah. Buka ulang perjanjian.');
    const next={id:old?.id||unique(),...revised,...link,attachment};
    data().records.pks=old?existing.map(r=>r.id===old.id?next:r):[...existing,next];
    return {page:'pks',message:'Perjanjian tersimpan.'};
   }
   if(!current?.ready||!menu().includes(current.id))throw new Error('Periksa kembali hasil impor.');
   const id=current.id;
   const entries=current.valid.map(({item})=>{
    const row={id:unique(),owner:'Manager',...item};
    if(id==='promo')row.campaign=row.id;
    return row;
   });
   data().records[id]=[...records(id),...entries];
   return {page:id,message:entries.length+' catatan berhasil diimpor.'};
  }
 };
}
