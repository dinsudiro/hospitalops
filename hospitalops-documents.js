import {parseDate} from './hospitalops-import.js';
const months={januari:1,jan:1,februari:2,feb:2,maret:3,mar:3,april:4,apr:4,mei:5,juni:6,jun:6,juli:7,jul:7,agustus:8,agu:8,agt:8,september:9,sep:9,oktober:10,okt:10,november:11,nov:11,nop:11,desember:12,des:12};
export function documentDate(value){
 const text=String(value||'').trim(),direct=parseDate(text);if(direct)return direct;
 const m=text.match(/\b(\d{1,2})\s+([a-z]+)\s+(\d{4})\b/i);
 return m&&months[m[2].toLowerCase()]?parseDate(m[3]+'-'+months[m[2].toLowerCase()]+'-'+m[1]):'';
}
export function extractDocumentFields(text,kind='agreement'){
 if(!String(text||'').trim())return {};
 const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
 const labeled=(aliases)=>{
  for(const [i,line] of lines.entries()){const match=line.match(/^\s*([^:]{2,70})\s*:\s*(.*)$/);if(match&&aliases.some(a=>a.test(match[1].trim())))return match[2].trim()||(!lines[i+1]?.includes(':')?lines[i+1]||'':'');if(aliases.some(a=>a.test(line))&&!lines[i+1]?.includes(':'))return lines[i+1]||''}
  return '';
 };
 const number=(labeled([/^(nomor|no\.?)\s*(dokumen|surat|perjanjian)?$/i])||lines.map(l=>l.match(/^nomor\s+([^:]+)$/i)?.[1]).find(Boolean)||'').slice(0,100);
 if(kind==='disposition')return {number,name:labeled([/^(perihal|tentang|hal|judul surat)$/i]).slice(0,180),sender:labeled([/^(pengirim|asal surat|dari)$/i]).slice(0,180),date:documentDate(labeled([/^(tanggal surat|tanggal|tgl)$/i])),summary:labeled([/^(ringkasan|isi surat|isi disposisi|instruksi|arahan)$/i]).slice(0,2000),deadline:documentDate(labeled([/^(deadline|tenggat|batas waktu|tanggal batas waktu)$/i]))};
 let name=labeled([/^(judul|judul perjanjian|tentang|perihal)$/i]);
 if(!name)name=lines.map(l=>l.match(/^tentang\s+(.+)$/i)?.[1]).find(Boolean)||'';
 if(!name){const i=lines.findIndex(l=>/^tentang\s*$/i.test(l));if(i>=0)name=lines[i+1]||''}
 const values={type:/\bMoU\b|memorandum of understanding/i.test(text)?'MoU':'PKS',number,name:name.slice(0,140),partner:labeled([/^(nama mitra|mitra|pihak kedua|nama pihak kedua)$/i]).slice(0,140),scope:labeled([/^(ruang lingkup|lingkup kerja sama|ruang lingkup kerja sama)$/i]).slice(0,700),start:documentDate(labeled([/^(tanggal mulai|mulai berlaku|berlaku sejak|tanggal efektif)$/i])),end:documentDate(labeled([/^(tanggal berakhir|berakhir|berlaku sampai|akhir masa berlaku)$/i]))};
 const range=text.match(/(?:berlaku|jangka waktu)[\s\S]{0,100}?(\d{1,2}\s+[a-z]+\s+\d{4}|\d{1,2}[./-]\d{1,2}[./-]\d{4})\s*(?:sampai(?: dengan)?|hingga|s\.?d\.?|–|—|-)\s*(\d{1,2}\s+[a-z]+\s+\d{4}|\d{1,2}[./-]\d{1,2}[./-]\d{4})/i);
 if(range){values.start||=documentDate(range[1]);values.end||=documentDate(range[2])}
 return values;
}
const scriptCache=new Map();
async function script(url,name){
 if(window[name])return window[name];
 if(!scriptCache.has(url))scriptCache.set(url,new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.onload=()=>resolve(window[name]);s.onerror=()=>{scriptCache.delete(url);reject(Error('Pembaca dokumen gagal dimuat.'))};document.head.append(s)}));
 return scriptCache.get(url);
}
export async function extractDocumentText(file){
 if(!file?.size||file.size>10*1024*1024)throw Error('Pilih dokumen PDF, DOCX, atau TXT maksimal 10 MB.');
 const ext=file.name.split('.').pop().toLowerCase();
 if(!['pdf','docx','txt'].includes(ext))throw Error('Gunakan PDF, Word .docx, atau TXT. Simpan Word .doc sebagai .docx terlebih dahulu.');
 if(ext==='txt')return (await file.text()).slice(0,200000);
 if(ext==='docx'){const mammoth=await script('./mammoth-1.13.0.js','mammoth');return (await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()})).value.slice(0,200000)}
 const pdf=await import('./pdfjs-5.4.624.mjs');pdf.GlobalWorkerOptions.workerSrc=new URL('./pdfjs-worker-5.4.624.mjs',import.meta.url).href;
 const loader=pdf.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false});
 try{
  const doc=await loader.promise;if(doc.numPages>50)throw Error('Maksimal 50 halaman per PDF.');
  const lines=[];
  for(let n=1;n<=doc.numPages;n++){
   const content=await(await doc.getPage(n)).getTextContent(),groups=new Map();
   for(const item of content.items){if(!item.str?.trim()||!item.transform)continue;const y=Math.round(item.transform[5]/2)*2;if(!groups.has(y))groups.set(y,[]);groups.get(y).push(item)}
   lines.push(...[...groups].sort(([a],[b])=>b-a).map(([,items])=>items.sort((a,b)=>a.transform[4]-b.transform[4]).map(i=>i.str).join(' ')));
  }
  return lines.join('\n').slice(0,200000);
 }finally{await loader.destroy()}
}
async function documentDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open('hospitalops-document-files',1);r.onupgradeneeded=()=>r.result.createObjectStore('files');r.onsuccess=()=>{r.result.onversionchange=()=>r.result.close();resolve(r.result)};r.onerror=()=>reject(Error('Penyimpanan dokumen tidak tersedia di browser ini.'));r.onblocked=()=>reject(Error('Tutup tab HospitalOps lain lalu coba kembali.'))})}
export async function storeDocument(scope,file,id){
 if(!scope)throw Error('Organisasi belum dipilih.');const db=await documentDB();
 try{await new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put(file,scope+':'+id);tx.oncomplete=resolve;tx.onabort=()=>reject(Error('Berkas gagal disimpan. Periksa ruang penyimpanan browser.'))})}finally{db.close()}
 return {id,name:file.name,size:file.size,type:file.type,storedAt:new Date().toISOString()};
}
export async function openDocument(scope,attachment){
 const db=await documentDB();let file;
 try{file=await new Promise((resolve,reject)=>{const tx=db.transaction('files','readonly'),r=tx.objectStore('files').get(scope+':'+attachment.id);tx.oncomplete=()=>resolve(r.result);tx.onabort=()=>reject(Error('Berkas gagal dibaca.'))})}finally{db.close()}
 if(!file)throw Error('Berkas ini tersimpan di browser/perangkat saat diunggah. Buka dari perangkat tersebut atau unggah kembali.');
 const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=attachment.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
export function createDocumentUpload(ui){
 let session=null;
 return {
  controls(attachment){session={scope:ui.documentScope(),file:null,token:0,busy:false,existing:attachment};return '<section class="ops-version">'+ui.label('Upload dokumen','<input id="source-document" type="file" accept=".pdf,.docx,.txt">')+'<p class="sub">PDF teks, Word DOCX, atau TXT · maksimal 10 MB / 50 halaman. Hasil ekstraksi perlu diperiksa sebelum disimpan. PDF scan tetap dapat dilampirkan; isian diisi manual.</p><p class="sub">Berkas tersimpan di browser/perangkat ini. '+(attachment?'Lampiran saat ini: '+ui.esc(attachment.name):'')+'</p><div id="document-extraction" role="status"></div></section>'},
  async change(target,kind){
   if(target.id!=='source-document')return false;
   const form=target.form,area=form.querySelector('#document-extraction'),current=session,token=++current.token,file=target.files?.[0];current.file=null;if(!file){area.textContent='Tidak ada dokumen baru dipilih.';return true}
   const submit=form.querySelector('button.primary');submit.disabled=true;current.busy=true;area.textContent='Membaca dokumen…';
   try{
    if(!file.size||file.size>10*1024*1024||! /\.(pdf|docx|txt)$/i.test(file.name))throw Error('Gunakan PDF, DOCX, atau TXT maksimal 10 MB.');
    let text='',warning='';try{text=await extractDocumentText(file)}catch(error){warning=error.message}
    if(current!==session||token!==current.token||!form.isConnected||current.scope!==ui.documentScope())return true;
    current.file=file;
    const values=extractDocumentFields(text,kind);let filled=0;
    for(const [name,value] of Object.entries(values)){const field=form.elements.namedItem(name);if(value&&field&&!field.dataset.edited){field.value=value;filled++;if(kind==='disposition'&&name==='deadline')!form.elements.hasDeadline.dataset.edited&&(form.elements.hasDeadline.value='yes')}}
    area.innerHTML='<p>'+ui.esc(file.name)+' · '+filled+' isian terisi. Periksa dan koreksi sebelum menyimpan.</p>'+(!text.trim()?'<p role="alert">'+ui.esc(warning||'Tidak ada teks yang terbaca. Isi kolom secara manual; berkas tetap akan dilampirkan.')+'</p>':'')+'<details><summary>Teks dokumen yang terbaca</summary><pre class="document-text">'+ui.esc(text)+'</pre></details>';
   }catch(error){if(form.isConnected)area.textContent=error.message}
   finally{if(current===session&&token===current.token){current.busy=false;if(form.isConnected)submit.disabled=false}}
   return true;
  },
  async save(existing){if(!session||session.scope!==ui.documentScope())throw Error('Organisasi berubah. Buka ulang formulir.');if(session.busy)throw Error('Tunggu pembacaan dokumen selesai.');return session.file?storeDocument(session.scope,session.file,ui.unique()):existing},
  changed:()=>!!session?.file,
  open:attachment=>openDocument(ui.documentScope(),attachment)
 };
}
