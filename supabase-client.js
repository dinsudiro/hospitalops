import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm';
import { supabaseUrl, publishableKey } from './supabase-config.js';

const client = createClient(supabaseUrl, publishableKey, {
  auth: { storageKey: 'hospitalops-supabase-auth', flowType: 'pkce' }
});
const redirectTo = new URL('./index.html', location.href).href;
function unwrap({data, error}) {
  if (error) throw error;
  return data;
}
export function watchUser(next, onError, onRecovery) {
  let lastUserId;
  return client.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      setTimeout(onRecovery, 0);
      return;
    }
    const user = session?.user || null;
    if (lastUserId === (user?.id ?? null)) return;
    lastUserId = user?.id ?? null;
    setTimeout(() => Promise.resolve(next(user && {...user, uid:user.id})).catch(onError), 0);
  }).data.subscription;
}
export async function login(email, password) {
  return unwrap(await client.auth.signInWithPassword({email, password}));
}
export async function register(email, password) {
  return unwrap(await client.auth.signUp({email, password, options:{emailRedirectTo:redirectTo}}));
}
export async function logout() { unwrap(await client.auth.signOut({scope:'local'})); }
export async function resetPassword(email) {
  unwrap(await client.auth.resetPasswordForEmail(email, {redirectTo:new URL('?recovery=1',redirectTo).href}));
}
export async function updatePassword(password) { unwrap(await client.auth.updateUser({password})); }
export async function listOrganizations(uid) {
  return unwrap(await client.from('hospitalops_members')
    .select('workspace:hospitalops_workspaces(id,name)').eq('user_id',uid))
    .map(member=>member.workspace).filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name));
}
export async function createOrganization(uid, name) {
  return unwrap(await client.rpc('hospitalops_create_workspace',{workspace_name:name}));
}
async function membership(uid,id) {
  return unwrap(await client.from('hospitalops_members').select('role,workspace:hospitalops_workspaces(name)')
    .eq('workspace_id',id).eq('user_id',uid).maybeSingle());
}
export async function joinOrganization(uid,id) {
  if (!(await membership(uid,id))) throw new Error('Organisasi tidak ditemukan atau UID Anda belum ditambahkan.');
}
export async function grantManager(id,uid) {
  unwrap(await client.from('hospitalops_members').insert({workspace_id:id,user_id:uid,role:'manager'}));
}

function entriesFromData(data) {
  const entries=new Map();
  for(const [module,rows] of Object.entries(data.records)){
    for(const row of rows)entries.set('record~'+module+'~'+row.id,row);
  }
  for(const row of data.ads)entries.set('ad~'+row.id,row);
  for(const [month,values] of Object.entries(data.leadCosts)){
    for(const [campaign,cost] of Object.entries(values))entries.set('cost~'+month+'~'+campaign,cost);
  }
  for(const key of ['disabled','custom','email','emailOn','patients'])entries.set('settings~'+key,data[key]);
  return entries;
}
function emptyData() {
  return {records:{},ads:[],leadCosts:{},disabled:[],custom:[],email:'',emailOn:false,patients:{out:[],in:[]}};
}
export async function loadOrganization(id,uid) {
  const member=await membership(uid,id);
  if(!member?.workspace)throw new Error('Akses organisasi belum tersedia.');
  const data=emptyData(),baseline=new Map();
  let after=null;
  for(;;){
    let request=client.from('hospitalops_entries').select('entry_id,payload,version')
      .eq('workspace_id',id).order('entry_id').limit(500);
    if(after!==null)request=request.gt('entry_id',after);
    const items=unwrap(await request);
    for(const {entry_id,payload:value,version} of items){
      const [kind,key,sub]=entry_id.split('~');
      baseline.set(entry_id,version);
      if(kind==='record'&&/^[a-z0-9-]+$/.test(key)&&/^[a-z0-9-]+$/.test(sub)&&value?.id===sub)(data.records[key]??=[]).push(value);
      if(kind==='ad'&&value?.id===key)data.ads.push(value);
      if(kind==='cost'&&/^\d{4}-\d{2}$/.test(key)&&/^[a-z0-9-]+$/.test(sub)&&Number.isFinite(value))(data.leadCosts[key]??={})[sub]=value;
      if(kind==='settings'&&['disabled','custom','email','emailOn','patients'].includes(key))data[key]=value;
    }
    if(items.length<500)break;
    after=items.at(-1).entry_id;
  }
  return {id,name:member.workspace.name,role:member.role,data,baseline};
}
export async function saveChanges(workspace,before) {
  const prior=entriesFromData(before),next=entriesFromData(workspace.data);
  const ids=[...new Set([...prior.keys(),...next.keys()])].filter(id=>JSON.stringify(prior.get(id))!==JSON.stringify(next.get(id)));
  if(!ids.length)return;
  const changes=ids.map(id=>({
    id, version:workspace.baseline.get(id)??null,
    ...(next.has(id)?{action:'write',payload:next.get(id)}:{action:'delete'})
  }));
  const result=await client.rpc('hospitalops_save_entries',{target_workspace:workspace.id,changes});
  if(result.error?.code==='40001'){
    throw Object.assign(new Error('Data ini berubah di sesi lain. Buka ulang workspace lalu coba lagi.'),{code:'hospitalops/conflict'});
  }
  unwrap(result);
  for(const change of changes){
    if(change.action==='delete')workspace.baseline.delete(change.id);
    else workspace.baseline.set(change.id,(change.version??0)+1);
  }
}
