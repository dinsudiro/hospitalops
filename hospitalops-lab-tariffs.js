import {payerKey} from './hospitalops-directory.js';

const defaults=[
 {id:'lab-mikro',name:'Mikro',amount:500000,active:true},
 {id:'lab-pa',name:'PA',amount:240000,active:true}
];
const hospitalTypes=new Set(['mitra rumah sakit','rumah sakit']);
export const labSources=[['billing-or-revenue','Total Billing; jika kosong / nol gunakan Total Asuransi'],['billing','Hanya Total Billing'],['revenue','Hanya Total Asuransi']];
export function inspectLabRule(row,tariffs,source='billing-or-revenue'){
 const hospital=hospitalTypes.has(payerKey(row[13])),lab=/^(laboratorium|lab)(\s|$)/i.test(String(row[8]||'').trim());
 const numeric=v=>v===null||v===undefined||String(v).trim()===''?null:Number.isFinite(Number(v))?Number(v):null;
 const billing=numeric(row[12]),insurance=numeric(row[25]),fallback=source==='billing-or-revenue'&&(billing===null||billing===0);
 const amount=source==='revenue'||fallback?insurance:billing,basis=source==='revenue'||fallback?'Total Asuransi':'Total Billing';
 if(!lab)return {exam:'—',reason:'Unit kunjungan bukan Laboratorium.',amount,basis};
 if(!hospital)return {exam:'—',reason:'Tipe penjamin belum termasuk Rumah Sakit / Mitra Rumah Sakit. Periksa Ref Direktori.',amount,basis};
 if(amount===null||amount<=0)return {exam:'Belum terpetakan',reason:'Nominal '+basis+' belum terisi atau tidak positif. Periksa data atau sumber nominal aturan.',amount,basis};
 const matches=tariffs.filter(t=>t.active&&Number(t.amount)===amount),names=[...new Set(matches.map(t=>t.name))];
 if(names.length!==1)return {exam:names.length?'Perlu diperiksa':'Belum terpetakan',reason:names.length?'Ada tarif aktif dengan nominal sama dan jenis pemeriksaan berbeda.':'Belum ada tarif aktif yang cocok dengan '+basis+'.',amount,basis};
 return {exam:names[0],matched:true,amount,basis,reason:(fallback?'Total Billing kosong / nol; memakai Total Asuransi.':'Sumber pencocokan: '+basis+'.')};
}
export function classifyLab(rows,tariffs,source='billing-or-revenue'){
 return rows.map(row=>{const out=[...row];out[14]=inspectLabRule(row,tariffs,source).exam;return out});
}
export function createLabTariffs(ui){
 const {records,data,heading,panel,button,table,esc,label,input,select,show,form,money,unique}=ui;
 const entries=()=>{
  const stored=records('lab-tariffs');
  return [...defaults.filter(t=>!stored.some(s=>s.id===t.id)),...stored];
 };
 const source=()=>records('lab-tariff-settings')[0]?.source||'billing-or-revenue';
 const explain=row=>{const result=inspectLabRule(row,entries(),source());return {...result,message:result.reason+(result.amount!==null?' Nominal: '+money(result.amount)+'.':'')};};
 function referencePanel(){return panel('Tarif Lab B2B','Acuan pengisian otomatis custom field pemeriksaan lab untuk penjamin bertipe Rumah Sakit / Mitra Rumah Sakit.',
  '<p class="sub">Sumber nominal: '+esc(labSources.find(([id])=>id===source())?.[1])+'</p><div class="actions">'+button('Atur sumber nominal','data-lab-tariff="source"')+button('Tambah tarif','data-lab-tariff="new"','plus',true)+button('Pengaturan custom field','data-nav="patient-fields"')+'</div>'+
  table(['Segmen','Jenis pemeriksaan','Tarif pencocokan','Status','Aksi'],entries().map(t=>'<tr><td>Rumah Sakit</td><td>'+esc(t.name)+'</td><td>'+money(t.amount)+'</td><td>'+(t.active?'Aktif':'Nonaktif')+'</td><td>'+button('Ubah','data-lab-tariff="edit" data-lab-tariff-id="'+esc(t.id)+'"')+'</td></tr>').join(''))+
  '<p class="sub">Pencocokan menggunakan nominal persis. Total Billing yang terisi dan bukan nol tetap diprioritaskan pada mode cadangan. Pendapatan mengutamakan Total Asuransi; jika kosong memakai Total Billing; koreksi manual custom field dipertahankan.</p>');}
 function view(){return heading('Tarif Lab B2B','Pengaturan tarif juga tersedia langsung di Ref Direktori.',button('Ref Direktori','data-nav="directory"'))+referencePanel();}
 function sourceEditor(){show('Sumber nominal pencocokan lab',form('lab-tariff-source',label('Sumber nominal',select('source',labSources,source()))+'<p class="sub">Berlaku untuk pencocokan otomatis. Nilai sumber pada laporan dan pendapatan tidak diubah. Koreksi manual tetap digunakan.</p>','Simpan sumber','data-return-page="'+(ui.page?.()==='directory'?'directory':'lab-tariffs')+'"'));}
 function edit(t){
  show(t?'Ubah tarif lab B2B':'Tambah tarif lab B2B',form('lab-tariff-save',
   '<p class="sub">Segmen rumah sakit. Perubahan tarif akan langsung digunakan untuk klasifikasi data pasien, sesuai sumber nominal yang dipilih.</p>'+
   label('Jenis pemeriksaan',select('name',[...new Set([...(ui.examOptions?.()||['Mikro','PA']),...(t?.name?[t.name]:[])])],t?.name||ui.examOptions?.()[0]||'Mikro'))+
   label('Tarif pencocokan (Rp)',input('amount',t?.amount??'','number','required min="1" max="1000000000000" step="0.01"'))+
   label('Status',select('active',[['true','Aktif'],['false','Nonaktif']],String(t?.active??true))),
   'Simpan tarif','data-id="'+esc(t?.id||'')+'" data-return-page="'+(ui.page?.()==='directory'?'directory':'lab-tariffs')+'"'));
 }
 function mutate(f,v){
  if(f.dataset.form==='lab-tariff-source'){if(!labSources.some(([id])=>id===v.source))throw Error('Pilih sumber nominal yang tersedia.');data().records['lab-tariff-settings']=[{id:'lab-source',source:v.source}];return {page:f.dataset.returnPage==='directory'?'directory':'lab-tariffs',message:'Sumber pencocokan otomatis diperbarui.'};}
  const id=f.dataset.id,old=entries().find(t=>t.id===id),amount=Number(v.amount),active=v.active==='true';
  if(id&&!old)throw Error('Tarif tidak ditemukan.');
  if(!(ui.examOptions?.()||['Mikro','PA']).includes(v.name)||!Number.isFinite(amount)||amount<=0||amount>1e12||!['true','false'].includes(v.active)){
   throw Error('Isi jenis pemeriksaan dan total billing dalam rupiah.');
  }
  if(active&&entries().some(t=>t.id!==id&&t.active&&Number(t.amount)===amount)){
   throw Error('Harga aktif ini sudah dipakai. Setiap harga harus memiliki satu jenis pemeriksaan.');
  }
  const next={id:id||unique(),name:v.name,amount,active};
  const stored=records('lab-tariffs');
  data().records['lab-tariffs']=stored.some(t=>t.id===id)?stored.map(t=>t.id===id?next:t):[...stored,next];
  return {page:f.dataset.returnPage==='directory'?'directory':'lab-tariffs',message:'Tarif tersimpan. Jenis pemeriksaan pasien otomatis menyesuaikan.'};
 }
 return {view,referencePanel,mutate,entries,explain,enrich:rows=>classifyLab(rows,entries(),source()),click(d){
  if(d.labTariff==='source')return sourceEditor();
  if(d.labTariff==='new')return edit();
  const t=entries().find(t=>t.id===d.labTariffId);
  if(t)edit(t);
 }};
}
