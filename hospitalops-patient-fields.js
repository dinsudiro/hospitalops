import {clean,matchKey,sourceCategories,sourceCategory,patientKey,visitKey,hashKey,applies,coerceFieldValue,patientDate} from './hospitalops-patient-model.js?v=20261125-flex1';
export const patientExtraModules=['patient-extra-buckets','patient-programs','patient-control-logs','patient-change-log'];
export const fieldTypes=[['text','Teks singkat'],['textarea','Catatan panjang'],['number','Angka'],['date','Tanggal'],['select','Pilihan tunggal'],['multiselect','Pilihan jamak'],['checkbox','Ya / Tidak']];
export const fieldScopes=[['patient','Pasien (lintas kunjungan)'],['visit','Kunjungan / episode'],['program','Program tindak lanjut']];
export function extraEntity(field,row,programId=''){return field.scope==='patient'?patientKey(row):field.scope==='program'?'program:'+programId:'visit:'+visitKey(row)}
export function createPatientFields(ui){
 const {records,data,heading,panel,button,table,label,input,select,options,esc,show,form,fmt,unique}=ui;
 const fields=()=>records('patient-field-definitions');
 const active=()=>fields().filter(f=>f.active!==false).sort((a,b)=>Number(a.order)-Number(b.order));
 const all=()=>ui.rows();
 const rowByKey=key=>all().find(r=>visitKey(r)===key);
 const actor=()=>ui.actor?.()||'Manager';
 const act=(name,action,id='',key='',primary=false)=>button(name,'data-pfield="'+action+'" data-pfield-id="'+esc(id)+'" data-pfield-key="'+esc(key)+'"','',primary);
 const textarea=(name,value,extra='')=>'<textarea name="'+name+'" '+extra+'>'+esc(value||'')+'</textarea>';
 let cachedBuckets=null,cachedData=null,cachedValues;
 function valueIndex(){const buckets=records('patient-extra-buckets');if(cachedBuckets!==buckets||cachedData!==data()){cachedBuckets=buckets;cachedData=data();cachedValues=new Map(buckets.flatMap(b=>b.rows||[]).map(r=>[r.id,r]));}return cachedValues}
 function valueFor(row,field,programId=''){return valueIndex().get(extraEntity(field,row,programId))?.values?.[field.id]??null}
 function recordChange(entity,changes){if(!changes.length)return;data().records['patient-change-log']=[...records('patient-change-log'),{id:unique(),entity,at:new Date().toISOString(),actor:actor(),changes}]}
 function putValues(row,values,programId='',origin='manual'){
  const affected=new Map(),existing=valueIndex();
  for(const [id,value] of Object.entries(values)){
   const f=fields().find(f=>f.id===id);if(!f)continue;const entity=extraEntity(f,row,programId);if(f.scope==='program'&&!programId)throw Error('Pilih program terlebih dahulu.');
   if(!affected.has(entity))affected.set(entity,{...(existing.get(entity)||{id:entity,values:{}}),values:{...(existing.get(entity)?.values||{})}});
   affected.get(entity).values[id]=value;
  }
  const buckets=new Map(records('patient-extra-buckets').map(b=>[b.id,{...b,rows:[...(b.rows||[])]}]));
  for(const [entity,next] of affected){const changes=Object.entries(next.values).filter(([k,v])=>JSON.stringify(v)!==JSON.stringify(existing.get(entity)?.values?.[k]??null)).map(([id,to])=>({fieldId:id,label:fields().find(f=>f.id===id)?.label,from:existing.get(entity)?.values?.[id]??null,to}));
   next.updatedAt=new Date().toISOString();next.updatedBy=actor();const bucket=hashKey(entity,'extra-'),b=buckets.get(bucket)||{id:bucket,rows:[]};b.rows=b.rows.filter(r=>r.id!==entity).concat(next);buckets.set(bucket,b);recordChange(entity,changes.map(c=>({...c,origin})));
  }
  data().records['patient-extra-buckets']=[...buckets.values()];
 }
 function putBatch(items){
  if(!items.length)return;const existing=valueIndex(),next=new Map(existing),defs=new Map(fields().map(f=>[f.id,f]));let changed=0;
  for(const item of items)for(const [id,value] of Object.entries(item.values)){
   const f=defs.get(id);if(!f||f.scope==='program'||value===null)continue;const entity=extraEntity(f,item.row);const old=next.get(entity)||{id:entity,values:{}};
   if(JSON.stringify(old.values[id]??null)===JSON.stringify(value))continue;next.set(entity,{...old,values:{...old.values,[id]:value},updatedAt:new Date().toISOString(),updatedBy:actor()});changed++;
  }
  if(!changed)return;const buckets=new Map();for(const value of next.values()){const id=hashKey(value.id,'extra-');if(!buckets.has(id))buckets.set(id,{id,rows:[]});buckets.get(id).rows.push(value)}data().records['patient-extra-buckets']=[...buckets.values()];recordChange('import-custom',[{label:'Isian custom dari upload',from:null,to:changed}]);
 }
 function controls(list,row,programId=''){
  return '<div class="ops-grid">'+list.map(f=>{
   const v=valueFor(row,f,programId),name='cf-'+f.id,required=f.required?'required':'';let control;
   if(f.type==='select')control=select(name,[['','Pilih…'],...(f.options||[]),...(v&&!(f.options||[]).includes(v)?[[v,v+' (nilai lama)']]:[])],v||'',required);
   else if(f.type==='multiselect')control='<select name="'+name+'" multiple '+required+' aria-label="'+esc(f.label)+'">'+(f.options||[]).map(vv=>'<option value="'+esc(vv)+'" '+(Array.isArray(v)&&v.includes(vv)?'selected':'')+'>'+esc(vv)+'</option>').join('')+'</select>';
   else if(f.type==='checkbox')control=select(name,[['','Belum diisi'],['true','Ya'],['false','Tidak']],v===null?'':String(v),required);
   else if(f.type==='textarea')control=textarea(name,v,'maxlength="2000" '+required);
   else control=input(name,v??'',f.type==='number'?'number':f.type==='date'?'date':'text',required+(f.type==='number'?' step="any"':' maxlength="2000"'));
   return label(f.label+(f.required?' *':''),control+'<span class="sub">'+esc(fieldScopes.find(([k])=>k===f.scope)?.[1]||'')+'</span>');
  }).join('')+'</div>';
 }
 function formValues(f,row,scopes,programId=''){
  const vals={};for(const field of active().filter(x=>scopes.includes(x.scope)&&applies(x,row))){const name='cf-'+field.id,raw=field.type==='multiselect'?Array.from(f.elements.namedItem(name)?.selectedOptions||[]).map(o=>o.value):f.elements.namedItem(name)?.value;const value=coerceFieldValue(field,raw);if(field.required&&(value===null||Array.isArray(value)&&!value.length))throw Error('Lengkapi '+field.label+'.');vals[field.id]=value;}return vals;
 }
 function sourcesPanel(){return panel('Kategori sumber pasien','Acuan unit → Rajal, Ranap, IGD, Penunjang, atau Tindakan. Ref yang diunggah digunakan lintas menu.',act('Tambah pemetaan unit','source-new')+table(['Unit / layanan','Kategori sumber','Aksi'],records('patient-source-directory').map(r=>'<tr><td>'+esc(r.unit)+'</td><td>'+esc(r.category)+'</td><td>'+act('Ubah','source-edit',r.id)+'</td></tr>').join('')||'<tr><td colspan="3">Belum ada acuan. Upload workbook Raw + Ref melalui Data Pasien, atau tambahkan pemetaan.</td></tr>'))}
 function view(){
  return heading('Pengaturan Field & Formulir','Atur field tambahan per sumber, unit/poli, atau tipe penjamin. Nama field dapat diubah tanpa memutus nilai sebelumnya.',act('Tambah field','new','','',true))+
   panel('Field pasien dan layanan','Field pasien mengikuti No. RM yang valid. Field kunjungan mengikuti registrasi + unit. Field program mengikuti program kontrol.',
    '<div class="actions">'+act('Contoh field surgical / medical','ranap')+'</div>'+table(['Nama field','Jenis isian','Melekat pada','Berlaku untuk','Wajib','Urutan','Status','Aksi'],fields().slice().sort((a,b)=>Number(a.order)-Number(b.order)).map(f=>'<tr><td>'+esc(f.label)+'</td><td>'+esc(fieldTypes.find(([k])=>k===f.type)?.[1])+'</td><td>'+esc(fieldScopes.find(([k])=>k===f.scope)?.[1])+'</td><td>'+esc([f.category||'Semua sumber',f.unitContains&&'Unit mengandung: '+f.unitContains,f.payerType&&'Tipe penjamin: '+f.payerType].filter(Boolean).join(' · '))+'</td><td>'+(f.required?'Ya':'Tidak')+'</td><td>'+Number(f.order||1)+'</td><td>'+(f.active===false?'Nonaktif':'Aktif')+'</td><td>'+act('Ubah','edit',f.id)+'</td></tr>').join('')||'<tr><td colspan="8">Belum ada custom field. Tambahkan sesuai kebutuhan layanan.</td></tr>'));
 }
 function editor(old,preset={}){const f=old||{type:'text',scope:'visit',category:'',unitContains:'',payerType:'',options:[],order:fields().length+1,active:true,...preset};
  show(old?'Ubah field tambahan':'Tambah field tambahan',form('patient-field-save','<div class="ops-grid">'+
   label('Nama field',input('label',f.label,'text','required maxlength="120"'))+
   label('Jenis isian',select('type',fieldTypes,f.type,old?'disabled':'')+(old?'<input type="hidden" name="type" value="'+esc(f.type)+'">':''))+
   label('Melekat pada',select('scope',fieldScopes,f.scope,old?'disabled':'')+(old?'<input type="hidden" name="scope" value="'+esc(f.scope)+'">':''))+
   label('Kategori sumber',select('category',[['','Semua sumber'],...sourceCategories],f.category))+
   label('Unit / poli mengandung (opsional)',input('unitContains',f.unitContains,'text','maxlength="140" placeholder="Contoh: ANAK"'))+
   label('Tipe penjamin (opsional)',input('payerType',f.payerType,'text','maxlength="100" placeholder="Sama dengan Ref Direktori"'))+
   label('Urutan',input('order',f.order,'number','required min="1" max="999"'))+
   label('Isian wajib',select('required',[['false','Opsional'],['true','Wajib']],String(!!f.required)))+
   label('Status',select('active',[['true','Aktif'],['false','Nonaktif']],String(f.active!==false)))+'</div>'+
   label('Pilihan jawaban (satu per baris; untuk pilihan tunggal/jamak)',textarea('options',(f.options||[]).join('\n'),'maxlength="4000"'))+
   '<p class="sub">ID field tetap saat nama, urutan, pilihan, atau aturan layanan diubah. Jenis dan tingkat penyimpanan field lama dikunci untuk menjaga data.</p>','Simpan field','data-id="'+esc(old?.id||'')+'"'));ui.wide();
 }
 function detail(row){if(!row)return;const key=visitKey(row),pk=patientKey(row),list=active().filter(f=>f.scope!=='program'&&applies(f,row)),programs=records('patient-programs').filter(p=>p.patientKey===pk),related=all().filter(r=>patientKey(r)===pk).sort((a,b)=>b[5].localeCompare(a[5]));
  show('Profil & tindak lanjut · '+row[4],'<div class="ops-stack"><p><strong>'+esc(row[4])+'</strong> · RM '+esc(row[1]||'tidak tersedia')+'<br>Registrasi '+esc(row[2])+' · '+esc(row[8])+' · '+fmt(row[5])+'<br>Sumber: '+esc(row[7])+' · Tipe penjamin: '+esc(row[13])+'</p>'+
   (pk.startsWith('visit:')?'<p role="status">No. RM belum dapat digunakan sebagai identitas lintas kunjungan. Isian pasien untuk catatan ini dibatasi pada kunjungan ini sampai identitas sumber diperbaiki.</p>':'')+
   form('patient-extra-save','<h3>Field tambahan</h3>'+(list.length?controls(list,row):'<p>Belum ada field aktif yang sesuai. Tambahkan melalui Pengaturan Field & Formulir.</p>'),'Simpan isian','data-key="'+esc(key)+'"')+
   '<div class="actions">'+act('Atur custom field','settings')+act('Tambah program kontrol','program-new','',key,true)+'</div><h3>Program tindak lanjut</h3>'+
   table(['Program','Target','Selesai','Progres','Aksi'],programs.map(p=>{const done=records('patient-control-logs').filter(l=>l.programId===p.id&&l.status==='Selesai').length;return '<tr><td>'+esc(p.name)+'</td><td>'+p.target+'</td><td>'+done+'</td><td>'+done+'/'+p.target+'</td><td>'+act('Buka log','program',p.id,key)+act('Ubah program','program-edit',p.id,key)+'</td></tr>'}).join('')||'<tr><td colspan="5">Belum ada program.</td></tr>')+
   '<h3>Riwayat kunjungan pasien</h3>'+table(['Tanggal','Registrasi','Unit','Sumber','Aksi'],related.map(r=>'<tr><td>'+fmt(r[5])+'</td><td>'+esc(r[2])+'</td><td>'+esc(r[8])+'</td><td>'+esc(r[7])+'</td><td>'+act('Buka','detail','',visitKey(r))+'</td></tr>').join(''))+
   '<details><summary>Riwayat perubahan isian</summary>'+audit([pk,'visit:'+key,...programs.map(p=>'program:'+p.id)])+'</details></div>');ui.wide();
 }
 function audit(entities){return records('patient-change-log').filter(c=>entities.includes(c.entity)).slice().reverse().map(c=>'<p class="sub">'+esc(c.at)+' · '+esc(c.actor)+'<br>'+c.changes.map(x=>esc(x.label||x.fieldId)+': '+esc(display(x.from))+' → '+esc(display(x.to))).join('<br>')+'</p>').join('')||'<p class="sub">Belum ada perubahan.</p>'}
 function display(v){return v===null||v===undefined?'Belum diisi':Array.isArray(v)?v.join('; '):typeof v==='boolean'?v?'Ya':'Tidak':String(v)}
 function programEditor(row,p){show(p?'Ubah program kontrol':'Tambah program kontrol',form('patient-program-save','<p>'+esc(row[4])+' · '+esc(row[8])+'</p><div class="ops-grid">'+label('Nama program',input('name',p?.name,'text','required maxlength="160" placeholder="Contoh: Tracking imunisasi"'))+label('Target jumlah kunjungan',input('target',p?.target??9,'number','required min="1" max="9999" step="1"'))+label('PIC program',input('pic',p?.pic,'text','maxlength="140"'))+label('Status program',select('status',['Aktif','Selesai','Ditunda'],p?.status||'Aktif'))+'</div>'+label('Catatan',textarea('note',p?.note,'maxlength="2000"')),'Simpan program','data-key="'+esc(visitKey(row))+'" data-id="'+esc(p?.id||'')+'"'));ui.wide()}
 function programContext(p,row){const anchor=all().find(r=>visitKey(r)===p.visitKey);if(anchor)return anchor;const next=[...row];if(p.context){next[7]=p.context.category;next[8]=p.context.unit;next[13]=p.context.payerType}return next}
 function programDetail(p,row){if(!p||!row)return;const context=programContext(p,row);const logs=records('patient-control-logs').filter(l=>l.programId===p.id).sort((a,b)=>a.sequence-b.sequence),done=logs.filter(l=>l.status==='Selesai').length;
  show('Program · '+p.name,'<div class="ops-stack"><p>'+esc(row[4])+' · '+esc(p.pic||'PIC belum diisi')+' · '+esc(p.status)+'<br>Progres '+done+'/'+p.target+' kunjungan selesai</p><div class="actions">'+act('Tambah log kunjungan','log-new',p.id,visitKey(row),true)+act('Ubah program','program-edit',p.id,visitKey(row))+act('Kembali ke pasien','detail','',visitKey(row))+'</div>'+
   (active().some(f=>f.scope==='program'&&applies(f,context))?form('patient-program-fields',controls(active().filter(f=>f.scope==='program'&&applies(f,context)),context,p.id),'Simpan field program','data-id="'+esc(p.id)+'" data-key="'+esc(visitKey(row))+'"'):'')+
   table(['Ke-','Rencana','Aktual','Status','Layanan','Hasil / catatan','Aksi'],logs.map(l=>'<tr><td>'+l.sequence+'</td><td>'+fmt(l.planned)+'</td><td>'+fmt(l.actual)+'</td><td>'+esc(l.status)+'</td><td>'+esc(l.service)+'</td><td>'+esc(l.result)+'</td><td>'+act('Ubah','log-edit',l.id,visitKey(row))+'</td></tr>').join('')||'<tr><td colspan="7">Belum ada log kontrol.</td></tr>')+'</div>');ui.wide();
 }
 function logEditor(p,row,l){const seq=1+Math.max(0,...records('patient-control-logs').filter(x=>x.programId===p.id).map(x=>x.sequence));show(l?'Ubah log kontrol':'Tambah log kontrol',form('patient-log-save','<p>'+esc(p.name)+' · '+esc(row[4])+'</p><div class="ops-grid">'+label('Kunjungan ke-',input('sequence',l?.sequence??seq,'number','required min="1" max="9999" step="1"'))+label('Tanggal rencana',input('planned',l?.planned,'date'))+label('Tanggal aktual',input('actual',l?.actual,'date'))+label('Status',select('status',['Terjadwal','Selesai','Batal'],l?.status||'Terjadwal'))+label('Layanan / tindakan',input('service',l?.service,'text','maxlength="200"'))+'</div>'+label('Hasil / catatan',textarea('result',l?.result,'maxlength="2000"')),'Simpan log','data-id="'+esc(l?.id||'')+'" data-program="'+esc(p.id)+'" data-key="'+esc(visitKey(row))+'"'));ui.wide()}
 function sourceEditor(old){show('Pemetaan sumber pasien',form('patient-source-save',label('Unit / layanan',input('unit',old?.unit,'text','required maxlength="180" '+(old?'readonly':'')))+label('Kategori sumber',select('category',sourceCategories,old?.category||'RAWAT JALAN')),'Simpan pemetaan','data-id="'+esc(old?.id||'')+'"'))}
 function mutate(f,v){const kind=f.dataset.form;let result={page:'patient-fields',message:'Pengaturan field tersimpan.'};
  if(kind==='patient-field-save'){
   const old=fields().find(x=>x.id===f.dataset.id);if(f.dataset.id&&!old)throw Error('Field tidak ditemukan.');
   const next={id:old?.id||'field-'+unique(),label:clean(v.label),type:old?.type||v.type,scope:old?.scope||v.scope,category:clean(v.category),unitContains:clean(v.unitContains),payerType:clean(v.payerType),order:Number(v.order),required:v.required==='true',active:v.active==='true',options:[...new Set(clean(v.options).split('\n').map(clean).filter(Boolean))]};
   if(!next.label||next.label.length>120||!fieldTypes.some(([k])=>k===next.type)||!fieldScopes.some(([k])=>k===next.scope)||next.category&&!sourceCategories.includes(next.category)||!Number.isInteger(next.order)||next.order<1||next.order>999)throw Error('Periksa nama, jenis, cakupan, dan urutan field.');
   if(['select','multiselect'].includes(next.type)&&!next.options.length)throw Error('Isi pilihan jawaban.');
   if(next.options.length>100||next.options.some(x=>x.length>150))throw Error('Maksimal 100 pilihan, masing-masing 150 karakter.');
   data().records['patient-field-definitions']=old?fields().map(x=>x.id===old.id?next:x):[...fields(),next];recordChange('field:'+next.id,[{label:'Pengaturan field',from:old||null,to:next}]);return result;
  }
  if(kind==='patient-source-save'){
   const unit=clean(v.unit),category=sourceCategory(v.category);if(!unit||unit.length>180||!sourceCategories.includes(category))throw Error('Isi unit dan kategori sumber.');const list=records('patient-source-directory'),old=list.find(x=>matchKey(x.unit)===matchKey(unit));const next={id:old?.id||'source-'+unique(),unit,category};data().records['patient-source-directory']=old?list.map(x=>x.id===old.id?next:x):[...list,next];return {page:'directory',message:'Pemetaan sumber diperbarui di seluruh menu pasien.'};
  }
  const row=rowByKey(f.dataset.key);if(!row)throw Error('Kunjungan tidak ditemukan pada data aktif. Buka ulang pasien.');const key=visitKey(row);result={page:'patients',patientKey:key,message:'Data tindak lanjut tersimpan.'};
  if(kind==='patient-extra-save'){putValues(row,formValues(f,row,['patient','visit']));return result}
  const oldProgram=records('patient-programs').find(p=>p.id===(kind==='patient-log-save'?f.dataset.program:f.dataset.id));
  if(oldProgram&&oldProgram.patientKey!==patientKey(row))throw Error('Program tidak sesuai pasien.');
  if(kind==='patient-program-save'){
   if(f.dataset.id&&!oldProgram)throw Error('Program tidak ditemukan.');const target=Number(v.target);if(v.status==='Selesai'&&records('patient-control-logs').filter(l=>l.programId===oldProgram?.id&&l.status==='Selesai').length<target)throw Error('Target kunjungan belum tercapai. Gunakan Aktif atau Ditunda.');if(!clean(v.name)||!Number.isInteger(target)||target<1||target>9999||!['Aktif','Selesai','Ditunda'].includes(v.status))throw Error('Periksa nama, target dan status program.');
   const p={id:oldProgram?.id||'program-'+unique(),patientKey:patientKey(row),visitKey:oldProgram?.visitKey||key,context:oldProgram?.context||{category:row[7],unit:row[8],payerType:row[13]},name:clean(v.name).slice(0,160),target,pic:clean(v.pic).slice(0,140),note:clean(v.note).slice(0,2000),status:v.status};data().records['patient-programs']=oldProgram?records('patient-programs').map(x=>x.id===p.id?p:x):[...records('patient-programs'),p];recordChange('program:'+p.id,[{label:'Program',from:oldProgram||null,to:p}]);return result;
  }
  if(!oldProgram)throw Error('Program tidak ditemukan.');
  if(kind==='patient-program-fields'){putValues(row,formValues(f,programContext(oldProgram,row),['program'],oldProgram.id),oldProgram.id);return result}
  if(kind==='patient-log-save'){
   const old=records('patient-control-logs').find(l=>l.id===f.dataset.id);if(f.dataset.id&&!old||old&&old.programId!==oldProgram.id)throw Error('Log tidak ditemukan.');const sequence=Number(v.sequence);
   if(!Number.isInteger(sequence)||sequence<1||sequence>9999||!['Terjadwal','Selesai','Batal'].includes(v.status)||v.planned&&!patientDate(v.planned)||v.actual&&!patientDate(v.actual)||v.status==='Selesai'&&!v.actual)throw Error('Isi urutan dan tanggal yang valid. Status selesai memerlukan tanggal aktual.');
   if(records('patient-control-logs').some(l=>l.programId===oldProgram.id&&l.id!==old?.id&&l.sequence===sequence))throw Error('Nomor kunjungan sudah digunakan pada program ini.');
   const next={id:old?.id||'control-'+unique(),programId:oldProgram.id,sequence,planned:v.planned||'',actual:v.actual||'',status:v.status,service:clean(v.service).slice(0,200),result:clean(v.result).slice(0,2000),updatedAt:new Date().toISOString(),updatedBy:actor()};data().records['patient-control-logs']=old?records('patient-control-logs').map(x=>x.id===old.id?next:x):[...records('patient-control-logs'),next];recordChange('program:'+oldProgram.id,[{label:'Kunjungan '+sequence,from:old||null,to:next}]);return result;
  }
  throw Error('Form pasien tidak dikenali.');
 }
 function click(d){const row=rowByKey(d.pfieldKey);if(d.pfield==='settings'){ui.close();return ui.goto('patient-fields')}if(d.pfield==='new')return editor();if(d.pfield==='ranap')return editor(null,{label:'Jenis perawatan',type:'select',category:'RAWAT INAP',options:['Surgical','Medical']});if(d.pfield==='edit')return editor(fields().find(f=>f.id===d.pfieldId));if(d.pfield==='source-new')return sourceEditor();if(d.pfield==='source-edit')return sourceEditor(records('patient-source-directory').find(x=>x.id===d.pfieldId));if(!row)return;if(d.pfield==='detail')return detail(row);if(d.pfield==='program-new')return programEditor(row);const p=records('patient-programs').find(p=>p.id===d.pfieldId);if(d.pfield==='program-edit'&&p)return programEditor(row,p);if(d.pfield==='program'&&p)return programDetail(p,row);if(d.pfield==='log-new'&&p)return logEditor(p,row);if(d.pfield==='log-edit'){const l=records('patient-control-logs').find(l=>l.id===d.pfieldId),program=records('patient-programs').find(p=>p.id===l?.programId);if(program)return logEditor(program,row,l)}}
 return {view,sourcesPanel,detail,click,mutate,fields:active,allFields:fields,valueFor,putValues,putBatch,display,detailByKey:key=>detail(rowByKey(key)),hydrate:rows=>rows.map(r=>{const out=[...r];out[29]=Object.fromEntries(active().filter(f=>f.scope!=='program'&&applies(f,r)).map(f=>[f.id,valueFor(r,f)]));return out})};
}
