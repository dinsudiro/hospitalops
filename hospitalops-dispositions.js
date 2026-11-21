import {parseDate} from './hospitalops-import.js';
import {createDocumentUpload} from './hospitalops-documents.js?v=20261121-docflow1';
import {demoMarketingAccounts} from './hospitalops-partner-patients.js?v=20261121-docflow1';
export function dispositionValues(v,accounts=demoMarketingAccounts){
 const text=k=>String(v[k]||'').trim(),name=text('name'),summary=text('summary'),date=text('date'),deadline=v.hasDeadline==='yes'?text('deadline'):'';
 const account=accounts.find(a=>a.id===v.assigneeId);
 if(!name||!summary||name.length>180||summary.length>2000||text('sender').length>180||text('number').length>100||text('result').length>2000||text('note').length>2000)throw Error('Lengkapi perihal dan ringkasan surat sesuai batas kolom.');
 if(!account)throw Error('Pilih PIC tindak lanjut dari daftar staf.');
 if(!['yes','no'].includes(v.hasDeadline)||!parseDate(date)||v.hasDeadline==='yes'&&(!parseDate(deadline)||deadline<date))throw Error('Periksa tanggal surat dan tenggat tindak lanjut.');
 if(!['Terjadwal','Diproses','Selesai'].includes(v.status))throw Error('Pilih status tindak lanjut.');
 if(v.status==='Selesai'&&!text('result'))throw Error('Isi hasil tindak lanjut sebelum menandai selesai.');
 return {name,summary,date,number:text('number'),sender:text('sender'),assigneeId:account.id,assigneeName:account.name,assigneeUsername:account.username,hasDeadline:v.hasDeadline==='yes',deadline,status:v.status,result:text('result'),note:text('note')};
}
export function dispositionTask(letter,old={}){
 return {...old,id:letter.taskId||'disposition-task-'+letter.id,dispositionId:letter.id,name:'Disposisi · '+letter.name,owner:letter.assigneeName+' ('+letter.assigneeUsername+')',assigneeId:letter.assigneeId,date:letter.deadline||letter.date,noDeadline:!letter.hasDeadline,status:letter.status,campaign:'',note:'Surat: '+(letter.number||'Tanpa nomor')+'\n'+letter.summary+'\nTenggat: '+(letter.deadline||'Tanpa tenggat')+'\nHasil: '+(letter.result||'Belum dicatat')};
}
export function createDispositions(ui){
 const {records,data,heading,panel,button,table,label,input,select,esc,fmt,show,form,unique,today}=ui;
 const accounts=()=>ui.marketingAccounts?.()||demoMarketingAccounts,documents=createDocumentUpload(ui);
 let query='',status='',scope=null;
 const act=(text,action,id='',primary=false)=>button(text,'data-disposition="'+action+'" data-disposition-id="'+esc(id)+'"',primary?'plus':'',primary);
 const textarea=(name,value)=>'<textarea name="'+name+'" maxlength="2000">'+esc(value)+'</textarea>';
 function view(){
  if(scope!==data()){scope=data();query='';status=''}
  const all=records('dispositions'),list=all.filter(r=>(!status||r.status===status)&&[r.name,r.number,r.sender,r.assigneeName,r.assigneeUsername].join(' ').toLowerCase().includes(query.toLowerCase())).sort((a,b)=>b.date.localeCompare(a.date));
  return heading('Surat Disposisi','Catat surat masuk dan tindak lanjutnya. PIC, tenggat, status, dan hasil tersinkron dengan Delegasi Tugas.',act('Catat / upload surat','new','',true))+
   panel('Surat dan tindak lanjut',all.length+' surat · '+all.filter(r=>r.deadline&&r.deadline<today()&&r.status!=='Selesai').length+' melewati tenggat',
    '<div class="filters">'+input('disposition-search',query,'search','id="disposition-search" aria-label="Cari surat disposisi" placeholder="Cari perihal, nomor, pengirim, atau PIC…"')+select('disposition-status',[['','Semua status'],'Terjadwal','Diproses','Selesai'],status,'id="disposition-status" aria-label="Status disposisi"')+'</div>'+
    table(['Surat / perihal','Pengirim','PIC tindak lanjut','Tenggat','Status','Hasil tindak lanjut','Aksi'],list.map(r=>'<tr><td>'+act(r.name,'edit',r.id)+'<div class="sub">'+esc(r.number||'Tanpa nomor')+' · '+fmt(r.date)+'</div></td><td>'+esc(r.sender||'—')+'</td><td>'+esc(r.assigneeName+' ('+r.assigneeUsername+')')+'</td><td data-sort-value="'+esc(r.deadline||'')+'">'+ (r.deadline?fmt(r.deadline)+(r.deadline<today()&&r.status!=='Selesai'?'<div class="sub">Lewat tenggat</div>':''):'Tanpa tenggat')+'</td><td>'+esc(r.status)+'</td><td>'+esc(r.result||'Belum dicatat')+'</td><td>'+act('Tugas terkait','task',r.id)+(r.attachment?act('Buka surat','file',r.id):'')+'</td></tr>').join('')||'<tr><td colspan="7">Belum ada surat pada filter ini.</td></tr>'));
 }
 function editor(id){
  const r=records('dispositions').find(r=>r.id===id);if(id&&!r)return;
  const fields=documents.controls(r?.attachment)+'<div class="ops-grid">'+label('Nomor surat',input('number',r?.number,'text','maxlength="100"'))+label('Tanggal surat',input('date',r?.date||today(),'date','required'))+label('Pengirim / asal surat',input('sender',r?.sender,'text','maxlength="180"'))+label('Perihal surat',input('name',r?.name,'text','required maxlength="180"'))+label('PIC tindak lanjut',select('assigneeId',[['','Pilih staf marketing'],...accounts().map(a=>[a.id,a.name+' ('+a.username+')'+(a.id.startsWith('demo-')?' · Demo':'')])],r?.assigneeId||'','required'))+label('Ada deadline?',select('hasDeadline',[['no','Tidak — tanpa tenggat'],['yes','Ya — tentukan tanggal']],r?.hasDeadline?'yes':'no'))+label('Deadline tindak lanjut',input('deadline',r?.deadline,'date',(r?.hasDeadline?'required':'disabled')))+label('Status tindak lanjut',select('status',['Terjadwal','Diproses','Selesai'],r?.status||'Terjadwal'))+'</div>'+label('Ringkasan surat / instruksi tindak lanjut',textarea('summary',r?.summary))+label('Hasil tindak lanjut',textarea('result',r?.result))+label('Catatan',textarea('note',r?.note))+'<p class="sub">Menyimpan surat akan membuat atau memperbarui satu tugas terkait. Saat membuka tugas tersebut, formulir tindak lanjut ini yang digunakan.</p>'+
   (r?.updates?.length?'<details><summary>Riwayat tindak lanjut ('+r.updates.length+')</summary>'+r.updates.map(u=>'<p>'+esc(u.at.slice(0,10)+' · '+u.status+' · '+u.assigneeName)+'<br>'+esc(u.result||'Belum ada hasil')+'</p>').join('')+'</details>':'');
  show(r?'Tindak lanjut surat · '+r.name:'Catat surat disposisi',form('disposition-save',fields,'Simpan surat & tugas','data-id="'+esc(r?.id||'')+'"'));ui.wide();
 }
 async function change(target){
  if(target.id==='disposition-search'){query=target.value;ui.render();document.getElementById('disposition-search')?.focus();return true}
  if(target.id==='disposition-status'){status=target.value;ui.render();return true}
  if(target.form?.dataset.form!=='disposition-save')return false;
  if(target.id==='source-document'){
   const result=await documents.change(target,'disposition');const field=target.form?.elements.deadline;
   if(field){field.disabled=target.form.elements.hasDeadline.value!=='yes';field.required=!field.disabled}return result;
  }
  if(target.name==='hasDeadline'){const field=target.form.elements.deadline;field.disabled=target.value!=='yes';field.required=!field.disabled;if(field.disabled)field.value='';return true}
  return false;
 }
 async function mutate(f,v){
  const workspace=data(),old=records('dispositions').find(r=>r.id===f.dataset.id);
  if(f.dataset.id&&!old)throw Error('Surat tidak ditemukan.');
  const values=dispositionValues(v,accounts()),attachment=await documents.save(old?.attachment);
  if(workspace!==data())throw Error('Organisasi berubah. Buka ulang surat.');
  const id=old?.id||unique(),next={...old,...values,id,attachment,taskId:old?.taskId||'disposition-task-'+id};
  next.updates=[{at:new Date().toISOString(),status:next.status,result:next.result,assigneeName:next.assigneeName,deadline:next.deadline},...(old?.updates||[])];
  const task=dispositionTask(next,records('tasks').find(r=>r.id===next.taskId));
  data().records.dispositions=old?records('dispositions').map(r=>r.id===id?next:r):[...records('dispositions'),next];
  data().records.tasks=records('tasks').some(r=>r.id===task.id)?records('tasks').map(r=>r.id===task.id?task:r):[...records('tasks'),task];
  return {page:'dispositions',message:'Surat dan tugas tindak lanjut tersimpan.'};
 }
 return {view,editor,change,mutate,click(d){
  if(d.disposition==='new')return editor();
  const r=records('dispositions').find(r=>r.id===d.dispositionId);if(!r)return;
  if(d.disposition==='edit'||d.disposition==='task')return editor(r.id);
  if(d.disposition==='file'&&r.attachment)documents.open(r.attachment).catch(e=>document.getElementById('cloudError')?document.getElementById('cloudError').textContent=e.message:ui.toast(e.message));
 }};
}
