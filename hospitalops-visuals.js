const groups=[['month','Bulan masuk'],['day','Tanggal masuk'],['category','Kategori unit'],['unit','Unit / poli'],['payer','Penjamin'],['insurance','Grup jaminan']];
const metrics=[['visits','Jumlah kunjungan'],['patients','Pasien unik (No RM)'],['billing','Total billing'],['claims','Total tarif e-Klaim'],['average','Rata-rata billing / kunjungan']];
const types=[['bar','Diagram batang'],['line','Diagram garis'],['pie','Diagram lingkaran'],['table','Tabel ringkasan']];
const columns={category:7,unit:8,payer:9,insurance:10};
const colors=['#087b63','#449ed0','#e4a83b','#8672bf','#da7b75','#48b5a1','#717e97'];
const currency=new Set(['billing','claims','average']);
const labelOf=(list,key)=>list.find(([id])=>id===key)?.[1]||key;

export function aggregatePatients(rows,config){
 const grouped=new Map();
 let visits=0,missingRM=0;
 for(const r of rows){
  if(config.from&&r[5]<config.from||config.to&&r[5]>config.to||config.category&&r[7]!==config.category||
   config.insurance&&r[10]!==config.insurance)continue;
  visits++;
  const key=config.group==='month'?r[5].slice(0,7):config.group==='day'?r[5]:r[columns[config.group]]||'Belum diisi';
  if(!grouped.has(key))grouped.set(key,{key,visits:0,billing:0,claims:0,patients:new Set()});
  const group=grouped.get(key);group.visits++;group.billing+=Number(r[12])||0;group.claims+=Number(r[11])||0;
  const rm=String(r[1]||'').trim();
  if(rm&&rm!=='0'&&rm!=='-')group.patients.add(rm);else missingRM++;
 }
 const result=[...grouped.values()].map(g=>({key:g.key,value:config.metric==='average'?g.billing/g.visits:
  config.metric==='patients'?g.patients.size:g[config.metric]}));
 result.sort(config.sort==='category'?(a,b)=>a.key.localeCompare(b.key):
  config.sort==='ascending'?(a,b)=>a.value-b.value||a.key.localeCompare(b.key):(a,b)=>b.value-a.value||a.key.localeCompare(b.key));
 return {rows:result.slice(0,Number(config.limit)||12),groups:result.length,visits,missingRM};
}

