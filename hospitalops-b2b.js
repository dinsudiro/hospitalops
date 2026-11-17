import {parseDate} from './hospitalops-import.js';

export const partnerTypes=['Perusahaan','Instansi','Lembaga','Rumah Sakit','Dokter Rujukan','Bidan Rujukan','Sekolah','Organisasi','Klinik','Lainnya'];
export const referralTypes=['Rujukan pasien langsung','Rujukan pemeriksaan ke RS Ummi'];
const services=['Patologi Anatomi (PA)','Mikrobiologi','Persalinan','Laboratorium','Radiologi','Rujukan Pasien','MCU','Lainnya'];
const sampleServices=services.slice(0,2);
const activeStages=['Prospek','Penawaran Dikirim','Follow-up / Review Mitra','Negosiasi / Hambatan','PKS / Addendum','Siap Rujuk / Jadwal Layanan'];
const editableStages=[...activeStages,'Lost'];
export const pipelineStages=[...activeStages,'Won','Lost'];
const oldStages={Kualifikasi:activeStages[2],Proposal:activeStages[1],Negosiasi:activeStages[3]};
const activityTypes=['Kontak awal','Penawaran','Follow-up','Kunjungan','Negosiasi','PKS / MoU','Koordinasi rujukan / MCU','Lainnya'];
const normalized=s=>String(s??'').trim().toLowerCase().replace(/\s+/g,' ');
const iso=value=>Boolean(value&&parseDate(value)===value);
const DAYS=86400000;

