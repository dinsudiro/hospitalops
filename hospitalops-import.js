const MAX_FILE=10*1024*1024;
const loadCache=new Map();
function script(url,global) {
 if(window[global])return Promise.resolve(window[global]);
 if(!loadCache.has(url)){
  const loaded=new Promise((resolve,reject)=>{
   const tag=document.createElement('script');
   tag.src=url;tag.onload=()=>window[global]?resolve(window[global]):reject(new Error('Pembaca file gagal dimuat.'));
   tag.onerror=()=>reject(new Error('Pembaca file gagal dimuat.'));
   document.head.append(tag);
  }).catch(error=>{loadCache.delete(url);throw error});
  loadCache.set(url,loaded);
 }
 return loadCache.get(url);
}
const str=x=>x instanceof Date?x.toISOString().slice(0,10):String(x??'').trim();
export const norm=x=>str(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const compact=rows=>rows.filter(row=>row.some(x=>str(x)!==''));
function labeled(lines) {
 const fields=new Map(), records=[];
 let entry=new Map();
 for(const line of lines){
  const pair=line.match(/^([^:]{2,80}):\s*(.+)$/);
  if(!pair)continue;
  const name=norm(pair[1]);if(!name)continue;
  if(entry.has(name)){records.push(entry);entry=new Map()}
  fields.set(name,pair[1].trim());entry.set(name,pair[2].trim());
 }
 if(entry.size)records.push(entry);
 return records.length?[{name:'Teks berlabel',rows:[[...fields.values()],...records.map(row=>[...fields.keys()].map(col=>row.get(col)||''))]}]:[];
}
export async function readDocument(file,{sheets,maxSize=MAX_FILE}={}) {
 if(!file?.size||file.size>maxSize)throw new Error('Pilih file yang berisi data, dengan ukuran maksimal '+maxSize/1024/1024+' MB.');
 const kind=file.name.split('.').pop().toLowerCase();
 if(['xlsx','xls','csv'].includes(kind)){
  const lib=await script('./sheetjs-0.20.3.js','XLSX');
  const book=lib.read(await file.arrayBuffer(),{cellDates:true,raw:true,codepage:65001,...(sheets?{sheets}:{})});
  return book.SheetNames.filter(name=>book.Sheets[name]).map(name=>({name,rows:compact(lib.utils.sheet_to_json(book.Sheets[name],{header:1,defval:'',raw:true}))}));
 }
 if(kind==='docx'){
  const lib=await script('./mammoth-1.13.0.js','mammoth');
  const result=await lib.convertToHtml({arrayBuffer:await file.arrayBuffer()},{convertImage:lib.images.imgElement(()=>Promise.resolve({}))});
  const template=document.createElement('template');template.innerHTML=result.value;
  const tables=[...template.content.querySelectorAll('table')].map((t,i)=>({name:'Tabel '+(i+1),rows:compact([...t.rows].map(r=>[...r.cells].map(c=>c.textContent.trim())))}));
  return tables.length?tables:labeled([...template.content.querySelectorAll('p,li')].map(p=>p.textContent.trim()));
 }
 if(kind==='pdf'){
  const lib=await import('./pdfjs-5.4.624.mjs');
  lib.GlobalWorkerOptions.workerSrc=new URL('./pdfjs-worker-5.4.624.mjs',import.meta.url).href;
  const loader=lib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false});
  try{
   const doc=await loader.promise;
   if(doc.numPages>50)throw new Error('Maksimal 50 halaman per PDF.');
   const sections=[],all=[];
   for(let page=1;page<=doc.numPages;page++){
    const content=await (await doc.getPage(page)).getTextContent();
    const groups=new Map();
    for(const item of content.items){
     if(!item.str?.trim()||!item.transform)continue;
     const key=Math.round(item.transform[5]/2)*2;
     if(!groups.has(key))groups.set(key,[]);
     groups.get(key).push(item);
    }
    const lines=[...groups].sort(([a],[b])=>b-a).map(([,items])=>{
     const cells=[];let end=-Infinity;
     for(const item of items.sort((a,b)=>a.transform[4]-b.transform[4])){
      const x=item.transform[4];
      if(cells.length&&x-end<9)cells[cells.length-1]+=' '+item.str.trim();
      else cells.push(item.str.trim());
      end=x+item.width;
     }
     return cells;
    });
    all.push(...lines.map(l=>l.join(' ')));
    const table=lines.filter(r=>r.length>1);
    if(table.length>1)sections.push({name:'Tabel halaman '+page,rows:table});
   }
   if(!all.length)throw new Error('PDF hasil scan memerlukan OCR terlebih dahulu.');
   return [...sections,...labeled(all)];
  }finally{await loader.destroy()}
 }
 throw new Error('Format tersedia: XLSX, XLS, CSV, DOCX, dan PDF teks. Simpan Word .doc lama sebagai .docx.');
}
export function parseDate(value) {
 const s=str(value), iso=s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/), dmy=s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
 const parts=iso?.slice(1)??(dmy&&[dmy[3],dmy[2],dmy[1]]);
 if(!parts)return '';
 const [y,m,d]=parts.map(Number), check=new Date(Date.UTC(y,m-1,d));
 return y>=1900&&y<=2100&&check.getUTCFullYear()===y&&check.getUTCMonth()+1===m&&check.getUTCDate()===d?check.toISOString().slice(0,10):'';
}
const fields=(...values)=>values;
export const fieldsFor=module=>fields(
 ['name',module==='leads'?'Nama lead':'Nama / judul','nama|nama pasien|lead name|judul|judul konten|nama campaign|nama prospek'],
 ['date',module==='leads'?'Tanggal event':'Tanggal kegiatan','tanggal|tgl|tgl event|tanggal lead masuk|tanggal tayang|jadwal|tanggal publikasi'],
 ['status',module==='leads'?'Funnel':'Status','status|tahap|funnel'],
 ...(module==='promo'?[['objective','Objektif','tujuan']]:[['campaign','Campaign','nama campaign|campaign name|kampanye|campaign terkait']]),
 ...(module==='leads'?[
  ['phone','Nomor telepon','no telepon|no telphone|no hp|wa|whatsapp'],['channel','Channel',''],['source','Source','sumber'],['segment','Segmen','segment'],
  ['followUpDate','Tanggal follow-up','tgl fu|tanggal fu|tgl follow up'],['followUpResult','Hasil follow-up','hasil fu'],['visitDate','Tanggal visit awal','visit awal'],
  ['treatmentDate','Tanggal tindakan','tgl tindakan'],['controlDate','Rencana tanggal kontrol',''],['treatmentPlan','Rencana tindakan',''],
  ['followUp1','FU 1',''],['followUp2','FU 2',''],['followUp3','FU 3','fu 3 setelah kunjungan'],['billing','Billing','total tagihan|tagihan|sales']
 ]:[]),
 ['note','Catatan','keterangan|notes']);
