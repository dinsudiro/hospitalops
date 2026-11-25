importScripts('./sheetjs-0.20.3.js');
self.onmessage=event=>{
 try{
  const prefix=new TextDecoder().decode(new Uint8Array(event.data,0,Math.min(event.data.byteLength,16384)));
  if(/<frameset\b/i.test(prefix))throw Error('File ini hanya halaman penghubung Excel dan datanya berada di folder pendamping. Buka di Excel lalu Save As Excel Workbook (.xlsx), atau unduh ulang laporan asli dari SIMRS.');
  // Keep Excel dates as serials: converting to Date can shift the day by timezone.
  const book=XLSX.read(event.data,{type:'array',cellDates:false,cellNF:true,raw:true,codepage:65001});
  const sections=book.SheetNames.map(name=>{
   const sheet=book.Sheets[name],rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:true,blankrows:true});
   const norm=v=>String(v??'').toLowerCase().replace(/[^a-z0-9]/g,'');
   const header=rows.find(row=>row.some(v=>['norm','norekammedis','medicalrecord','medicalrecordnumber','mrn','noreg','noregistrasi','encounterid'].includes(norm(v)))&&row.some(v=>['namapasien','patientname','nama'].includes(norm(v))));
   const warnings=[],boundsAll=XLSX.utils.decode_range(sheet['!ref']||'A1'),cellText={};
   for(const address of Object.keys(sheet)){const c=sheet[address];if(c?.t!=='n'||c.w===undefined||!XLSX.SSF.is_date(c.z||'')&&!/^0\d+$/.test(c.w))continue;const p=XLSX.utils.decode_cell(address),r=p.r-boundsAll.s.r,col=p.c-boundsAll.s.c;(cellText[r]??={})[col]=c.w;}
   if(header){
    const identifiers=header.flatMap((v,i)=>['norm','norekammedis','medicalrecord','medicalrecordnumber','mrn','noreg','noregistrasi','encounterid','visitid','nosep','nopegawainopolis'].includes(norm(v))?[i]:[]);
    const bounds=XLSX.utils.decode_range(sheet['!ref']||'A1');let dateIdentifiers=0;
    for(let r=bounds.s.r;r<=bounds.e.r;r++)for(const c of identifiers){
     const cell=sheet[XLSX.utils.encode_cell({r,c:bounds.s.c+c})];
     if(cell?.t==='n'){
      if(XLSX.SSF.is_date(cell.z||''))dateIdentifiers++;
      cell.v=XLSX.SSF.is_date(cell.z||'')?cell.w??XLSX.utils.format_cell(cell):/^0\d+$/.test(cell.w||'')?cell.w:String(cell.v);cell.t='s';cell.z='@';
     }
    }
    if(dateIdentifiers)warnings.push(dateIdentifiers+' sel nomor identitas di file sumber sudah berformat tanggal Excel. Teks tampilan Excel dipertahankan; periksa No. RM / nomor identitas tersebut pada sumber.');
    // sheet_to_json also converts numeric date cells when a date format is retained.
    for(const address of Object.keys(sheet)){const cell=sheet[address];if(cell&&XLSX.SSF.is_date(cell.z||''))cell.z='General';}
    const corrected=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:true,blankrows:true});
    if(book.Workbook?.WBProps?.date1904){for(const row of corrected)for(let c=0;c<header.length;c++)if(['tanggalmasuk','tglmasuk','tanggalkeluar','tglkeluar'].includes(norm(header[c]))&&typeof row[c]==='number')row[c]+=1462;}
    return {name,rows:corrected,warnings,cellText,rowOffset:boundsAll.s.r};
   }
   for(const address of Object.keys(sheet)){const cell=sheet[address];if(cell&&XLSX.SSF.is_date(cell.z||''))cell.z='General';}
   return {name,rows:XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:true,blankrows:true}),warnings,cellText,rowOffset:boundsAll.s.r};
  });
  self.postMessage({sections});
 }catch(error){self.postMessage({error:error.message||'File Excel belum dapat dibaca.'})}
};
