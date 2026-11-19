import {payerKey} from './hospitalops-directory.js';

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
  if(!groups.has(key))groups.set(key,{key,name:profile.name,type:profile.type,profiles:[],rows:[],patients:new Set(),billing:0});
  groups.get(key).profiles.push(profile);
 }
 for(const row of rows){
  const key=payerKey(row[9]);if(!key)continue;
  if(!groups.has(key))groups.set(key,{key,name:String(row[9]).trim().replace(/\s+/g,' '),type:'Belum terpetakan',profiles:[],rows:[],patients:new Set(),billing:0});
  const group=groups.get(key);
  group.type=row[13]||'Belum terpetakan';
  group.rows.push(row);group.patients.add(patientId(row));group.billing+=Number(row[12])||0;
 }
 return [...groups.values()].map(g=>({...g,patientCount:g.patients.size,visitCount:g.rows.length}))
  .sort((a,b)=>b.billing-a.billing||a.name.localeCompare(b.name));
}
export function createPartnerPatients(ui){
 const {rows,profiles,data,heading,panel,button,table,esc,fmt,money,options,show}=ui;
 let scope=null,query='',type='',source='',from='',to='',page=1,detailKey='',detailQuery='',detailPage=1;
 const size=50;
 const filteredRows=()=>rows().filter(r=>(!from||r[5]>=from)&&(!to||r[5]<=to));
 const groups=()=>summarizePartners(filteredRows(),profiles());
 const find=key=>groups().find(g=>g.key===key);
 const plainButton=(title,action,extra='')=>button(title,'data-partner-patients="'+action+'" '+extra);
 const nameButton=g=>'<button class="rowbtn" data-partner-patients="detail" data-partner-key="'+esc(g.key)+'">'+esc(g.name)+'</button>';
 const profileButton=p=>button('Ubah profil','data-b2b="partner-edit" data-b2b-id="'+esc(p.id)+'"');
 function reset(){
  if(scope===data())return;
  scope=data();query='';type='';source='';from='';to='';page=1;detailKey='';detailQuery='';detailPage=1;
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
   button('Data Pasien','data-nav="patients"')+button('Tambah mitra','data-b2b="partner-new"','plus',true))+
   panel('Daftar mitra dan realisasi','Jumlah pasien memakai No RM. Jika No RM kosong atau 0, digunakan No Registrasi. Total billing berasal dari Total Amount Billing.',
    filters+'<div id="partner-patients-results">'+results()+'</div>');
 }
 function pager(part,page,pages){
  return '<div class="actions">'+plainButton('Sebelumnya',part+'-previous',page===1?'disabled':'')+'<span>Halaman '+page+' / '+pages+'</span>'+
   plainButton('Berikutnya',part+'-next',page===pages?'disabled':'')+'</div>';
 }
 function results(){
  const selected=groups().filter(g=>(!type||g.type===type)&&payerKey(g.name+' '+g.type).includes(payerKey(query))&&
   (!source||source==='patients'&&g.visitCount>0||source==='manual'&&g.visitCount===0));
  const pages=Math.max(1,Math.ceil(selected.length/size));page=Math.min(page,pages);
  const body=selected.slice((page-1)*size,page*size).map(g=>'<tr><td>'+nameButton(g)+
   '<div class="sub">'+(g.visitCount?'Data Pasien':'Profil manual')+'</div></td><td>'+esc(g.type)+'</td><td>'+
   g.patientCount.toLocaleString('id-ID')+'</td><td>'+g.visitCount.toLocaleString('id-ID')+'</td><td>'+money(g.billing)+'</td><td>'+
   (g.profiles.length?g.profiles.map(profileButton).join(' '):'—')+'</td></tr>').join('');
  return (from&&to&&from>to?'<p role="alert">Tanggal sampai harus sama dengan atau setelah tanggal dari.</p>':'')+
   '<p class="sub">'+selected.length+' mitra · '+selected.reduce((s,g)=>s+g.visitCount,0).toLocaleString('id-ID')+' kunjungan · Total billing '+
   money(selected.reduce((s,g)=>s+g.billing,0))+'</p>'+
   table(['Nama mitra / penjamin','Kategori mitra','Jumlah pasien','Kunjungan','Total billing','Profil'],body||
    '<tr><td colspan="6">Belum ada mitra yang sesuai. Unggah laporan Data Pasien untuk menampilkan penjaminnya.</td></tr>')+pager('list',page,pages);
 }
 function detail(){
  const g=find(detailKey);if(!g)return;
  const note=(from||to)?' · Periode '+(from?fmt(from):'awal data')+' – '+(to?fmt(to):'akhir data'):' · Seluruh periode';
  show('Pasien · '+g.name,'<div class="ops-stack"><p>'+esc(g.type)+note+'</p>'+
   '<p class="sub">'+g.patientCount+' pasien · '+g.visitCount+' kunjungan · Total billing '+money(g.billing)+'</p>'+
   '<label>Cari pasien atau layanan<input id="partner-detail-query" type="search" aria-label="Cari rincian pasien" placeholder="Nama, RM, registrasi, unit, atau pemeriksaan…" value="'+esc(detailQuery)+'"></label>'+
   '<div id="partner-detail-results">'+detailResults()+'</div>'+
   (g.profiles.length?'<div class="actions">'+g.profiles.map(profileButton).join('')+'</div>':'')+'</div>');
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
     '</td><td>'+esc(r[8])+'</td><td>'+esc(r[14]||'—')+'</td><td>'+money(r[12])+'</td></tr>').join('')||
     '<tr><td colspan="7">Belum ada pasien sesuai pencarian.</td></tr>')+pager('detail',detailPage,pages);
 }
 function change(target){
  if(target.id==='partner-detail-query'){
   detailQuery=target.value;detailPage=1;document.getElementById('partner-detail-results').innerHTML=detailResults();return true;
  }
  const fields={'partner-patients-query':v=>query=v,'partner-patients-type':v=>type=v,
   'partner-patients-source':v=>source=v,'partner-patients-from':v=>from=v,'partner-patients-to':v=>to=v};
  if(!fields[target.id])return false;
  fields[target.id](target.value);page=1;document.getElementById('partner-patients-results').innerHTML=results();return true;
 }
 return {view,change,click(d){
  if(d.partnerPatients==='detail'){detailKey=d.partnerKey;detailQuery='';detailPage=1;detail();return}
  if(d.partnerPatients.startsWith('list-')){
   page+=d.partnerPatients==='list-next'?1:-1;document.getElementById('partner-patients-results').innerHTML=results();return;
  }
  detailPage+=d.partnerPatients==='detail-next'?1:-1;
  document.getElementById('partner-detail-results').innerHTML=detailResults();
 }};
}