export function createVisuals(ui){
 const {rows,records,data,heading,panel,button,table,label,input,select,options,esc,show,form,money,unique}=ui;
 const number=value=>Number(value).toLocaleString('id-ID',{maximumFractionDigits:2});
 const format=(value,metric)=>currency.has(metric)?money(Math.round(value*100)/100):number(value);
 const act=(name,action,id='',primary=false)=>button(name,'data-visual="'+action+'" data-visual-id="'+esc(id)+'"',primary?'plus':'',primary);
 const saved=()=>records('visualizations');
 const defaultConfig=()=>({name:'Kunjungan per bulan',type:'bar',group:'month',metric:'visits',sort:'category',limit:'12',order:saved().filter(r=>!r.archived).length+1,from:'',to:'',category:'',insurance:''});
 const groupLabel=(key,group)=>{
  if(group==='month')return new Intl.DateTimeFormat('id-ID',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(key+'-01T00:00:00Z'));
  if(group==='day')return new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(key+'T00:00:00Z'));
  return key;
 };
 function renderVisual(config){
  const result=aggregatePatients(rows(),config);
  if(!result.rows.length)return '<div class="empty">Belum ada data pada filter ini.</div>';
  const pairs=result.rows.map(r=>({...r,label:groupLabel(r.key,config.group)}));
  const desc=labelOf(metrics,config.metric)+' menurut '+labelOf(groups,config.group);
  const note='<p class="sub">'+number(result.visits)+' kunjungan · '+pairs.length+' dari '+result.groups+' kelompok'+
   (config.metric==='patients'?' · Pasien unik dihitung per kelompok'+(result.missingRM?' · '+result.missingRM+' kunjungan tanpa No RM dilewati':''):'')+'</p>';
  if(config.type==='table')return note+table([labelOf(groups,config.group),labelOf(metrics,config.metric)],
   pairs.map(p=>'<tr><td>'+esc(p.label)+'</td><td>'+esc(format(p.value,config.metric))+'</td></tr>').join(''));
  if(config.type==='pie'){
   if(pairs.some(p=>p.value<0))return note+'<p role="status">Terdapat nilai negatif. Gunakan diagram batang, garis, atau tabel.</p>';
   const total=pairs.reduce((s,p)=>s+p.value,0);
   if(!total)return note+'<div class="empty">Nilai total nol.</div>';
   let offset=0;
   const slices=pairs.map((p,i)=>{
    const percent=p.value/total*100;
    const slice='<circle cx="60" cy="60" r="42" pathLength="100" fill="none" stroke="'+colors[i%colors.length]+
     '" stroke-width="25" stroke-dasharray="'+percent+' '+(100-percent)+'" stroke-dashoffset="'+(-offset)+'" transform="rotate(-90 60 60)"><title>'+
     esc(p.label+' · '+format(p.value,config.metric)+' · '+number(percent)+'%')+'</title></circle>';
    offset+=percent;return slice;
   }).join('');
   return note+'<div class="viz-pie"><svg viewBox="0 0 120 120" role="img" aria-label="'+esc(desc)+'">'+slices+'</svg><ul>'+
    pairs.map((p,i)=>'<li><i style="background:'+colors[i%colors.length]+'"></i>'+esc(p.label)+' <strong>'+
     esc(format(p.value,config.metric))+'</strong> · '+number(p.value/total*100)+'%</li>').join('')+'</ul></div>';
  }
  const min=Math.min(0,...pairs.map(p=>p.value)),max=Math.max(0,...pairs.map(p=>p.value));
  const range=max-min||1;
  if(config.type==='bar'){
   const left=155,right=450,x=v=>left+(v-min)/range*(right-left),height=pairs.length*38+15;
   const body=pairs.map((p,i)=>{
    const y=12+i*38,start=Math.min(x(0),x(p.value)),width=Math.abs(x(p.value)-x(0));
    return '<text x="0" y="'+(y+15)+'">'+esc(p.label.length>22?p.label.slice(0,21)+'…':p.label)+'<title>'+esc(p.label)+'</title></text>'+
     '<rect x="'+start+'" y="'+y+'" width="'+width+'" height="22" rx="3" fill="'+colors[0]+'"><title>'+esc(p.label+' · '+format(p.value,config.metric))+'</title></rect>'+
     '<text x="458" y="'+(y+15)+'">'+esc(format(p.value,config.metric))+'</text>';
   }).join('');
   return note+'<svg class="viz-chart" viewBox="0 0 610 '+height+'" role="img" aria-label="'+esc(desc)+'"><line x1="'+x(0)+'" x2="'+x(0)+'" y1="0" y2="'+height+'" stroke="#dde8e3"/>'+body+'</svg>';
  }
  const x=i=>55+i*490/Math.max(pairs.length-1,1),y=v=>220-(v-min)/range*175;
  const line=pairs.map((p,i)=>x(i)+','+y(p.value)).join(' ');
  const ticks=[0,.5,1].map(t=>'<line x1="55" x2="545" y1="'+y(min+t*range)+'" y2="'+y(min+t*range)+'" stroke="#e5eeea"/>'+
   '<text x="48" y="'+(y(min+t*range)+4)+'" text-anchor="end">'+esc(number(min+t*range))+'</text>').join('');
  return note+'<svg class="viz-chart" viewBox="0 0 610 310" role="img" aria-label="'+esc(desc)+'">'+ticks+
   '<polyline points="'+line+'" fill="none" stroke="'+colors[0]+'" stroke-width="3"/>'+
   pairs.map((p,i)=>'<circle cx="'+x(i)+'" cy="'+y(p.value)+'" r="4" fill="'+colors[0]+'"><title>'+esc(p.label+' · '+format(p.value,config.metric))+'</title></circle>'+
    '<text transform="translate('+x(i)+',238) rotate(35)" font-size="10">'+esc(p.label.length>16?p.label.slice(0,15)+'…':p.label)+'</text>').join('')+'</svg>';
 }
 function view(){
  const list=saved().filter(r=>!r.archived).sort((a,b)=>Number(a.order)-Number(b.order)||a.id.localeCompare(b.id));
  const empty='<div class="empty">Tambahkan visualisasi, lalu pilih bentuk, kelompok data, nilai, dan filter.</div>';
  const cards=list.map(c=>panel(c.name,labelOf(metrics,c.metric)+' · '+labelOf(groups,c.group),
   renderVisual(c),act('Atur','edit',c.id))).join('');
  const archived=saved().filter(r=>r.archived);
  return heading('Visualisasi Data','Susun dashboard dari tabel Data Pasien. Setiap visualisasi memiliki pengaturan dan filter sendiri.',act('Tambah visualisasi','new','',true))+
   (!rows().length?'<div class="panel card"><p>Unggah Excel di Data Pasien untuk menampilkan hasil visualisasi.</p>'+button('Buka Data Pasien','data-nav="patients"')+'</div>':'')+
   (list.length?'<div class="grid viz-grid">'+cards+'</div>':empty)+
   (archived.length?'<details class="panel card"><summary>Visualisasi diarsipkan ('+archived.length+')</summary><div class="actions">'+archived.map(c=>act('Pulihkan '+c.name,'restore',c.id)).join('')+'</div></details>':'');
 }
 function editor(config){
  const c=config||defaultConfig(),categories=[...new Set(rows().map(r=>r[7]))].filter(Boolean).sort(),insurances=[...new Set(rows().map(r=>r[10]))].filter(Boolean).sort();
  const controls='<div class="ops-grid">'+label('Judul visualisasi',input('name',c.name,'text','required maxlength="100"'))+
   label('Bentuk visualisasi',select('type',types,c.type))+
   label('Kelompok data',select('group',groups,c.group))+
   label('Nilai yang dihitung',select('metric',metrics,c.metric))+
   label('Urutkan',select('sort',[['category','Kategori / waktu A–Z'],['descending','Nilai terbesar'],['ascending','Nilai terkecil']],c.sort))+
   label('Jumlah kelompok',input('limit',c.limit,'number','required min="1" max="30" step="1"'))+
   label('Tanggal masuk dari',input('from',c.from,'date','min="1900-01-01" max="2100-12-31"'))+
   label('Tanggal masuk sampai',input('to',c.to,'date','min="1900-01-01" max="2100-12-31"'))+
   label('Kategori unit',select('category',[['','Semua kategori'],...new Set([...categories,...(c.category?[c.category]:[])])],c.category))+
   label('Grup jaminan',select('insurance',[['','Semua grup jaminan'],...new Set([...insurances,...(c.insurance?[c.insurance]:[])])],c.insurance))+
   label('Posisi di dashboard',input('order',c.order||1,'number','required min="1" max="999" step="1"'))+'</div>'+
   '<h3>Pratinjau</h3><div id="visual-preview">'+renderVisual(c)+'</div>';
  show(config?'Atur visualisasi':'Tambah visualisasi',form('visual-save',controls,'Simpan visualisasi','data-id="'+esc(config?.id||'')+'"')+
   (config?'<div class="actions">'+act('Arsipkan visualisasi','archive',config.id)+'</div>':''));
  ui.wide();
 }
 function validate(v){
  for(const [key,list] of [['type',types],['group',groups],['metric',metrics]]){
   if(!list.some(([id])=>id===v[key]))throw Error('Periksa pilihan visualisasi.');
  }
  if(!['category','descending','ascending'].includes(v.sort)||!Number.isInteger(Number(v.limit))||v.limit<1||v.limit>30||
   !Number.isInteger(Number(v.order))||v.order<1||v.order>999)throw Error('Periksa urutan dan jumlah kelompok.');
  if(v.from&&v.to&&v.from>v.to)throw Error('Tanggal sampai harus sama dengan atau setelah tanggal dari.');
 }
 function change(target){
  if(target.form?.dataset.form!=='visual-save')return false;
  const value=Object.fromEntries(new FormData(target.form)),preview=document.getElementById('visual-preview');
  try{validate(value);preview.innerHTML=renderVisual(value)}catch(error){preview.textContent=error.message}
  return true;
 }
 function mutate(f,v){
  const id=f.dataset.id,old=saved().find(r=>r.id===id);
  if(id&&!old)throw Error('Visualisasi tidak ditemukan.');
  let next;
  if(f.dataset.form==='visual-archive'){
   next={...old,archived:v.archived==='true'};
  }else{
   validate(v);
   if(!v.name.trim())throw Error('Isi judul visualisasi.');
   next={id:id||unique(),...v,name:v.name.trim(),archived:false};
  }
  data().records.visualizations=old?saved().map(r=>r.id===old.id?next:r):[...saved(),next];
  return {page:'visuals',message:'Pengaturan visualisasi tersimpan.'};
 }
 return {view,change,mutate,click(d){
  if(d.visual==='new')return editor();
  const c=saved().find(r=>r.id===d.visualId);
  if(!c)return;
  if(d.visual==='edit')return editor(c);
  show(d.visual==='restore'?'Pulihkan visualisasi':'Arsipkan visualisasi',form('visual-archive',
   '<p>'+esc(c.name)+'</p><input type="hidden" name="archived" value="'+(d.visual==='restore'?'false':'true')+'">',
   d.visual==='restore'?'Pulihkan':'Arsipkan','data-id="'+esc(c.id)+'"'));
 }};
}
