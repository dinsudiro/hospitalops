import {patientExtraModules} from './hospitalops-patient-fields.js?v=20261125-fielddelete1';
// Keep large patient reports out of localStorage's small synchronous quota.
const databaseName='hospitalops-demo-patient-data';
async function connect(){
 if(!globalThis.indexedDB)throw Error('Penyimpanan data pasien tidak tersedia di browser ini.');
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(databaseName,1);
  request.onupgradeneeded=()=>request.result.createObjectStore('organizations');
  request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result)};
  request.onerror=()=>reject(Error('Penyimpanan data pasien tidak dapat dibuka. Periksa izin penyimpanan situs.'));
  request.onblocked=()=>reject(Error('Tutup tab HospitalOps lain lalu coba kembali.'));
 });
}
async function transaction(orgId,mode,value){
 if(!orgId)throw Error('Organisasi demo belum dipilih.');
 const db=await connect();
 try{
  return await new Promise((resolve,reject)=>{
   const tx=db.transaction('organizations',mode),store=tx.objectStore('organizations');
   const request=mode==='readonly'?store.get(orgId):store.put(value,orgId);
   tx.oncomplete=()=>resolve(mode==='readonly'?request.result:undefined);
   tx.onabort=()=>reject(Error(tx.error?.name==='QuotaExceededError'?'Ruang penyimpanan browser penuh. Data pasien sebelumnya tetap tersimpan.':'Data pasien gagal disimpan atau dibaca. Periksa izin penyimpanan situs lalu coba kembali.'));
   tx.onerror=()=>{};
  });
 }finally{db.close()}
}
export async function restoreDemoPatients(orgId,data){
 const stored=await transaction(orgId,'readonly');
 if(!stored)return;
 if(stored.version!==1||!Array.isArray(stored.buckets)||!Array.isArray(stored.imports))throw Error('Data pasien tersimpan tidak dapat dibaca. Unggahan baru ditunda agar data lama tetap aman.');
 data.records??={};
 data.records['patient-buckets']=stored.buckets;
 data.records['patient-imports']=stored.imports;
 for(const name of patientExtraModules)if(Array.isArray(stored.extra?.[name]))data.records[name]=stored.extra[name];
}
export async function saveDemoPatients(orgId,data){
 await transaction(orgId,'readwrite',{version:1,buckets:data.records['patient-buckets']||[],imports:data.records['patient-imports']||[],extra:Object.fromEntries(patientExtraModules.map(name=>[name,data.records[name]||[]])),savedAt:new Date().toISOString()});
}
