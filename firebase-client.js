import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js';
import {
  createUserWithEmailAndPassword, getAuth, onAuthStateChanged, sendPasswordResetEmail,
  signInWithEmailAndPassword, signOut
} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js';
import {
  collection, doc, getDocFromServer, getDocsFromServer, getFirestore, runTransaction, setDoc, writeBatch
} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app=initializeApp(firebaseConfig);
const auth=getAuth(app), db=getFirestore(app);
const orgRef=id=>doc(db,'hospitalopsOrganizations',id);
const userOrgs=uid=>collection(db,'hospitalopsUsers',uid,'organizations');
const orgEntries=id=>collection(orgRef(id),'entries');
const memberRef=(id,uid)=>doc(orgRef(id),'members',uid);

export function watchUser(next,error){return onAuthStateChanged(auth,next,error)}
export function login(email,password){return signInWithEmailAndPassword(auth,email,password)}
export function register(email,password){return createUserWithEmailAndPassword(auth,email,password)}
export function logout(){return signOut(auth)}
export function resetPassword(email){return sendPasswordResetEmail(auth,email)}
export async function listOrganizations(uid){
  const result=await getDocsFromServer(userOrgs(uid));
  return result.docs.map(d=>({id:d.id,name:d.data().name}));
}
export async function createOrganization(uid,name){
  const ref=doc(collection(db,'hospitalopsOrganizations'));
  const batch=writeBatch(db);
  batch.set(ref,{name,ownerUid:uid});
  batch.set(memberRef(ref.id,uid),{role:'owner'});
  batch.set(doc(userOrgs(uid),ref.id),{name});
  await batch.commit();
  return ref.id;
}
export async function joinOrganization(uid,id){
  const snapshot=await getDocFromServer(orgRef(id));
  if(!snapshot.exists())throw new Error('Organisasi tidak ditemukan.');
  await setDoc(doc(userOrgs(uid),id),{name:snapshot.data().name});
}
export function grantManager(id,uid){
  return setDoc(memberRef(id,uid),{role:'manager'});
}

export function entriesFromData(data){
  const entries=new Map();
  for(const [module,rows] of Object.entries(data.records)){
    for(const row of rows)entries.set('record~'+module+'~'+row.id,JSON.stringify(row));
  }
  for(const row of data.ads)entries.set('ad~'+row.id,JSON.stringify(row));
  for(const [month,values] of Object.entries(data.leadCosts)){
    for(const [campaign,cost] of Object.entries(values))entries.set('cost~'+month+'~'+campaign,JSON.stringify(cost));
  }
  for(const key of ['disabled','custom','email','emailOn','patients']){
    entries.set('settings~'+key,JSON.stringify(data[key]));
  }
  return entries;
}
export function emptyData(){
  return {records:{},ads:[],leadCosts:{},disabled:[],custom:[],email:'',emailOn:false,patients:{out:[],in:[]}};
}
export async function loadOrganization(id,uid){
  const [org,member,items]=await Promise.all([
    getDocFromServer(orgRef(id)),getDocFromServer(memberRef(id,uid)),getDocsFromServer(orgEntries(id))
  ]);
  if(!org.exists()||!member.exists())throw new Error('Akses organisasi belum tersedia.');
  const data=emptyData();
  const baseline=new Map();
  for(const item of items.docs){
    const {payload}=item.data();
    const [kind,key,sub]=item.id.split('~');
    const value=JSON.parse(payload);
    baseline.set(item.id,payload);
    if(kind==='record'&&/^[a-z0-9-]+$/.test(key)&&/^[a-z0-9-]+$/.test(sub)&&value?.id===sub)(data.records[key]??=[]).push(value);
    if(kind==='ad'&&value?.id===key)data.ads.push(value);
    if(kind==='cost'&&/^\d{4}-\d{2}$/.test(key)&&/^[a-z0-9-]+$/.test(sub)&&Number.isFinite(value))(data.leadCosts[key]??={})[sub]=value;
    if(kind==='settings'&&Object.hasOwn(data,key))data[key]=value;
  }
  return {id,name:org.data().name,role:member.data().role,data,baseline};
}
export async function saveChanges(workspace,before){
  const prior=entriesFromData(before),next=entriesFromData(workspace.data);
  const changed=[...new Set([...prior.keys(),...next.keys()])].filter(id=>prior.get(id)!==next.get(id));
  if(!changed.length)return;
  await runTransaction(db,async tx=>{
    const refs=changed.map(id=>doc(orgEntries(workspace.id),id));
    const snapshots=await Promise.all(refs.map(ref=>tx.get(ref)));
    snapshots.forEach((snapshot,i)=>{
      if(snapshot.data()?.payload!==workspace.baseline.get(changed[i])){
        const error=new Error('Data ini sudah diubah dari sesi lain. Buka ulang workspace lalu coba lagi.');
        error.code='hospitalops/conflict';
        throw error;
      }
    });
    refs.forEach((ref,i)=>{
      const payload=next.get(changed[i]);
      if(payload===undefined)tx.delete(ref);
      else tx.set(ref,{payload});
    });
  });
  for(const id of changed){
    if(next.has(id))workspace.baseline.set(id,next.get(id));
    else workspace.baseline.delete(id);
  }
}