export function guess(fields,header){return Object.fromEntries(fields.map(([id,label,aliases])=>[id,header.findIndex(v=>[id,label,...aliases.split('|')].map(norm).includes(norm(v))&&norm(v))]));}
export function prepareRows({module,rows,fields,mapping,campaigns,existing,statuses}) {
 const signature=r=>JSON.stringify((module==='promo'?['name']:['name','date','campaign',...(module==='leads'?['phone']:[])]).map(k=>norm(r[k])));
 const known=new Set(existing.map(signature));
 return rows.map((raw,index)=>{
  const item={},issues=[];
  for(const [key,label] of fields){
   const value=str(raw[mapping[key]]);
   if(!value){if(['name','date'].includes(key))issues.push(label+' wajib diisi');continue}
   if(key==='date'||key.endsWith('Date')){
    item[key]=parseDate(value);
    if(!item[key])issues.push(label+' tidak valid');
   }else if(key==='billing'){
    const number=value.replace(/^rp\.?\s*/i,'').replace(/\s/g,'');
    const clean=/^\d{1,3}(\.\d{3})+(,00)?$/.test(number)?number.split(',')[0].replaceAll('.',''):number;
    if(!/^\d+$/.test(clean)||Number(clean)>1e12)issues.push('Billing harus berupa rupiah bulat');
    else item.billing=Number(clean);
   }else if(key==='campaign'){
    const matching=Object.entries(campaigns).filter(([id,name])=>id===value||norm(name)===norm(value));
    if(matching.length!==1)issues.push('Nama campaign belum ada atau ganda');
    else item.campaign=matching[0][0];
   }else{
    item[key]=value;
    if(value.length>(key==='name'?140:['note','followUpResult','treatmentPlan','followUp1','followUp2','followUp3'].includes(key)?700:80))issues.push(label+' terlalu panjang');
   }
  }
  if(module==='leads'){item.billing??=null;item.status??='Lead baru'}
  else if(item.status){const match=statuses.find(value=>norm(value)===norm(item.status));if(match)item.status=match;else issues.push('Status harus '+statuses.join(', '))}
  else item.status=statuses[0];
  if(!issues.length){const k=signature(item);if(known.has(k))issues.push('Duplikat');else known.add(k)}
  return {item,index,issues};
 });
}