export function createB2B(ui){
 const {records,data,active,heading,panel,button,table,label,input,select,options,esc,fmt,show,form,today,unique,campaigns}=ui;
 const row=(module,id)=>records(module).find(r=>r.id===id);
 const partnerFor=op=>row('partners',op.partnerId);
 const partnerName=op=>partnerFor(op)?.name||op.name;
 const serviceName=op=>op.serviceDetail||op.service;
 const btn=(name,action,id='',primary=false)=>button(name,'data-b2b="'+action+'" data-b2b-id="'+esc(id)+'"',primary?'plus':'',primary);
 const textarea=(key,value,required=false)=>'<textarea name="'+key+'" maxlength="700" '+(required?'required':'')+'>'+esc(value)+'</textarea>';
 const date=(key,value,required=false)=>input(key,value,'date',(required?'required ':'')+'min="1900-01-01" max="2100-12-31"');
 const empty=(cols,message)=>'<tr><td colspan="'+cols+'">'+message+'</td></tr>';
 const pick=(placeholder,rows)=>[['',placeholder],...rows];
 const order=(a,b)=>b.date.localeCompare(a.date)||(b.id||'').localeCompare(a.id||'');
 const logs=op=>records('b2b-log').filter(r=>r.opportunityId===op.id).sort(order);
 const activity=op=>[...logs(op),...(op.service==='MCU'?records('mcu'):records('referrals'))
   .filter(r=>r.opportunityId===op.id)].filter(r=>iso(r.date)).sort(order);
 function realizations(op){
  if(!op.id)return [];
  const isMCU=op.service==='MCU';
  return records(isMCU?'mcu':'referrals').filter(r=>r.opportunityId===op.id&&iso(r.date)&&r.date<=today()&&
   (r.status==='Selesai'||(!isMCU&&sampleServices.includes(op.service)&&r.status==='Sampel dikirim')))
   .sort((a,b)=>a.date.localeCompare(b.date));
 }
 function stage(op){
  if(op.status==='Lost')return 'Lost';
  if(op.status==='Menang'||op.status==='Won'||realizations(op).length)return 'Won';
  const value=oldStages[op.status]||op.status;
  return activeStages.includes(value)?value:'Prospek';
 }
 function freshness(op,status,last){
  if(['Won','Lost'].includes(status))return status;
  const date=last||(iso(op.date)&&op.date<=today()?op.date:'');
  if(!date)return 'Belum ada tanggal';
  const days=Math.floor((Date.parse(today())-Date.parse(date))/DAYS);
  if(days>=90)return 'Kandidat Stop';
  if(days>=30)return 'Dingin';
  return 'Potensi';
 }
 const rowAction=(caption,action,id)=>'<button class="rowbtn" data-b2b="'+action+'" data-b2b-id="'+esc(id)+'">'+esc(caption)+'</button>';
 function view(){
  const filters='<div class="filters">'+
   '<input id="b2b-query" type="search" aria-label="Cari mitra atau peluang" placeholder="Cari mitra atau peluang…">'+
   '<select id="b2b-service" aria-label="Filter layanan">'+options(pick('Semua layanan',services),'')+'</select>'+
   '<select id="b2b-stage" aria-label="Filter tahap">'+options(pick('Semua tahap',pipelineStages),'')+'</select>'+
   '<select id="b2b-freshness" aria-label="Filter prioritas">'+options(pick('Semua prioritas',['Potensi','Dingin','Kandidat Stop','Belum ada tanggal']),'')+'</select></div>';
  return heading('Pipeline Sales B2B','Kelola peluang rujukan dan MCU per mitra, dari pendekatan hingga realisasi.',btn('Tambah peluang','new','',true))+
   panel('Peluang per mitra dan layanan','Dingin setelah 30 hari tanpa update. Kandidat Stop setelah 90 hari.',filters+'<div id="b2b-results">'+results()+'</div>');
 }
 function results(query='',service='',selectedStage='',priority=''){
  const all=records('pipeline').filter(op=>(!service||op.service===service)&&
   normalized([op.name,partnerName(op),serviceName(op),op.owner].join(' ')).includes(normalized(query)));
  const list=all.map(op=>{
   const status=stage(op),last=activity(op).find(r=>r.date<=today())?.date;
   return {op,status,last,priority:freshness(op,status,last)};
  });
  const activeCount=list.filter(r=>!['Won','Lost'].includes(r.status)).length;
  const won=list.filter(r=>r.status==='Won').length;
  const lost=list.filter(r=>r.status==='Lost').length;
  const body=list.filter(r=>(!selectedStage||r.status===selectedStage)&&(!priority||r.priority===priority))
   .map(({op,status,last,priority})=>'<tr><td>'+rowAction(op.name,'detail',op.id)+'<div class="sub">'+esc(partnerName(op))+
    '</div></td><td>'+esc(op.service||'–')+(op.serviceDetail?'<div class="sub">'+esc(op.serviceDetail)+'</div>':'')+
    '</td><td>'+esc(op.owner||'–')+'</td><td>'+esc(status)+(priority!==status?'<div class="sub">'+esc(priority)+'</div>':'')+
    '</td><td>'+fmt(last)+'</td><td>'+esc(op.nextStep||'–')+(op.nextDate?'<div class="sub">'+fmt(op.nextDate)+'</div>':'')+'</td></tr>').join('');
  const conversion=list.length?Math.round(won/list.length*100):0;
  return '<p class="sub">'+activeCount+' aktif · '+won+' Won · '+lost+' Lost · '+conversion+'% konversi (Won / peluang)</p>'+
   table(['Peluang / mitra','Layanan','PIC','Tahap / prioritas','Update terakhir','Tindak lanjut'],body||empty(6,'Belum ada peluang yang cocok.'));
 }
 function change(target){
  if(!['b2b-query','b2b-service','b2b-stage','b2b-freshness'].includes(target.id))return false;
  const value=id=>document.getElementById('b2b-'+id).value;
  document.getElementById('b2b-results').innerHTML=results(value('query'),value('service'),value('stage'),value('freshness'));
  return true;
 }
 function partners(){
  const body=records('partners').map(p=>'<tr><td>'+rowAction(p.name,'partner-edit',p.id)+'</td><td>'+esc(p.type)+'</td><td>'+esc(p.contact||'–')+
   '</td><td>'+records('pipeline').filter(op=>op.partnerId===p.id).length+'</td></tr>').join('');
  return heading('Mitra B2B','Gunakan satu profil mitra untuk semua peluang layanannya.',btn('Tambah mitra','partner-new','',true))+
   panel('Daftar mitra','Pilih nama mitra untuk membuka profilnya.',table(['Mitra','Jenis','Kontak','Peluang'],body||empty(4,'Belum ada mitra tercatat.')));
 }
 function partnerForm(p){
  const controls='<div class="ops-grid">'+label('Nama mitra',input('name',p?.name,'text','required maxlength="140"'))+
   label('Jenis mitra',select('type',pick('Pilih jenis mitra',partnerTypes),p?.type||'','required'))+
   label('Kontak / PIC mitra',input('contact',p?.contact,'text','maxlength="140"'))+
   label('Wilayah / alamat',input('location',p?.location,'text','maxlength="180"'))+'</div>'+label('Catatan',textarea('note',p?.note));
  show(p?'Edit mitra':'Tambah mitra',form('b2b-partner',controls,'Simpan','data-id="'+esc(p?.id||'')+'"'));
 }
 function editor(op){
  const status=op?.status==='Menang'?'Won':oldStages[op?.status]||op?.status||'Prospek';
  const availableStages=status==='Won'?['Won',...activeStages]:realizations(op||{}).length?activeStages:editableStages;
  const partners=records('partners').map(p=>[p.id,p.name+' · '+p.type]);
  const agreements=active('pks')?records('pks').map(p=>[p.id,p.name+' · '+p.partner]):[];
  const fields='<div class="ops-grid">'+label('Nama peluang',input('name',op?.name,'text','required maxlength="140"'))+
   label('Mitra',select('partnerId',pick('Pilih mitra',partners),op?.partnerId||'','required'))+
   label('Layanan',select('service',pick('Pilih layanan',services),op?.service||'','required'))+
   label('Detail layanan (opsional)',input('serviceDetail',op?.serviceDetail,'text','maxlength="140"'))+
   label('PIC internal',input('owner',op?.owner,'text','required maxlength="100"'))+
   label('Tanggal mulai',date('date',op?.date||today(),true))+
   label('Tahap',select('status',availableStages,status))+
   label('Tenggat tindak lanjut',date('nextDate',op?.nextDate))+
   (active('pks')?label('PKS / MoU terkait',select('agreementId',pick('Pilih bila ada',agreements),op?.agreementId||'')):'')+
   label('Campaign terkait',select('campaign',pick('Pilih bila ada',Object.entries(campaigns())),op?.campaign||''))+'</div>'+
   label('Hambatan',textarea('blocker',op?.blocker))+label('Langkah berikutnya',textarea('nextStep',op?.nextStep))+
   label('Alasan stop (wajib jika Lost)',textarea('stopReason',op?.stopReason))+label('Catatan',textarea('note',op?.note));
  show(op?'Edit peluang':'Tambah peluang',(!partners.length?'<p class="sub">Daftarkan mitra untuk membuka peluang.</p>'+btn('Tambah mitra','partner-new'):'')+
   form('b2b-opportunity',fields,'Simpan','data-id="'+esc(op?.id||'')+'"'));
 }
 function detail(op){
  const status=stage(op),events=logs(op),realized=realizations(op),p=partnerFor(op);
  const agreement=active('pks')&&row('pks',op.agreementId);
  const summary=[
   ['Mitra',partnerName(op)],['Jenis mitra',p?.type||op.partnerType],['Layanan',op.service],['Detail layanan',op.serviceDetail],['PIC',op.owner],
   ['Tahap',status],['Prioritas',freshness(op,status,activity(op).find(r=>r.date<=today())?.date)],['Hambatan',op.blocker],['Langkah berikutnya',op.nextStep],
   ['Tenggat tindak lanjut',op.nextDate&&fmt(op.nextDate)],['Alasan stop',op.stopReason],['Catatan',op.note]
  ].filter(([,value])=>value).map(([key,value])=>'<dt>'+key+'</dt><dd>'+esc(value)+'</dd>').join('');
  const controls=btn('Edit peluang','edit',op.id)+btn('Catat progres','log',op.id,true)+
   (active('referrals')&&p&&op.service&&op.service!=='MCU'&&status!=='Lost'?btn('Catat rujukan','referral',op.id):'')+
   (active('mcu')&&p&&op.service==='MCU'&&status!=='Lost'?btn('Jadwalkan MCU','mcu',op.id):'');
  const total=realized.reduce((sum,r)=>sum+Number(op.service==='MCU'?r.participants||0:r.count||0),0);
  const module=op.service==='MCU'?'mcu':'referrals';
  const linked=active(module)?records(module).filter(r=>r.opportunityId===op.id).sort(order):[];
  const entry=(r)=> (module==='mcu'?'<button class="rowbtn" data-edit="'+esc(r.id)+'" data-module="mcu">'+esc(r.name)+'</button>':
   '<button class="rowbtn" data-ops="referral-edit" data-ops-id="'+esc(r.id)+'">'+esc(r.service)+'</button>');
  ui.showWide(op.name,'<div class="ops-stack"><div class="ops-version"><dl>'+summary+'</dl></div><div class="actions">'+controls+
   (agreement?button('Buka PKS / MoU','data-ops="detail" data-ops-id="'+esc(agreement.id)+'"'):'')+'</div>'+
   '<h3>Realisasi</h3><p class="sub">'+(realized.length?'Realisasi pertama '+fmt(realized[0].date)+' · '+total+
    (module==='mcu'?' peserta MCU':' rujukan tercatat'):'Belum ada realisasi terhubung.')+'</p>'+
   (linked.length?table(['Tanggal','Rujukan / kegiatan','Status'],linked.map(r=>'<tr><td>'+fmt(r.date)+'</td><td>'+entry(r)+'</td><td>'+esc(r.status)+'</td></tr>').join('')):'')+
   '<h3>Log Progres</h3>'+table(['Tanggal','Aktivitas','Ringkasan'],events.map(r=>'<tr><td>'+fmt(r.date)+'</td><td>'+esc(r.type)+'</td><td>'+esc(r.note)+'</td></tr>').join('')||
    empty(3,'Belum ada progres tercatat.'))+'</div>');
 }
 function logForm(op){
  show('Catat progres · '+op.name,form('b2b-log','<div class="ops-grid">'+label('Tanggal aktivitas',date('date',today(),true))+
   label('Aktivitas',select('type',activityTypes,activityTypes[0]))+'</div>'+label('Hasil / catatan',textarea('note','',true)),
   'Simpan','data-id="'+esc(op.id)+'"'));
 }
 function save(module,next){
  const existing=records(module);
  data().records[module]=existing.some(r=>r.id===next.id)?existing.map(r=>r.id===next.id?next:r):[...existing,next];
 }
 function mutate(f,v){
  const id=f.dataset.id;
  if(f.dataset.form==='b2b-partner'){
   if(!active('partners'))throw new Error('Modul Mitra B2B dinonaktifkan.');
   const p=row('partners',id),name=v.name.trim();
   if((id&&!p)||!name||!partnerTypes.includes(v.type))throw new Error('Lengkapi nama dan jenis mitra.');
   if(records('partners').some(r=>r.id!==id&&normalized(r.name)===normalized(name)&&r.type===v.type))throw new Error('Mitra dengan nama dan jenis ini sudah terdaftar.');
   save('partners',{id:id||unique(),name,type:v.type,contact:v.contact.trim(),location:v.location.trim(),note:v.note.trim()});
   return {page:'partners',message:'Mitra tersimpan.'};
  }
  if(!active('pipeline'))throw new Error('Modul Pipeline Sales B2B dinonaktifkan.');
  const op=row('pipeline',id);
  if(id&&!op)throw new Error('Peluang tidak ditemukan.');
  if(f.dataset.form==='b2b-log'){
   if(!op||!iso(v.date)||v.date>today()||!activityTypes.includes(v.type)||!v.note.trim())throw new Error('Isi aktivitas, catatan, dan tanggal hingga hari ini.');
   save('b2b-log',{id:unique(),opportunityId:op.id,date:v.date,type:v.type,note:v.note.trim()});
   return {page:'pipeline',message:'Progres tersimpan.',opportunityId:op.id};
  }
  const p=row('partners',v.partnerId);
  const name=v.name.trim(),owner=v.owner.trim(),stopReason=v.stopReason.trim();
  const status=v.status==='Won'&&['Won','Menang'].includes(op?.status)?op.status:v.status;
  if(!name||!p||!owner||!services.includes(v.service)||(!editableStages.includes(status)&&status!==op?.status)||
     !iso(v.date)||(v.nextDate&&!iso(v.nextDate)))throw new Error('Lengkapi mitra, layanan, tahap, PIC, dan tanggal.');
  if(status==='Lost'&&!stopReason)throw new Error('Isi alasan stop sebelum menutup peluang.');
  if(status==='Lost'&&op&&realizations(op).length)throw new Error('Peluang yang sudah terealisasi tidak dapat ditutup sebagai Lost.');
  if(op&&(op.partnerId!==p.id||op.service!==v.service||normalized(op.serviceDetail)!==normalized(v.serviceDetail))&&['referrals','mcu'].some(m=>records(m).some(r=>r.opportunityId===id))){
   throw new Error('Mitra dan rincian layanan terkunci setelah rujukan atau jadwal MCU ditautkan.');
  }
  if(records('pipeline').some(r=>r.id!==id&&r.partnerId===p.id&&r.service===v.service&&
    normalized(r.serviceDetail)===normalized(v.serviceDetail)))throw new Error('Peluang untuk mitra dan layanan ini sudah ada. Gunakan detail layanan jika ruang lingkupnya berbeda.');
  save('pipeline',{...op,id:id||unique(),name,partnerId:p.id,partnerType:p.type,service:v.service,serviceDetail:v.serviceDetail.trim(),
   owner,status,date:v.date,nextDate:v.nextDate,nextStep:v.nextStep.trim(),blocker:v.blocker.trim(),note:v.note.trim(),
   stopReason:status==='Lost'?stopReason:'',campaign:v.campaign,agreementId:v.agreementId??op?.agreementId??''});
  return {page:'pipeline',message:'Peluang tersimpan.'};
 }
 function referralContext(id){
  const op=active('pipeline')&&row('pipeline',id),p=op&&partnerFor(op);
  if(!p||!op.service||op.service==='MCU')return null;
  const exam=[...sampleServices,'Laboratorium','Radiologi'].includes(op.service);
  return {opportunityId:op.id,name:p.name,partnerType:p.type,service:serviceName(op),
   referralType:exam?referralTypes[1]:referralTypes[0],sample:sampleServices.includes(op.service),closed:stage(op)==='Lost'};
 }
 function mcuContext(id){
  const op=active('pipeline')&&row('pipeline',id),p=op&&partnerFor(op);
  if(!p||op.service!=='MCU')return null;
  return {id:op.id,title:op.name,partner:p.name,closed:stage(op)==='Lost'};
 }
 return {view,partners,stage,change,mutate,referralContext,mcuContext,detailById:id=>{const op=row('pipeline',id);if(op)detail(op)},
  edit:id=>{const op=row('pipeline',id);if(!id||op)editor(op)},
  click(d){
   if(d.b2b.startsWith('partner-')&&active('partners')){
    const p=row('partners',d.b2bId);
    if(d.b2b==='partner-new'||p)partnerForm(p);
    return;
   }
   if(!active('pipeline'))return;
   if(d.b2b==='new')return editor();
   const op=row('pipeline',d.b2bId);
   if(!op)return;
   if(d.b2b==='detail')return detail(op);
   if(d.b2b==='edit')return editor(op);
   if(d.b2b==='log')return logForm(op);
   if(d.b2b==='referral'&&active('referrals'))return ui.newReferral(op.id);
   if(d.b2b==='mcu'&&active('mcu'))return ui.newMCU(op.id);
  }
 };
}
