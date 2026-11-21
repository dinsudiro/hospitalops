importScripts('./sheetjs-0.20.3.js');
self.onmessage=event=>{
 try{
  const book=XLSX.read(event.data,{type:'array',cellDates:true,raw:true,codepage:65001});
  const sections=book.SheetNames.map(name=>({name,rows:XLSX.utils.sheet_to_json(book.Sheets[name],{header:1,defval:'',raw:true,blankrows:false})}));
  self.postMessage({sections});
 }catch(error){self.postMessage({error:error.message||'File Excel belum dapat dibaca.'})}
};
