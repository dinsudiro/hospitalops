importScripts('./sheetjs-0.20.3.js');
self.onmessage=event=>{
 try{
  const prefix=new TextDecoder().decode(new Uint8Array(event.data,0,Math.min(event.data.byteLength,16384)));
  if(/<frameset\b/i.test(prefix))throw Error('File ini hanya halaman penghubung Excel dan datanya berada di folder pendamping. Buka di Excel lalu Save As Excel Workbook (.xlsx), atau unduh ulang laporan asli dari SIMRS.');
  // Keep Excel dates as serials: converting to Date can shift the day by timezone.
  const book=XLSX.read(event.data,{type:'array',cellDates:false,cellNF:true,raw:true,codepage:65001});
  const sections=book.SheetNames.map(name=>{
   const sheet=book.Sheets[name],rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:true,blankrows:false});
   const norm=v=>String(v??'').toLowerCase().replace(/[^a-z0-9]/g,'');
   const header=rows.find(row=>row.some(v=>['norm','norekammedis'].includes(norm(v)))&&row.some(v=>norm(v)==='namapasien'));
   const warnings=[];
   if(header){
    const identifiers=header.flatMap((v,i)=>['norm','norekammedis','noreg','noregistrasi','nosep','nopegawainopolis'].includes(norm(v))?[i]:[]);
    const bounds=XLSX.utils.decode_range(sheet['!ref']||'A1');let dateIdentifiers=0;
    for(let r=bounds.s.r;r<=bounds.e.r;r++)for(const c of identifiers){
     const cell=sheet[XLSX.utils.encode_cell({r,c:bounds.s.c+c})];
     if(cell?.t==='n'){
      if(XLSX.SSF.is_date(cell.z||''))dateIdentifiers++;
      cell.v=cell.w??XLSX.utils.format_cell(cell);cell.t='s';cell.z='@';
     }
    }
    if(dateIdentifiers)warnings.push(dateIdentifiers+' sel nomor identitas di file sumber sudah berformat tanggal Excel. Teks tampilan Excel dipertahankan; periksa No. RM / nomor identitas tersebut pada sumber.');
    // sheet_to_json also converts numeric date cells when a date format is retained.
    for(const address of Object.keys(sheet)){const cell=sheet[address];if(cell?.t==='n'&&XLSX.SSF.is_date(cell.z||''))cell.z='General';}
    const corrected=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:true,blankrows:false});
    if(book.Workbook?.WBProps?.date1904){for(const row of corrected)for(let c=0;c<header.length;c++)if(['tanggalmasuk','tglmasuk','tanggalkeluar','tglkeluar'].includes(norm(header[c]))&&typeof row[c]==='number')row[c]+=1462;}
    return {name,rows:corrected,warnings};
   }
   return {name,rows,warnings};
  });
  self.postMessage({sections});
 }catch(error){self.postMessage({error:error.message||'File Excel belum dapat dibaca.'})}
};
