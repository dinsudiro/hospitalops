import {payerKey} from './hospitalops-directory.js';

const defaults=[
 {id:'lab-mikro',name:'Mikro',amount:500000,active:true},
 {id:'lab-pa',name:'PA',amount:240000,active:true}
];
const hospitalTypes=new Set(['mitra rumah sakit','rumah sakit']);
export function classifyLab(rows,tariffs){
 const byPrice=new Map();
 for(const t of tariffs.filter(t=>t.active)){
  const price=Number(t.amount);
  if(byPrice.has(price)&&byPrice.get(price)!==t.name)byPrice.set(price,'Perlu diperiksa');
  else byPrice.set(price,t.name);
 }
 return rows.map(row=>{
  const hospital=hospitalTypes.has(payerKey(row[13]));
  const lab=/^(laboratorium|lab)(\s|$)/i.test(String(row[8]||'').trim());
  const exam=hospital&&lab?(byPrice.get(Number(row[12]))||'Belum terpetakan'):'—';
  return [...row.slice(0,14),exam,...row.slice(15)];
 });
}
export function createLabTariffs(ui){
 const {records,data,heading,panel,button,table,esc,label,input,select,show,form,money,unique}=ui;
 const entries=()=>{
  const stored=records('lab-tariffs');
  return [...defaults.filter(t=>!stored.some(s=>s.id===t.id)),...stored];
 };
 function view(){
  const actions=button('Ref Direktori','data-nav="directory"')+button('Tambah tarif','data-lab-tariff="new"','plus',true);
  return heading('Tarif Lab B2B','Acuan pemeriksaan laboratorium untuk penjamin bertipe Mitra Rumah Sakit atau Rumah Sakit.',actions)+
   panel('Harga kesepakatan mitra rumah sakit','Jenis pemeriksaan dicocokkan dari Total Billing pada data pasien. Tarif awal Mikro Rp500.000 dan PA Rp240.000. Pilihan jenis pemeriksaan dikelola pada custom field di Pengaturan Field & Formulir.',
    table(['Segmen','Jenis pemeriksaan','Billing (Rp)','Status','Aksi'],entries().map(t=>'<tr><td>Rumah Sakit</td><td>'+esc(t.name)+'</td><td>'+money(t.amount)+
     '</td><td>'+(t.active?'Aktif':'Nonaktif')+'</td><td>'+button('Ubah','data-lab-tariff="edit" data-lab-tariff-id="'+esc(t.id)+'"')+'</td></tr>').join('')));
 }
 function edit(t){
  show(t?'Ubah tarif lab B2B':'Tambah tarif lab B2B',form('lab-tariff-save',
   '<p class="sub">Segmen rumah sakit. Perubahan tarif akan langsung digunakan untuk klasifikasi data pasien.</p>'+
   label('Jenis pemeriksaan',select('name',[...new Set([...(ui.examOptions?.()||['Mikro','PA']),...(t?.name?[t.name]:[])])],t?.name||ui.examOptions?.()[0]||'Mikro'))+
   label('Total billing (Rp)',input('amount',t?.amount??'','number','required min="1" max="1000000000000" step="0.01"'))+
   label('Status',select('active',[['true','Aktif'],['false','Nonaktif']],String(t?.active??true))),
   'Simpan tarif','data-id="'+esc(t?.id||'')+'"'));
 }
 function mutate(f,v){
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
  return {page:'lab-tariffs',message:'Tarif tersimpan. Jenis pemeriksaan pasien otomatis menyesuaikan.'};
 }
 return {view,mutate,entries,enrich:rows=>classifyLab(rows,entries()),click(d){
  if(d.labTariff==='new')return edit();
  const t=entries().find(t=>t.id===d.labTariffId);
  if(t)edit(t);
 }};
}
