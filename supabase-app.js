import { createOperations } from './hospitalops-operations.js';
import {
 watchUser, login, register, logout, resetPassword, updatePassword, listOrganizations,
 createOrganization, joinOrganization, grantManager, loadOrganization, saveChanges
} from './supabase-client.js';

const drawings={
plus:'<path d="M12 5v14M5 12h14"/>',brand:'<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',home:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',tasks:'<rect x="4" y="4" width="16" height="17" rx="2"/><path d="m8 12 3 3 5-6M9 4V2h6v2"/>',sales:'<path d="M3 20h18M5 17V9m5 8V5m5 12v-5m5 5V3"/>',people:'<circle cx="9" cy="8" r="3"/><path d="M2 20v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2m2-16a3 3 0 0 1 0 6m0 4a4 4 0 0 1 4 4v2"/>',pin:'<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',digital:'<path d="m3 11 16-6v14L3 14zm4 4 2 5h4l-2-4m10-7v6"/>',content:'<path d="M5 3h11l3 3v15H5zM8 9h8m-8 4h8m-8 4h5"/>',video:'<rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 9 5-3v12l-5-3"/>',heart:'<path d="M20 5a5 5 0 0 0-7 0l-1 1-1-1a5 5 0 0 0-7 7l8 8 8-8a5 5 0 0 0 0-7z"/><path d="M7 12h2l2-3 2 6 2-3h2"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8 3 3M5 19l3-3m8-8 3-3"/><circle cx="12" cy="12" r="8"/>',chev:'<path d="m7 10 5 5 5-5"/>',arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8m-8 12h4"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',flow:'<rect x="2" y="8" width="6" height="8" rx="1"/><rect x="16" y="8" width="6" height="8" rx="1"/><path d="M8 12h8"/>',money:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h1m10 0h1"/>'
};
function icon(name){return '<svg class="icon icon-'+name+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(drawings[name]||drawings.content)+'</svg>'}
const previewRole='Manager';
const modules=[
['overview','Ringkasan','home','Ruang kerja'],['import-doc','Impor Dokumen','content','Ruang kerja'],['pks','PKS / MoU','content','Sales & relasi'],['calendar','Kalender Terpadu','calendar','Ruang kerja'],['tasks','Delegasi Tugas','tasks','Ruang kerja'],
['pipeline','Pipeline Sales','sales','Sales & relasi',[4,7]],['leads','Leads Tracking','people','Sales & relasi',[1,4,7]],['canvass','Canvassing','pin','Sales & relasi',[4]],['visits','Laporan Visit','content','Sales & relasi',[4,7]],
['digital','Digital Marketing','digital','Marketing & media',[1,6]],['spend','Kontrol Ads Spend','money','Marketing & media',[1,6]],['conv','Konversi Ads','sales','Marketing & media',[1,6]],['social','Planner Media Sosial','calendar','Marketing & media',[1,2,5,6]],['articles','Planner Artikel Website','content','Marketing & media',[1,2,6]],['promo','Jadwal Campaign Promo','digital','Marketing & media',[1,2,4,6,7]],['video','Planner Produksi Video','video','Marketing & media',[1,2,5,6]],
['events','Event Activation','calendar','Program & layanan',[3,4,5,6,7]],['pkrs','Planner Promkes','heart','Program & layanan',[3,5,6]],['mcu','Jadwal MCU Onsite','brand','Program & layanan',[4,7]],['out','Pasien Rawat Jalan','people','Pelaporan & analisis',[4]],['in','Pasien Rawat Inap','heart','Pelaporan & analisis',[4]],['report','Pelaporan','content','Pelaporan & analisis',[1,3,4,6,7]],['analysis','Analisis Kinerja','sales','Pelaporan & analisis',[1,6,7]],['settings','Pengaturan Modul','settings','Organisasi',[]]
];
function campaigns(){return Object.fromEntries(records('promo').map(r=>[r.campaign||r.id,r.name]))}
const planIds=['canvass','visits','digital','social','articles','promo','video','events','pkrs','mcu','tasks'];
const stages=['Prospek','Kualifikasi','Proposal','Negosiasi','Menang'];
const statuses=['Terjadwal','Diproses','Selesai'];
let state={org:null,orgs:[],workspace:null};
let page='overview',period='Bulanan',chartType='out',query='',statusFilter='',patientFilters={},calendarMonth=currentDate().slice(0,7),toastTimer;
const org=()=>state.workspace;
const data=()=>org().data;
const mod=id=>[...modules,...data().custom].find(m=>m[0]===id);
const allowed=m=>m&&!data().disabled.includes(m[0]);
const records=id=>data().records[id]||[];
function currentDate(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
const fixedDate=currentDate();
function dateWindow(){
 const date=new Date(fixedDate+'T00:00:00Z');
 const iso=d=>d.toISOString().slice(0,10);
 if(period==='Harian')return [fixedDate,fixedDate];
 if(period==='Mingguan'){
   date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);
   const first=iso(date);
   date.setUTCDate(date.getUTCDate()+6);
   return [first,iso(date)];
 }
 return [fixedDate.slice(0,7)+'-01',iso(new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)))];
}
const money=n=>'Rp '+Number(n).toLocaleString('id-ID');
const num=n=>Number(n).toLocaleString('id-ID');
const percent=(a,b)=>b?(a/b*100).toLocaleString('id-ID',{maximumFractionDigits:1})+'%':'0%';
const fmt=d=>d?new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(d+'T00:00:00Z')):'–';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const initials=(s)=>s.split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();
function toast(msg){const box=document.querySelector('#toast');box.hidden=false;box.textContent=msg;clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.hidden=true,3200)}
function button(label,action,ic='',primary=false){return '<button type="button" class="btn '+(primary?'primary':'')+'" '+action+'>'+ (ic?icon(ic):'')+esc(label)+'</button>'}
function pill(s){return '<span class="pill '+(['Proposal','Negosiasi','Diproses'].includes(s)?'warn':['Terjadwal','Prospek','Kualifikasi'].includes(s)?'neutral':'')+'">'+esc(s)+'</span>'}
function goto(id){if(!allowed(mod(id)))return;page=id;query='';statusFilter='';patientFilters={};document.querySelector('#sidebar').classList.remove('open');render();window.scrollTo(0,0)}
function nav(id){return 'data-nav="'+esc(id)+'"'}
function render(){
  const visible=[...modules,...data().custom].filter(allowed);
  const groups=[...new Set(visible.map(m=>m[3]))];
  document.querySelector('#sidebar').innerHTML='<div class="brand"><span class="logo">'+icon('brand')+'</span><div>HospitalOps<small>Sales & Marketing</small></div></div><button class="org" data-action="org"><span class="orgmark">'+initials(org().name)+'</span><span>'+esc(org().name)+'<small>Organisasi</small></span>'+icon('chev')+'</button><nav>'+groups.map(g=>'<span class="navlabel">'+esc(g.toUpperCase())+'</span>'+visible.filter(m=>m[3]===g).map(m=>'<button class="navbtn '+(page===m[0]?'active':'')+'" '+nav(m[0])+(page===m[0]?' aria-current="page"':'')+'>'+icon(m[2])+esc(m[1])+'</button>').join('')).join('')+'</nav><footer><div class="person"><span class="avatar" aria-hidden="true">'+initials(previewRole)+'</span><span>'+esc(previewRole)+'<small>Peran akun</small></span></div></footer>';
  document.querySelector('#topbar').innerHTML='<button class="iconbtn mobile" data-action="menu" aria-label="Buka menu">'+icon('menu')+'</button><div class="bread"><span>'+esc(org().name)+'</span><span>/</span><strong>'+esc(mod(page)[1])+'</strong></div><div class="tools"><span class="badge"><i class="dot"></i> Supabase</span><button class="iconbtn" data-action="notifications" aria-label="Pengaturan notifikasi">'+icon('bell')+'</button></div>';
  const content=document.querySelector('#content');
  const views={overview,calendar,'import-doc':operations.importView,pks:operations.pksView,leads:leadsView,tasks:recordView,spend:()=>adsView(false),conv:()=>adsView(true),out:()=>patientView('out'),in:()=>patientView('in'),report:()=>reportView(false),analysis:()=>reportView(true),settings};
  content.innerHTML=(views[page]||recordView)();
}
function heading(title,sub,actions='',tag=''){return '<div class="heading"><div>'+(tag?'<div class="eyebrow">'+esc(tag)+'</div>':'')+'<h1>'+esc(title)+'</h1><p class="sub">'+esc(sub)+'</p></div><div class="actions">'+actions+'</div></div>'}
function panel(title,sub,body,action=''){return '<section class="panel card"><div class="panel-head"><div><h2>'+esc(title)+'</h2><p class="sub">'+esc(sub)+'</p></div>'+action+'</div>'+body+'</section>'}
function link(id,label='Lihat semua →'){return allowed(mod(id))?'<button class="link" '+nav(id)+'>'+esc(label)+'</button>':''}
function total(type){return data().patients[type].reduce((sum,r)=>sum+r[4],0)}
function adsTotal(field){return data().ads.reduce((acc,r)=>acc+r[field],0)}
function periodRows(id){const [start,end]=dateWindow();return records(id).filter(r=>r.date>=start&&r.date<=end)}
function metric(label,value,detail,change,ic,color,id){return '<button class="card metric" '+nav(id)+'><div class="metric-top">'+esc(label)+'<span class="tile-icon '+color+'">'+icon(ic)+'</span></div><b>'+esc(value)+'</b><div class="metric-foot"><span class="pill">'+esc(change)+'</span>'+esc(detail)+'</div></button>'}
function flow(){
 const steps=[['Plan','Jadwal & agenda','calendar','calendar'],['Eksekusi','Delegasi & tindak lanjut','tasks','tasks'],['Reporting','Rekap hasil','content','report'],['Analyzing','Evaluasi kinerja','sales','analysis']];
 return '<section class="workflow"><div class="workflow-title">'+icon('flow')+'Alur kerja tim</div><div class="steps">'+steps.filter(s=>allowed(mod(s[3]))).map(([title,sub,ic,id])=>'<button class="step" '+nav(id)+'>'+icon(ic)+'<span><strong>'+title+'</strong><small>'+sub+'</small></span>'+icon('arrow')+'</button>').join('')+'</div></section>';
}
function overview(){
 const metrics=[
 ['Rawat Jalan',num(total('out')),'pasien tercatat','RJ','people','','out'],['Rawat Inap',num(total('in')),'pasien tercatat','RI','heart','blue','in'],
 ['Peluang Sales',num(periodRows('pipeline').filter(r=>r.status!=='Menang').length),'dalam periode','Aktif','sales','amber','pipeline'],['Belanja Iklan',money(adsTotal('spend')),'anggaran terpakai',percent(adsTotal('spend'),adsTotal('budget')),'money','purple','spend'],
 ['Leads Tercatat',num(periodRows('leads').length),'dalam periode','Leads','people','','leads'],['Konversi Iklan',percent(adsTotal('booking'),adsTotal('leads')),'leads ke booking','Booking','sales','blue','conv'],['Tugas Aktif',num(periodRows('tasks').filter(r=>r.status!=='Selesai').length),'dalam periode','Tugas','tasks','amber','tasks'],['Agenda Terjadwal',num(agenda().length),'agenda terjadwal','Agenda','calendar','','calendar']
 ].filter(r=>allowed(mod(r[6]))).slice(0,4);
 const left=allowed(mod('out'))?chartPanel():panel('Tugas Tim','Daftar tugas tim',agendaList(records('tasks'),'tasks'),link('tasks'));
 const right=allowed(mod('pipeline'))?pipelinePanel():panel('Agenda Mendatang','Kalender program dan campaign',agendaList(agenda(),''),link('calendar'));
 return heading('Ringkasan Operasional','Pantau penjualan, marketing, dan aktivitas tim '+org().name+'.','<select class="inline-select" id="period" aria-label="Periode aktivitas">'+options(['Harian','Mingguan','Bulanan'],period)+'</select>'+button('Buat aktivitas','data-action="activity"','plus',true),'RUANG KERJA')+flow()+'<section class="metrics">'+metrics.map(r=>metric(...r)).join('')+'</section><div class="grid">'+left+right+'</div>'+(allowed(mod('out'))||allowed(mod('pipeline'))?'<div class="grid">'+panel('Agenda Mendatang','Jadwal program dan campaign',agendaList(agenda(),''),link('calendar'))+panel('Tugas Tim','Delegasi dan tenggat',agendaList(records('tasks'),'tasks'),link('tasks'))+'</div>':'');
}
function chartPanel(){
 const care=chartType==='out'?'Rawat Jalan':'Rawat Inap';
 const tabs='<div class="chart-toggle">'+[['out','Rawat Jalan'],['in','Rawat Inap']].filter(([id])=>allowed(mod(id))).map(([k,l])=>'<button type="button" data-chart="'+k+'" class="'+(chartType===k?'on':'')+'" aria-pressed="'+(chartType===k)+'">'+l+'</button>').join('')+'</div>';
 const value=total(chartType);
 return panel('Kunjungan Pasien',care,value?'<p class="numeric">'+num(value)+' pasien tercatat</p>':'<div class="empty">Belum ada data kunjungan.</div>',tabs);
}
function pipelinePanel(){
 const rows=periodRows('pipeline'),counts=stages.map(s=>rows.filter(r=>r.status===s).length),colors=['#a6d9c8','#81cbb4','#52ae94','#258b72','#08765e'];
 return panel('Pipeline Sales','Peluang per tahap',stages.map((s,i)=>'<div class="stage"><div class="stage-label"><span>'+s+'</span><span>'+counts[i]+'</span></div><div class="track"><i style="background:'+colors[i]+';width:'+counts[i]/Math.max(rows.length,1)*100+'%"></i></div></div>').join(''),link('pipeline','Buka pipeline →'));
}
function agenda(){
 return [...planIds,...data().custom.map(m=>m[0])].filter(id=>allowed(mod(id))).flatMap(id=>records(id).filter(r=>r.date&&r.status!=='Selesai').map(r=>({...r,module:id}))).sort((a,b)=>a.date.localeCompare(b.date));
}
function agendaList(rows,id){
 const selected=rows.filter(r=>r.date>=fixedDate).slice(0,3);
 return selected.length?selected.map(r=>'<div class="event"><span class="date">'+r.date.slice(-2)+'<small>'+esc(fmt(r.date).split(' ')[1].toUpperCase())+'</small></span><div><button class="rowbtn" data-edit="'+esc(r.id)+'" data-module="'+esc(id||r.module)+'">'+esc(r.name)+'</button><small>'+esc(r.owner)+'</small></div>'+pill(r.status)+'</div>').join(''):'<div class="empty">Belum ada agenda mendatang.</div>';
}
function options(items,selected){return items.map(i=>{const [v,t]=Array.isArray(i)?i:[i,i];return '<option value="'+esc(v)+'"'+(String(selected)===String(v)?' selected':'')+'>'+esc(t)+'</option>'}).join('')}
function calendar(){
 const [year,month]=calendarMonth.split('-').map(Number),first=new Date(Date.UTC(year,month-1,1)),shift=(first.getUTCDay()+6)%7,max=new Date(Date.UTC(year,month,0)).getUTCDate();
 const rows=agenda().filter(r=>r.date.startsWith(calendarMonth));
 const label=new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric',timeZone:'UTC'}).format(first);
 const cells=Array.from({length:Math.ceil((shift+max)/7)*7},(_,i)=>{const d=i-shift+1;return d<1||d>max?'<div class="day dim"></div>':'<div class="day"><strong>'+d+'</strong>'+rows.filter(r=>Number(r.date.slice(-2))===d).map(r=>'<button class="mini" data-edit="'+esc(r.id)+'" data-module="'+esc(r.module)+'">'+esc(r.name)+'</button>').join('')+'</div>'}).join('');
 return heading('Kalender Terpadu','Jadwal lintas modul dalam organisasi.',button('Buat aktivitas','data-action="activity"','plus',true))+panel(label,num(rows.length)+' agenda terjadwal','<div class="cal">'+['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(d=>'<div class="cal-head">'+d+'</div>').join('')+cells+'</div>','<div class="actions">'+button('‹','data-month="-1" aria-label="Bulan sebelumnya"')+button('›','data-month="1" aria-label="Bulan berikutnya"')+'</div>');
}
const descriptions={pipeline:'Kelola prospek perusahaan, kemitraan, dan tindak lanjut tim.',leads:'Catat sumber lead, hubungkan ke campaign, dan pantau tindak lanjut.',canvass:'Rencanakan canvassing perusahaan dan institusi.',visits:'Catat hasil kunjungan, PIC, dan tindak lanjut lapangan.',digital:'Kelola pekerjaan digital dan hubungkan aktivitas ke campaign.',social:'Rencanakan konten media sosial, PIC, dan tanggal tayang.',articles:'Kelola penulisan, review, dan publikasi artikel website.',promo:'Atur jadwal campaign dan lihat aktivitas yang terhubung.',video:'Kelola brief, jadwal syuting, dan produksi video.',events:'Rencanakan aktivasi dan tindak lanjut acara.',pkrs:'Jadwalkan edukasi kesehatan dan kegiatan PKRS.',mcu:'Kelola jadwal dan koordinasi MCU onsite.',tasks:'Delegasikan tugas ke peran tim dan pantau tenggatnya.'};
function recordView(){
 const id=page,title=mod(id)[1],rows=records(id);
 const stageOptions=id==='pipeline'?stages:statuses;
 return heading(title,descriptions[id]||'Kelola aktivitas organisasi dalam modul ini.',button(id==='tasks'?'Delegasikan tugas':id==='promo'?'Tambah campaign':'Tambah catatan','data-action="new"','plus',true))+panel(id==='pipeline'?'Tahap peluang':'Daftar aktivitas',num(rows.length)+' catatan', '<div class="filters"><input id="query" type="search" aria-label="Cari catatan" placeholder="Cari catatan…" value="'+esc(query)+'"><select id="statusFilter" aria-label="Filter status">'+options([['','Semua status'],...stageOptions],statusFilter)+'</select></div><div id="recordResults">'+recordResults()+'</div>');
}
function recordResults(){
 const id=page,rows=records(id).filter(r=>(!statusFilter||r.status===statusFilter)&&[r.name,r.owner,r.source,campaigns()[r.campaign]].join(' ').toLowerCase().includes(query.toLowerCase()));
 const action=r=>'data-edit="'+esc(r.id)+'" data-module="'+esc(id)+'"';
 if(id==='pipeline'){
   const cols=statusFilter?[statusFilter]:stages;
   return '<div class="board">'+cols.map(s=>'<div class="column"><h3>'+s+' · '+rows.filter(r=>r.status===s).length+'</h3>'+rows.filter(r=>r.status===s).map(r=>'<button class="boarditem" '+action(r)+'><strong>'+esc(r.name)+'</strong><small>'+esc(r.owner)+' · '+fmt(r.date)+'</small></button>').join('')+'</div>').join('')+'</div>';
 }
 return rows.length?'<div class="tablewrap"><table><thead><tr><th>Aktivitas</th><th>PIC</th><th>Tanggal</th><th>Status</th><th>Campaign</th>'+'</tr></thead><tbody>'+rows.map(r=>'<tr><td><button class="rowbtn" '+action(r)+'>'+esc(r.name)+'</button></td><td>'+esc(r.owner)+'</td><td>'+fmt(r.date)+'</td><td>'+pill(r.status)+'</td><td>'+esc(campaigns()[r.campaign]||'–')+'</td>'+'</tr>').join('')+'</tbody></table></div>':'<div class="empty">Belum ada catatan yang cocok.</div>';
}
const leadViews=[
 ['active','Lead masuk atau tindakan bulan ini'],
 ['new','Lead baru · Tanggal event'],
 ['converted','Konversi / sales · Tanggal tindakan dan billing terisi'],
 ['all','Seluruh riwayat']
];
const leadFunnels=['Terjadwal','Diproses','Selesai','Lead baru','Follow-up','Booking','Visit awal','Tindakan','Tidak lanjut'];
const leadDateLimits='min="1900-01-01" max="2100-12-31"';
let leadState={month:fixedDate.slice(0,7),campaign:'',view:'active'};
const inLeadMonth=(date,month)=>typeof date==='string'&&date.slice(0,7)===month;
const hasBilling=r=>typeof r.billing==='number'&&Number.isFinite(r.billing);
function leadMonthlyRows(month){
 const labels=campaigns();
 const leads=records('leads');
 const costs=data().leadCosts?.[month]||{};
 const rows=Object.entries(labels).map(([id,name])=>({id,name}));
 for(const id of new Set(leads.map(r=>r.campaign||'none'))){
  if(!Object.hasOwn(labels,id))rows.push({id,name:id==='none'?'Tanpa campaign':'Campaign tidak ditemukan'});
 }
 return rows.map(({id,name})=>{
  const own=leads.filter(r=>(r.campaign||'none')===id);
  const newLeads=own.filter(r=>inLeadMonth(r.date,month));
  const converted=own.filter(r=>inLeadMonth(r.treatmentDate,month)&&hasBilling(r));
  const objective=records('promo').find(r=>(r.campaign||r.id)===id)?.objective;
  return {id,name,objective,newLeads,converted,cost:costs[id],sales:converted.reduce((sum,r)=>sum+r.billing,0)};
 });
}
function leadMetric(value,kind,campaign,description){
 return '<button class="rowbtn numeric" data-lead-view="'+kind+'" data-lead-campaign="'+esc(campaign)+'" aria-label="'+esc(description+' · '+value)+'">'+esc(value)+'</button>';
}
function leadsView(){
 const labels=campaigns();
 const monthLabel=new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(leadState.month+'-01T00:00:00Z'));
 const monthly=leadMonthlyRows(leadState.month);
 const rows=monthly.filter(r=>!leadState.campaign||r.id===leadState.campaign);
 const n=rows.reduce((s,r)=>s+r.newLeads.length,0),c=rows.reduce((s,r)=>s+r.converted.length,0);
 const sales=rows.reduce((s,r)=>s+r.sales,0);
 const costs=rows.filter(r=>r.cost!==undefined);
 const filters='<div class="filters lead-filters">'+label('Bulan laporan','<input id="leadMonth" type="month" value="'+leadState.month+'" min="1900-01" max="2100-12">')+label('Campaign','<select id="leadCampaign">'+options([['','Semua campaign'],...monthly.map(r=>[r.id,r.name])],leadState.campaign)+'</select>')+'</div>';
 const cards=[
  ['Lead baru',num(n),'Tanggal event','people','new'],
  ['Konversi',num(c),'Tindakan dengan billing terisi','sales','converted'],
  ['Sales',money(sales),'Billing tindakan pada bulan ini','money','converted'],
  ['Cost tercatat',costs.length?money(costs.reduce((s,r)=>s+r.cost,0)):'–',costs.length+' dari '+rows.length+' baris memiliki biaya','money','']
 ].map(([title,val,detail,ic,view])=>{
  const body='<div class="metric-top">'+title+'<span class="tile-icon blue">'+icon(ic)+'</span></div><b>'+val+'</b><div class="metric-foot">'+detail+'</div>';
  return view?'<button class="card metric" data-lead-view="'+view+'" data-lead-campaign="'+esc(leadState.campaign)+'">'+body+'</button>':'<div class="card metric">'+body+'</div>';
 }).join('');
 const tbody=rows.map(r=>'<tr><td>'+esc(r.name)+'</td><td>'+esc(r.objective||'–')+'</td><td>'+
 (Object.hasOwn(labels,r.id)?'<button class="rowbtn numeric" data-lead-cost="'+esc(r.id)+'" aria-label="'+esc('Atur cost '+r.name)+'">'+(r.cost===undefined?'Isi cost':money(r.cost))+'</button>':'–')+'</td><td>'+
 leadMetric(num(r.newLeads.length),'new',r.id,'Lihat lead baru '+r.name)+'</td><td>'+
 leadMetric(num(r.converted.length),'converted',r.id,'Lihat konversi '+r.name)+'</td><td>'+
 leadMetric(money(r.sales),'converted',r.id,'Lihat rincian sales '+r.name)+'</td></tr>').join('');
 const leadFilters='<div class="filters lead-filters">'+label('Tampilkan','<select id="leadView">'+options(leadViews,leadState.view)+'</select>')+label('Cari lead','<input type="search" id="leadQuery" placeholder="Nama, funnel, channel, atau sumber" value="'+esc(query)+'">')+'</div>';
 return heading('Leads Tracking','Catat lead hingga tindakan dan billing.',button('Tambah lead','data-action="new"','plus',true))+
 filters+'<section class="metrics" aria-label="Ringkasan Leads Tracking">'+cards+'</section><div class="list">'+
 panel('Dashboard Campaign',monthLabel+' · Klik angka untuk melihat catatan penyusunnya.',table(['Campaign','Objektif','Cost','Leads','Konversi','Sales'],tbody||'<tr><td colspan="6">Belum ada campaign. Tambahkan melalui Jadwal Campaign Promo.</td></tr>'))+
 '<div id="leadList" tabindex="-1">'+panel('Daftar Leads','Klik nama lead untuk membuka riwayatnya.',leadFilters+'<div id="leadResults">'+leadResults()+'</div>')+'</div></div>';
}
function leadResults(){
 const {month,campaign,view}=leadState;
 const needle=query.trim().toLowerCase();
 const labels=campaigns();
 const leads=records('leads').filter(r=>{
  if(campaign&&(r.campaign||'none')!==campaign)return false;
  const added=inLeadMonth(r.date,month), treated=inLeadMonth(r.treatmentDate,month);
  if(view==='active'&&!added&&!treated)return false;
  if(view==='new'&&!added)return false;
  if(view==='converted'&&!(treated&&hasBilling(r)))return false;
  return [r.name,r.status,r.channel,r.source,r.segment,labels[r.campaign]].join(' ').toLowerCase().includes(needle);
 });
 const rows=leads.map(r=>'<tr><td><button class="rowbtn" data-edit="'+esc(r.id)+'" data-module="leads">'+esc(r.name)+'</button></td><td>'+esc(labels[r.campaign]||'–')+'</td><td>'+fmt(r.date)+'</td><td>'+fmt(r.followUpDate)+'</td><td>'+fmt(r.visitDate)+'</td><td>'+fmt(r.treatmentDate)+'</td><td>'+pill(r.status||'–')+'</td><td class="numeric">'+(hasBilling(r)?money(r.billing):'–')+'</td></tr>').join('');
 return '<p class="sub lead-count" role="status">'+num(leads.length)+' catatan</p>'+table(['Nama lead','Campaign','Tanggal event','Tgl. follow-up','Visit awal','Tindakan','Funnel','Billing'],rows||'<tr><td colspan="8">Tidak ada lead yang cocok.</td></tr>');
}
function leadForm(r){
 const identity=label('Nama lead',input('name',r?.name,'text','required maxlength="140"'))+
 label('Nomor telepon',input('phone',r?.phone,'tel','maxlength="40"'))+
 label('Tanggal event / lead masuk',input('date',r?.date||fixedDate,'date','required '+leadDateLimits))+
 label('Campaign',select('campaign',[['','Tanpa campaign'],...Object.entries(campaigns())],r?.campaign||''))+
 label('Channel',input('channel',r?.channel,'text','maxlength="80"'))+
 label('Source',input('source',r?.source,'text','maxlength="80"'))+
 label('Segmen',input('segment',r?.segment,'text','maxlength="80"'))+
 label('Funnel',input('status',r?.status||'Lead baru','text','required maxlength="80" list="leadFunnels"'))+
 '<datalist id="leadFunnels">'+options([...new Set([...leadFunnels,...records('leads').map(x=>x.status).filter(Boolean)])])+'</datalist>';
 const journey=label('Tanggal follow-up',input('followUpDate',r?.followUpDate,'date',leadDateLimits))+
 label('Hasil follow-up',input('followUpResult',r?.followUpResult,'text','maxlength="240"'))+
 label('Tanggal visit awal',input('visitDate',r?.visitDate,'date',leadDateLimits))+
 label('Tanggal tindakan',input('treatmentDate',r?.treatmentDate,'date',leadDateLimits))+
 label('Rencana tanggal kontrol',input('controlDate',r?.controlDate,'date',leadDateLimits))+
 label('Rencana tindakan',input('treatmentPlan',r?.treatmentPlan,'text','maxlength="240"'));
 const followups=label('FU 1',input('followUp1',r?.followUp1,'text','maxlength="240"'))+
 label('FU 2',input('followUp2',r?.followUp2,'text','maxlength="240"'))+
 label('FU 3 (setelah kunjungan)',input('followUp3',r?.followUp3,'text','maxlength="240"'));
 const billing=label('Billing (Rp)',input('billing',r?.billing,'number','min="0" max="1000000000000" step="1"'))+
 '<p class="sub">Lead dihitung sebagai konversi jika tanggal tindakan dan billing terisi. Kosongkan billing jika nominal belum tercatat.</p>';
 const group=(title,fields)=>'<fieldset class="lead-fields"><legend>'+title+'</legend>'+fields+'</fieldset>';
 return group('Identitas dan sumber',identity)+group('Follow-up dan kunjungan',journey)+group('Riwayat follow-up',followups)+
 group('Billing dan catatan',billing+'<label class="wide">Catatan<textarea name="note" maxlength="700">'+esc(r?.note)+'</textarea></label>');
}
function editLeadCost(id){
 const name=campaigns()[id];
 if(!allowed(mod('leads'))||!name)return;
 show('Cost campaign',form('leadcost',
  '<p class="sub">'+esc(name)+' · '+esc(leadState.month)+'</p>'+
  label('Cost (Rp)',input('cost',data().leadCosts?.[leadState.month]?.[id],'number','min="0" max="1000000000000" step="1"'))+
  '<p class="sub">Kosongkan jika biaya belum tercatat.</p>',
  'Simpan','data-id="'+esc(id)+'" data-month="'+leadState.month+'"'));
}

function adsView(conversion){
 const titles=conversion?['Campaign','Leads','Booking','Konversi','Biaya per booking']:['Campaign','Anggaran','Belanja','Sisa Anggaran','Pemakaian'];
 const rows=data().ads.map(a=>'<tr><td><button class="rowbtn" data-ads="'+esc(a.id)+'">'+esc(a.name)+'</button></td>'+ (conversion?[num(a.leads),num(a.booking),percent(a.booking,a.leads),a.booking?money(Math.round(a.spend/a.booking)):'–']:[money(a.budget),money(a.spend),money(a.budget-a.spend),percent(a.spend,a.budget)]).map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('');
 return heading(mod(page)[1],conversion?'Pantau konversi dari lead menjadi booking.':'Bandingkan realisasi dengan anggaran tiap campaign.',button('Tambah iklan','data-action="newads"','plus',true))+panel('Kinerja Campaign','Data iklan tercatat',table(titles,rows));
}
function table(titles,rows){
 return '<div class="tablewrap"><table><thead><tr>'+titles.map(t=>'<th>'+esc(t)+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table></div>';
}
function patientView(type){
 const source=data().patients[type],cols=type==='out'?[[0,'Poli'],[3,'Grup Jaminan']]:[[1,'Dokter'],[2,'Tindakan'],[3,'Grup Jaminan']];
 const filters=cols.map(([i,l])=>'<select aria-label="'+l+'" data-patient-filter="'+i+'">'+options([['','Semua '+l],...new Set(source.map(r=>r[i]))],patientFilters[i]||'')+'</select>').join('');
 const rows=source.filter(r=>cols.every(([i])=>!patientFilters[i]||r[i]===patientFilters[i]));
 return heading(mod(page)[1],'Rekap agregat kunjungan pasien')+panel(num(rows.reduce((s,r)=>s+r[4],0))+' pasien','Hasil sesuai filter', '<div class="filters">'+filters+'</div>'+table(['Poli','Dokter','Tindakan','Grup Jaminan','Pasien'],rows.map(r=>'<tr>'+r.map((v,i)=>'<td>'+esc(i===4?num(v):v)+'</td>').join('')+'</tr>').join('')||'<tr><td colspan="5">Tidak ada hasil.</td></tr>'));
}
let campaignFilter='';
function reportView(analysis){
 const campaignEntries=Object.entries(campaigns());
 const [from,to]=dateWindow();
 const rows=campaignEntries.filter(([id])=>!campaignFilter||id===campaignFilter).map(([id,name])=>{
  const linked=[...planIds,'leads','pipeline',...data().custom.map(m=>m[0])].filter(m=>allowed(mod(m))).flatMap(m=>periodRows(m).filter(r=>r.campaign===id).map(r=>({...r,module:m})));
  const ads=data().ads.filter(a=>a.campaign===id);
  return {id,name,linked,ads,spend:ads.reduce((s,a)=>s+a.spend,0),budget:ads.reduce((s,a)=>s+a.budget,0),leads:ads.reduce((s,a)=>s+a.leads,0),bookings:ads.reduce((s,a)=>s+a.booking,0)};
 });
 const showAds=allowed(mod('spend'))||allowed(mod('conv'));
 const filters='<div class="filters"><select id="campaignFilter" aria-label="Filter campaign">'+options([['','Semua campaign'],...campaignEntries],campaignFilter)+'</select><select id="period" aria-label="Periode aktivitas">'+options(['Harian','Mingguan','Bulanan'],period)+'</select></div>';
 const body=analysis?'<div class="insights">'+rows.map(r=>'<div class="insight"><strong>'+esc(r.name)+'</strong><p class="sub">'+(showAds?'Konversi lead ke booking '+percent(r.bookings,r.leads)+' dari '+num(r.leads)+' lead iklan. Belanja '+percent(r.spend,r.budget)+' dari anggaran tercatat. ':'')+num(r.linked.filter(x=>x.status!=='Selesai'&&x.status!=='Menang').length)+' catatan aktif dalam periode terpilih.</p></div>').join('')+'</div>':table(['Campaign','Catatan terkait','Selesai / Menang',...(showAds?['Belanja iklan','Lead Ads','Booking Ads']:[])],rows.map(r=>'<tr><td><button class="rowbtn" data-campaign="'+esc(r.id)+'">'+esc(r.name)+'</button></td><td>'+num(r.linked.length)+'</td><td>'+num(r.linked.filter(x=>['Selesai','Menang'].includes(x.status)).length)+'</td>'+(showAds?'<td>'+money(r.spend)+'</td><td>'+num(r.leads)+'</td><td>'+num(r.bookings)+'</td>':'')+'</tr>').join(''));
 const details=campaignFilter?panel('Catatan Terhubung','Klik catatan untuk melihat detail dari modul asal.',table(['Aktivitas','Modul','Status'],rows.flatMap(r=>r.linked).map(r=>'<tr><td><button class="rowbtn" data-edit="'+esc(r.id)+'" data-module="'+esc(r.module)+'">'+esc(r.name)+'</button></td><td>'+esc(mod(r.module)[1])+'</td><td>'+pill(r.status)+'</td></tr>').join('')||'<tr><td colspan="3">Belum ada catatan di periode ini.</td></tr>')):'';
 return heading(analysis?'Analisis Kinerja':'Pelaporan','Evaluasi campaign dengan data aktivitas, pipeline, dan iklan yang terhubung.',allowed(mod('leads'))?button('Dashboard Leads',nav('leads'),'people'):'')+'<div class="list">'+panel('Rekap Campaign',fmt(from)+' – '+fmt(to),filters+body)+details+'</div>';
}
function settings(){
 return heading('Pengaturan Modul','Aktifkan modul atau tambah modul sesuai kebutuhan organisasi.',button('Tambah modul','data-action="module"','plus',true))+panel('Modul Organisasi','Atur visibilitas menu untuk '+org().name+'.',[...modules,...data().custom].filter(m=>m[0]!=='overview'&&m[0]!=='settings').map(m=>'<div class="settings-row"><div><strong>'+esc(m[1])+'</strong><div class="sub">'+esc(m[3])+'</div></div><label><input type="checkbox" data-toggle-module="'+esc(m[0])+'" '+(!data().disabled.includes(m[0])?'checked':'')+'> Aktif</label></div>').join(''));
}
const modal=document.querySelector('#modal');
const operations=createOperations({allowed,mod,records,data,heading,panel,button,table,label,input,select,options,esc,fmt,show,form,render,
  today:currentDate,unique,campaigns,statuses,stages,
  modules:()=>['leads','promo','social','pipeline',...planIds.filter(id=>!['promo','social'].includes(id)),...data().custom.map(m=>m[0])]
});
function show(title,body){
 modal.classList.remove('lead-dialog');
 modal.innerHTML='<div class="modalhead"><h2 id="modal-title">'+esc(title)+'</h2><button type="button" class="iconbtn" aria-label="Tutup" data-action="close">'+icon('close')+'</button></div>'+body+'<p id="cloudError" role="alert"></p>';
 if(!modal.open) modal.showModal();
}
function form(kind,fields,submit='Simpan',meta=''){
 return '<form class="form" data-form="'+kind+'" '+meta+'>'+fields+'<div class="actions">'+button('Batal','data-action="close"')+'<button class="btn primary">'+esc(submit)+'</button></div></form>';
}
function label(l,content){return '<label>'+esc(l)+content+'</label>'}
function input(name,val='',type='text',extra=''){return '<input name="'+name+'" type="'+type+'" value="'+esc(val)+'" '+extra+'>'}
function select(name,items,value,extra=''){return '<select name="'+name+'" '+extra+'>'+options(items,value)+'</select>'}
function edit(id,recordId){
 const m=mod(id);if(!allowed(m))return;
 const r=records(id).find(row=>row.id===recordId);
 if(recordId&&!r)return;
 if(id==='leads'){
  show(r?'Edit lead':'Tambah lead',form('record',leadForm(r),'Simpan','data-module="leads" data-id="'+esc(r?.id||'')+'"'));
  modal.classList.add('lead-dialog');
  return;
 }
 const activityName=id==='tasks'?'Nama tugas':'Nama catatan';
 const assigneeField=id==='tasks'?label('Nama PIC (opsional)',input('assignee',r?.owner,'text','maxlength="80"')):'';
 show((r?'Edit ':'Tambah ')+m[1],form('record',label(activityName,input('name',r?.name,'text','required maxlength="140"'))+assigneeField+label('Tanggal',input('date',r?.date||fixedDate,'date','required min="1900-01-01" max="2100-12-31"'))+label('Status',select('status',id==='pipeline'?stages:statuses,r?.status))+(id==='promo'?'':label('Campaign terkait',select('campaign',[['','Pilih campaign'],...Object.entries(campaigns())],r?.campaign||'')))+(id==='promo'?label('Objektif',input('objective',r?.objective,'text','maxlength="80"')):'')+label('Catatan / Tindak lanjut','<textarea name="note" maxlength="700">'+esc(r?.note)+'</textarea>'),'Simpan','data-module="'+esc(id)+'" data-id="'+esc(r?.id||'')+'"'));
}
function editAds(id){
 const a=data().ads.find(r=>r.id===id);
 show(a?'Edit kinerja iklan':'Tambah iklan',form('ads',label('Nama iklan',input('name',a?.name,'text','required maxlength="140"'))+label('Campaign terkait',select('campaign',[['','Pilih campaign'],...Object.entries(campaigns())],a?.campaign,'required'))+['budget','spend','leads','booking'].map((f,i)=>label(['Anggaran (Rp)','Realisasi (Rp)','Lead iklan','Booking'][i],input(f,a?.[f]??0,'number','required min="0" max="1000000000000" step="1"'))).join('')+'<p class="sub" id="ads-error" aria-live="polite"></p>','Simpan','data-id="'+esc(a?.id||'')+'"'));
}
function action(name){
 if(name==='menu'){document.querySelector('#sidebar').classList.toggle('open');return}
 if(name==='close'){modal.close();return}
 if(name==='org')workspaceSettings();
 if(name==='activity'){
  const choices=[...planIds,'pipeline','leads',...data().custom.map(m=>m[0])].filter(id=>allowed(mod(id))).map(id=>[id,mod(id)[1]]);
  show('Buat Aktivitas',choices.length?form('activity',label('Modul',select('module',choices,'')),'Lanjutkan'):'<p class="sub">Aktifkan modul aktivitas di pengaturan organisasi.</p>');
 }
 if(name==='new')edit(page);
 if(name==='newads')editAds();
 if(name==='module')show('Tambah Modul',form('module',label('Nama modul',input('name','','text','required maxlength="60"')),'Tambah modul'));
 if(name==='notifications')show('Notifikasi Email',form('email','<p class="sub">Simulasi pengingat tenggat tugas dan agenda. Preferensi ini tersimpan di Supabase. Pengiriman otomatis belum diaktifkan.</p>'+label('Email tujuan',input('email',data().email,'email','maxlength="140"'))+'<label class="check"><input type="checkbox" name="enabled" '+(data().emailOn?'checked':'')+'> Simpan preferensi pengingat email</label>','Simpan preferensi'));
}
function reset(){leadState={month:fixedDate.slice(0,7),campaign:'',view:'active'};period='Bulanan';chartType='out';calendarMonth=currentDate().slice(0,7);campaignFilter='';goto('overview')}
function unique(){return Date.now().toString(36)+Math.random().toString(36).slice(2,9)}
let currentUser, working=false;
const gate=document.querySelector('#account');
const shell=document.querySelector('.shell');
function accountView(mode){
  shell.hidden=true;
  gate.hidden=false;
  const email=label('Email',input('email',currentUser?.email,'email','required autocomplete="email"'));
  if(mode==='loading'){gate.innerHTML='<h1>HospitalOps</h1><p role="status">Memuat workspace…</p>';return}
  if(mode==='workspaces'){
    const entries=state.orgs.map(o=>button(o.name,'data-open-org="'+esc(o.id)+'"','brand')).join('');
    gate.innerHTML='<h1>Pilih organisasi</h1><p class="sub">'+esc(currentUser.email)+'</p>'+
      '<div class="actions">'+entries+button('Buat organisasi','data-account="create"','plus',true)+
      button('Akses organisasi tim','data-account="join"')+button('Keluar','data-account="logout"')+'</div>'+
      '<p class="sub">UID akun <code>'+esc(currentUser.uid)+'</code></p><p id="accountError" role="alert"></p>';
    return;
  }
  if(mode==='recovery'){
    gate.innerHTML='<h1>Kata sandi baru</h1>'+form('recovery',label('Kata sandi baru',input('password','','password','required minlength="6" autocomplete="new-password"')),'Perbarui kata sandi')+'<p id="accountError" role="alert"></p>';
    return;
  }
  const registerMode=mode==='register';
  const resetMode=mode==='password';
  const password=resetMode?'':label('Kata sandi',input('password','','password',
    'required minlength="6" autocomplete="'+(registerMode?'new-password':'current-password')+'"'));
  const title=registerMode?'Daftar akun':resetMode?'Reset kata sandi':'Masuk ke HospitalOps';
  gate.innerHTML='<h1>'+title+'</h1><p class="sub">Ruang kerja sales dan marketing rumah sakit.</p>'+
    '<form class="form" data-form="'+mode+'">'+email+password+
    '<p id="accountError" role="alert"></p><button class="btn primary">'+title+'</button></form>'+
    '<div class="actions">'+(mode==='login'?button('Daftar akun','data-account="register"')+
    button('Lupa kata sandi','data-account="password"'):button('Kembali ke login','data-account="login"'))+'</div>'+
    (mode==='login'?'<p class="sub">Masuk dengan akun Supabase. <a href="./firebase-legacy.html">Buka workspace Firebase lama</a> · <a href="./demo.html">Demo</a></p>':'');
}
function cloudError(err){
  const translations={
    'invalid_credentials':'Email atau kata sandi tidak cocok.',
    'user_already_exists':'Email sudah terdaftar. Silakan masuk.',
    'weak_password':'Gunakan minimal enam karakter untuk kata sandi.',
    'auth/network-request-failed':'Koneksi ke Supabase gagal. Coba lagi.',
    '42501':'Akses Supabase ditolak. Periksa keanggotaan organisasi dan aturan akses.',
    'unavailable':'Supabase tidak dapat dijangkau. Coba lagi saat online.',
    'email_not_confirmed':'Konfirmasikan email Anda sebelum masuk.',
    'signup_disabled':'Pendaftaran ditutup oleh pengaturan Supabase. Hubungi admin.' ,
    'hospitalops/conflict':err.message
  };
  const message=translations[err.code]||(!err.code?err.message:'Operasi Supabase gagal ('+err.code+').');
  const target=modal.open?modal.querySelector('#cloudError'):gate.querySelector('#accountError');
  if(target&&(!gate.hidden||modal.open)){target.textContent=message;return}
  if(shell.hidden){
    gate.innerHTML='<h1>HospitalOps</h1><p role="alert">'+esc(message)+'</p>'+
      button('Coba lagi','data-account="retry"')+button('Keluar','data-account="logout"');
  }else toast(message);
}
async function openOrganization(id){
  const user=currentUser;
  const loaded=await loadOrganization(id,user.uid);
  if(currentUser!==user)return;
  modal.close();
  state.org=id;
  state.workspace=loaded;
  gate.hidden=true;
  shell.hidden=false;
  reset();
}
async function refreshAccount(user){
  currentUser=user;
  state={org:null,orgs:[],workspace:null};
  modal.close();
  accountView(user?'loading':'login');
  if(!user)return;
  try{
    const organizations=await listOrganizations(user.uid);
    if(currentUser!==user)return;
    state.orgs=organizations;
    accountView('workspaces');
  }catch(error){if(currentUser===user)cloudError(error)}
}
function accountAction(action){
  if(action==='logout')return logout();
  if(action==='retry')return refreshAccount(currentUser);
  if(action==='create'){
    show('Buat organisasi',form('create-org',label('Nama organisasi / rumah sakit',input('name','','text','required maxlength="60"')),'Buat organisasi'));
    return;
  }
  if(action==='join'){
    show('Akses organisasi tim',form('join-org','<p class="sub">Minta pemilik organisasi menambahkan UID akun Anda sebelum memasukkan ID organisasi.</p>'+
      label('ID organisasi',input('id','','text','required pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"')),'Buka organisasi'));
    return;
  }
  accountView(action);
}
function workspaceSettings(){
  const org=state.workspace;
  const invite=org.role==='owner'?form('grant-manager',label('UID akun anggota',input('uid','','text','required pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"')),'Tambahkan Manager'):'';
  show('Organisasi', '<p><strong>'+esc(org.name)+'</strong></p><p class="sub">ID organisasi <code>'+esc(org.id)+'</code></p>'+
    '<p class="sub">UID akun <code>'+esc(currentUser.uid)+'</code></p>'+
    '<div class="actions">'+button('Pindah organisasi','data-account="choose"')+button('Keluar','data-account="logout"')+'</div>'+
    invite);
}
async function handleAccount(form,values){
  const kind=form.dataset.form;
  if(kind==='login')await login(values.email.trim(),values.password);
  if(kind==='register'){
    const result=await register(values.email.trim(),values.password);
    if(!result.session)document.querySelector('#accountError').textContent='Cek email untuk mengonfirmasi akun sebelum masuk.';
  }
  if(kind==='recovery'){
    await updatePassword(values.password);
    const clean=new URL(location.href);clean.searchParams.delete('recovery');clean.hash='';
    history.replaceState(null,'',clean);
    await logout();
  }
  if(kind==='password'){
    await resetPassword(values.email.trim());
    document.querySelector('#accountError').textContent='Jika email terdaftar, tautan reset akan dikirim.';
  }
  if(kind==='create-org'||kind==='join-org'){
    const user=currentUser;
    if(kind==='create-org'&&!values.name.trim())throw new Error('Isi nama organisasi.');
    const id=kind==='create-org'?await createOrganization(user.uid,values.name.trim()):values.id;
    if(kind==='join-org')await joinOrganization(user.uid,id);
    if(currentUser!==user)return;
    state.orgs=await listOrganizations(user.uid);
    if(currentUser===user)await openOrganization(id);
  }
  if(kind==='grant-manager'){
    await grantManager(state.org,values.uid.trim());
    modal.close();
    toast('Akses Manager diberikan.');
  }
}

document.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b||working)return;
 if(b.dataset.openOrg||b.dataset.account){
  working=true;
  try{
   if(b.dataset.openOrg)await openOrganization(b.dataset.openOrg);
   else if(b.dataset.account==='choose'){modal.close();state.workspace=null;accountView('workspaces')}
   else await accountAction(b.dataset.account);
  }catch(error){cloudError(error)}
  finally{working=false}
  return;
 }
 if(!state.workspace&&b.dataset.action!=='close')return;
 if(b.dataset.ops){operations.click(b.dataset);if(['import','detail'].includes(b.dataset.ops))modal.classList.add('lead-dialog');return}
 if(b.dataset.nav)goto(b.dataset.nav);
 if(b.dataset.action)action(b.dataset.action);
 if(b.dataset.edit)edit(b.dataset.module,b.dataset.edit);
 if(b.dataset.ads)editAds(b.dataset.ads);
 if(b.dataset.leadCost)editLeadCost(b.dataset.leadCost);
 if(b.dataset.leadView){
  leadState.view=b.dataset.leadView;
  leadState.campaign=b.dataset.leadCampaign;
  query='';
  render();
  document.querySelector('#leadList').focus();
 }
 if(b.dataset.chart){chartType=b.dataset.chart;render()}
 if(b.dataset.campaign){campaignFilter=b.dataset.campaign;render()}
 if(b.dataset.month){
  const [y,m]=calendarMonth.split('-').map(Number);
  calendarMonth=new Date(Date.UTC(y,m-1+Number(b.dataset.month),1)).toISOString().slice(0,7);render();
 }
});
document.addEventListener('input',e=>{
 if(e.target.id==='leadQuery'){
  query=e.target.value;
  document.querySelector('#leadResults').innerHTML=leadResults();
 }
 if(e.target.id==='query'){query=e.target.value;document.querySelector('#recordResults').innerHTML=recordResults()}
 if(e.target.name==='email'||e.target.name==='enabled'){
  const f=e.target.form;if(f?.dataset.form==='email')f.elements.email.required=f.elements.enabled.checked;
 }
});
document.addEventListener('change',async e=>{
 const t=e.target;
 if(await operations.change(t))return;
 if(t.id==='leadMonth'&&t.value&&t.validity.valid){
  leadState.month=t.value;
  render();document.querySelector('#leadMonth').focus();
 }
 if(t.id==='leadCampaign'){leadState.campaign=t.value;render();document.querySelector('#leadCampaign').focus()}
 if(t.id==='leadView'){leadState.view=t.value;document.querySelector('#leadResults').innerHTML=leadResults()}
 if(t.id==='period'){period=t.value;render();document.querySelector('#period')?.focus()}
 if(t.id==='campaignFilter'){campaignFilter=t.value;render();document.querySelector('#campaignFilter')?.focus()}
 if(t.id==='statusFilter'){statusFilter=t.value;document.querySelector('#recordResults').innerHTML=recordResults()}
 if(t.dataset.patientFilter){patientFilters[t.dataset.patientFilter]=t.value;render();document.querySelector('[data-patient-filter="'+t.dataset.patientFilter+'"]')?.focus()}
 if(t.dataset.toggleModule&&state.workspace){
  if(working){t.checked=!t.checked;return}
  const workspace=state.workspace,before=structuredClone(data()),id=t.dataset.toggleModule;
  data().disabled=t.checked?data().disabled.filter(x=>x!==id):[...data().disabled,id];
  working=true;
  try{await saveChanges(workspace,before);toast(t.checked?'Modul diaktifkan.':'Modul dinonaktifkan.')}
  catch(error){workspace.data=before;cloudError(error)}
  finally{working=false;if(state.workspace===workspace){render();document.querySelector('[data-toggle-module="'+id+'"]')?.focus()}}
 }
});
document.addEventListener('submit',async e=>{
 const f=e.target,kind=f.dataset.form;if(!kind)return;e.preventDefault();
 if(working)return;
 const v=Object.fromEntries(new FormData(f));
 if(['login','register','password','recovery','create-org','join-org','grant-manager'].includes(kind)){
  working=true;
  try{await handleAccount(f,v)}catch(error){cloudError(error)}finally{working=false}
  return;
 }
 const workspace=state.workspace;
 if(!workspace)return;
 const before=structuredClone(data());
 if(kind==='activity'){edit(v.module);return}
 if(['ops-pks','ops-import'].includes(kind)){
  working=true;
  const submit=f.querySelector('button.primary');submit.disabled=true;
  try{
   const result=operations.mutate(f,v);
   await saveChanges(workspace,before);
   if(state.workspace!==workspace)return;
   modal.close();goto(result.page);toast(result.message);
  }catch(error){workspace.data=before;if(state.workspace===workspace)cloudError(error)}
  finally{working=false;submit.disabled=false}
  return;
 }
 if((['record','module','ads'].includes(kind))&&!v.name.trim()){
  f.elements.name.setCustomValidity('Isi nama.');f.elements.name.reportValidity();
  f.elements.name.addEventListener('input',()=>f.elements.name.setCustomValidity(''),{once:true});return;
 }
 let newModule;
 if(kind==='module'){
  newModule='custom-'+unique();data().custom.push([newModule,v.name.trim(),'content','Modul Tambahan']);
 }
 if(kind==='email'){
  if(v.enabled&&!v.email){f.elements.email.required=true;f.elements.email.reportValidity();return}
  data().email=v.email.trim();data().emailOn=Boolean(v.enabled);
 }
 if(kind==='record'){
  const id=f.dataset.module;if(!allowed(mod(id)))return;
  const rows=records(id);
  const existing=rows.find(row=>row.id===f.dataset.id);
  const {assignee,...values}=v;
  const owner=assignee?.trim()||existing?.owner||previewRole;
  const r={id:existing?.id||unique(),...values,name:v.name.trim(),owner};
  if(id==='promo')r.campaign=existing?.campaign||r.id;
  if(id==='leads')r.billing=v.billing?Number(v.billing):null;
  data().records[id]=existing?rows.map(row=>row.id===r.id?r:row):[...rows,r];
 }
 if(kind==='leadcost'){
  if(!allowed(mod('leads'))||!Object.hasOwn(campaigns(),f.dataset.id))return;
  const costs=data().leadCosts??={};
  const monthCosts=costs[f.dataset.month]??={};
  if(v.cost==='')delete monthCosts[f.dataset.id];
  else monthCosts[f.dataset.id]=Number(v.cost);
 }
 if(kind==='ads'){
  const a={id:f.dataset.id||unique(),...v,name:v.name.trim()};
  for(const k of ['budget','spend','leads','booking'])a[k]=Number(a[k]);
  if(a.booking>a.leads){document.querySelector('#ads-error').textContent='Jumlah booking tidak boleh melebihi jumlah lead iklan.';return}
  data().ads=f.dataset.id?data().ads.map(x=>x.id===a.id?a:x):[...data().ads,a];
 }
 working=true;
 f.querySelector('button[type="submit"],button.primary').disabled=true;
 try{
  await saveChanges(workspace,before);
  if(state.workspace!==workspace)return;
  modal.close();
  if(newModule)goto(newModule);
  else render();
  toast('Perubahan tersimpan.');
 }catch(error){workspace.data=before;if(state.workspace===workspace)cloudError(error)}
 finally{working=false;f.querySelector('button[type="submit"],button.primary').disabled=false}
});
accountView('loading');
watchUser(refreshAccount,cloudError,()=>accountView('recovery'));
