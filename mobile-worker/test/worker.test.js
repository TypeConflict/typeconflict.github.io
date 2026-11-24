import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
const base='https://studio.example';
const key=Buffer.alloc(32,7).toString('base64');
async function seal(text){const iv=crypto.getRandomValues(new Uint8Array(12));const k=await crypto.subtle.importKey('raw',Buffer.from(key,'base64'),'AES-GCM',false,['encrypt']);return Buffer.from(iv).toString('base64')+'.'+Buffer.from(await crypto.subtle.encrypt({name:'AES-GCM',iv},k,new TextEncoder().encode(text))).toString('base64')}
const row={login:'TypeConflict',expires_at:Date.now()+1e6,token_expires_at:Date.now()+1e6,access_cipher:await seal('test-only-token')};
let deletes=0,writes=0;
const env={GH_CLIENT_ID:'test-client',ALLOWED_LOGIN:'TypeConflict',ENCRYPTION_KEY:key,DB:{prepare(sql){return {bind(){return this},async first(){return row},async run(){if(sql.startsWith('DELETE'))deletes++;return {success:true}}}}}};
function request(path,body,headers={}){return new Request(base+path,{method:body?'POST':'GET',headers:{cookie:'corner_session=test-session',origin:base,'x-corner-action':'1','content-type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})})}
const content={notes:[],blog:[],photos:[{id:'old',images:['assets/demo-bird.svg','assets/photos/old.webp']}]};
globalThis.fetch=async(url,init={})=>{if(init.method==='PUT'){writes++;return Response.json({})}return Response.json({sha:'current',content:Buffer.from(JSON.stringify(content)).toString('base64')})};
test('OAuth uses S256 PKCE with protected verifier cookie',async()=>{const r=await worker.fetch(new Request(base+'/auth/start'),env);const u=new URL(r.headers.get('location'));const cookie=r.headers.getSetCookie().find(v=>v.startsWith('corner_oauth_verifier='));const verifier=decodeURIComponent(cookie.split(';')[0].split('=')[1]);assert.match(cookie,/HttpOnly; Secure; SameSite=Lax/);assert.equal(u.searchParams.get('code_challenge_method'),'S256');assert.equal(u.searchParams.get('code_challenge'),Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))).toString('base64url'))});
test('callback rejects mismatched state and missing verifier',async()=>{assert.equal((await worker.fetch(new Request(base+'/auth/callback?state=bad&code=x',{headers:{cookie:'corner_oauth_state=good'}}),env)).status,403)});
test('API requires a session',async()=>{assert.equal((await worker.fetch(new Request(base+'/api/me'),env)).status,401)});
test('cross-origin write rejected before DB access',async()=>{assert.equal((await worker.fetch(request('/api/logout',{}, {origin:'https://evil.example'}),{})).status,403)});
test('logout deletes session without decrypting expired tokens',async()=>{const before=deletes;const r=await worker.fetch(request('/api/logout',{}),{...env,ENCRYPTION_KEY:''});assert.equal(r.status,200);assert.equal(deletes,before+1);assert.match(r.headers.get('set-cookie'),/Max-Age=0/)});
test('changed allowlist invalidates existing session',async()=>{assert.equal((await worker.fetch(request('/api/me'),{...env,ALLOWED_LOGIN:'someone-else'})).status,401)});
const note={id:'note',date:'2026-11-24',tags:[],text:'test'};
test('stale content cannot overwrite another device',async()=>{const before=writes;assert.equal((await worker.fetch(request('/api/publish',{type:'notes',action:'upsert',entry:note,sha:'stale'}),env)).status,409);assert.equal(writes,before)});
test('valid Note publishes',async()=>{assert.equal((await worker.fetch(request('/api/publish',{type:'notes',action:'upsert',entry:note,sha:'current'}),env)).status,200)});
test('legacy multi-image photo can be deleted',async()=>{assert.equal((await worker.fetch(request('/api/publish',{type:'photos',action:'delete',entry:{id:'old',date:'2026-11-24',tags:[]},sha:'current'}),env)).status,200)});
test('invalid image paths rejected without commit',async()=>{for(const image of [null,12,'assets/photos/../private.webp','assets/photos/a.webp?x']){const before=writes;const entry={id:'photo',date:'2026-11-24',tags:[],caption:'test',images:[image]};assert.equal((await worker.fetch(request('/api/publish',{type:'photos',action:'upsert',entry,sha:'current'}),env)).status,400);assert.equal(writes,before)}});

test('OAuth callback sends GitHub-required User-Agent and creates a protected session',async()=>{
 const originalFetch=globalThis.fetch;
 const calls=[];
 globalThis.fetch=async(url,init={})=>{
  calls.push({url,init});
  if(url==='https://github.com/login/oauth/access_token')return Response.json({access_token:'test-access-only',refresh_token:'test-refresh-only',expires_in:28800});
  assert.equal(init.headers['User-Agent'],'TypeConflict-Mobile-Studio');
  if(url.endsWith('/user'))return Response.json({login:'TypeConflict'});
  return Response.json({sha:'current'});
 };
 try{
  const req=new Request(base+'/auth/callback?state=test-state&code=test-code',{headers:{cookie:'corner_oauth_state=test-state; corner_oauth_verifier=test-verifier'}});
  const r=await worker.fetch(req,env);
  assert.equal(r.status,302);
  assert.equal(r.headers.get('location'),'/');
  assert.match(r.headers.get('set-cookie'),/corner_session=.*HttpOnly; Secure/);
  assert.equal(JSON.parse(calls[0].init.body).code_verifier,'test-verifier');
  assert.equal(calls.length,3);
  assert.doesNotMatch(await r.text(),/test-access-only|test-refresh-only/);
 }finally{globalThis.fetch=originalFetch}
});
test('non-JSON GitHub rejection reports status without exposing response body',async()=>{
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async()=>new Response('internal upstream details',{status:403});
 try{
  const r=await worker.fetch(request('/api/content'),env);
  assert.equal(r.status,403);
  assert.deepEqual(await r.json(),{error:'GitHub API error (HTTP 403)'});
 }finally{globalThis.fetch=originalFetch}
});
