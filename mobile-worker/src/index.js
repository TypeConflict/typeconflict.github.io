// Corner Mobile Studio · Cloudflare Worker
// Authenticated GitHub App user token; encrypted in D1; no credentials in browser storage.
const GH = 'https://api.github.com';
const REPO = 'TypeConflict/typeconflict.github.io';
const encoder = new TextEncoder(), decoder = new TextDecoder();
const json = (body,status=200,headers={}) => new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}});
const encode = bytes => {let s='';for(let i=0;i<bytes.length;i+=0x6000)s+=String.fromCharCode(...bytes.subarray(i,i+0x6000));return btoa(s)};
const decode = s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const random = ()=>encode(crypto.getRandomValues(new Uint8Array(32))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const sha256 = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const cookies = req => Object.fromEntries((req.headers.get('cookie')||'').split(';').map(x=>x.trim().split('=').map(decodeURIComponent)).filter(x=>x.length===2));
const setCookie = (name,value,age)=>name+'='+encodeURIComponent(value)+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+age;
const clearCookie = name=>setCookie(name,'',0);
async function cipherKey(env){
 if(!env.ENCRYPTION_KEY)throw Error('Missing encryption key');
 const bytes=decode(env.ENCRYPTION_KEY);
 if(bytes.byteLength!==32)throw Error('ENCRYPTION_KEY must be 32 random bytes in base64');
 return crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt']);
}
async function seal(env,s){
 const nonce=crypto.getRandomValues(new Uint8Array(12));
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},await cipherKey(env),encoder.encode(s));
 return encode(nonce)+'.'+encode(new Uint8Array(encrypted));
}
async function unseal(env,v){
 const [n,s]=v.split('.');
 return decoder.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(n)},await cipherKey(env),decode(s)));
}
function origin(req){return new URL(req.url).origin}
function sameOrigin(req){return req.headers.get('origin')===origin(req)&&req.headers.get('x-corner-action')==='1'}
async function github(token,path,init={}){
 const response=await fetch(GH+path,{...init,headers:{'User-Agent':'TypeConflict-Mobile-Studio',Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',Authorization:'Bearer '+token,...init.headers}});
 let body=await response.json().catch(()=>({}));
 if(!response.ok)throw Object.assign(Error(body.message||`GitHub API error (HTTP ${response.status})`),{status:response.status});
 return body;
}
async function oauthToken(env,payload){
 const r=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','content-type':'application/json'},body:JSON.stringify({client_id:env.GH_CLIENT_ID,client_secret:env.GH_CLIENT_SECRET,...payload})});
 const j=await r.json();
 if(!r.ok||j.error||!j.access_token)throw Error('GitHub authorization failed');
 return j;
}
async function session(req,env){
 const sid=cookies(req).corner_session;
 if(!sid)return null;
 const id=await sha256(sid);
 const row=await env.DB.prepare('SELECT * FROM sessions WHERE id = ?').bind(id).first();
 if(!row||row.login!==env.ALLOWED_LOGIN||row.expires_at<=Date.now())return null;
 let access=await unseal(env,row.access_cipher);
 if(row.token_expires_at<Date.now()+120000){
   if(!row.refresh_cipher)throw Object.assign(Error('Please sign in again'),{status:401});
   const refreshed=await oauthToken(env,{grant_type:'refresh_token',refresh_token:await unseal(env,row.refresh_cipher)});
   access=refreshed.access_token;
   await env.DB.prepare('UPDATE sessions SET access_cipher=?,refresh_cipher=?,token_expires_at=? WHERE id=?')
   .bind(await seal(env,access),await seal(env,refreshed.refresh_token),Date.now()+refreshed.expires_in*1000,id).run();
 }
 return {id,user:row.login,token:access};
}
export default {
 async fetch(req,env){
  const u=new URL(req.url),path=u.pathname;
  try{
   if(path==='/auth/start'){
     if(req.method!=='GET')return json({error:'Method not allowed'},405);
     const state=random(),verifier=random(),url=new URL('https://github.com/login/oauth/authorize');
     url.searchParams.set('client_id',env.GH_CLIENT_ID);
     url.searchParams.set('redirect_uri',origin(req)+'/auth/callback');
     url.searchParams.set('state',state);
     url.searchParams.set('code_challenge_method','S256');
     url.searchParams.set('code_challenge',encode(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(verifier)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''));
     // GitHub App must have expiring user tokens enabled
     const headers=new Headers({Location:url.toString(),'cache-control':'no-store'});
     headers.append('Set-Cookie',setCookie('corner_oauth_state',state,600));
     headers.append('Set-Cookie',setCookie('corner_oauth_verifier',verifier,600));
     return new Response(null,{status:302,headers});
   }
   if(path==='/auth/callback'){
     if(req.method!=='GET')return json({error:'Method not allowed'},405);
     const {corner_oauth_state:state,corner_oauth_verifier:verifier}=cookies(req);
     if(!verifier||!state||!u.searchParams.get('state')||state!==u.searchParams.get('state'))return json({error:'OAuth state mismatch'},403);
     const code=u.searchParams.get('code');
     if(!code)return json({error:'No authorization code'},400);
     const grant=await oauthToken(env,{code,code_verifier:verifier,redirect_uri:origin(req)+'/auth/callback'});
     if(!grant.refresh_token||!grant.expires_in)throw Error('Enable expiring user tokens on the GitHub App');
     const me=await github(grant.access_token,'/user');
     if(me.login!==env.ALLOWED_LOGIN) return json({error:'Not an authorized editor'},403,{'Set-Cookie':clearCookie('corner_oauth_state')});
     // Check the user token can read the actual repository before issuing a session.
     await github(grant.access_token,'/repos/'+REPO+'/contents/content.json');
     const sid=random(),id=await sha256(sid),ttl=30*24*3600*1000;
     await env.DB.prepare('INSERT INTO sessions (id,login,access_cipher,refresh_cipher,token_expires_at,expires_at) VALUES (?,?,?,?,?,?)')
     .bind(id,me.login,await seal(env,grant.access_token),await seal(env,grant.refresh_token),Date.now()+grant.expires_in*1000,Date.now()+ttl).run();
     const headers=new Headers({'Location':'/','cache-control':'no-store'});
     headers.append('Set-Cookie',setCookie('corner_session',sid,30*24*3600));
     headers.append('Set-Cookie',clearCookie('corner_oauth_state'));
     headers.append('Set-Cookie',clearCookie('corner_oauth_verifier'));
     return new Response(null,{status:302,headers});
   }
   if(path.startsWith('/api/')){
     if(req.method!=='GET'&&(req.method!=='POST'||!sameOrigin(req)))return json({error:'Cross-site request blocked'},403);
     // Logout must work even when the GitHub token has expired or been revoked.
     if(path==='/api/logout'&&req.method==='POST'){
       const sid=cookies(req).corner_session;
       if(sid)await env.DB.prepare('DELETE FROM sessions WHERE id=?').bind(await sha256(sid)).run();
       return json({ok:true},200,{'Set-Cookie':clearCookie('corner_session')});
     }
     const s=await session(req,env);
     if(!s)return json({error:'Sign in with GitHub first'},401);
     if(path==='/api/me'&&req.method==='GET')return json({login:s.user,repo:REPO});
     if(path==='/api/content'&&req.method==='GET'){
       const f=await github(s.token,'/repos/'+REPO+'/contents/content.json?ref=main');
       const content=JSON.parse(decoder.decode(decode(f.content.replace(/\s/g,''))));
       return json({content,sha:f.sha});
     }
     if(req.method!=='POST'||!sameOrigin(req))return json({error:'Cross-site request blocked'},403);
     if(path==='/api/upload'){
       if(req.headers.get('content-type')!=='image/webp')return json({error:'WebP required'},415);
       if(Number(req.headers.get('content-length')||0)>5e6)return json({error:'Max upload 5MB'},413);
       const bytes=new Uint8Array(await req.arrayBuffer());
       if(bytes.byteLength>5e6)return json({error:'Max upload 5MB'},413);
       if(bytes.length<12||decoder.decode(bytes.slice(0,4))!=='RIFF'||decoder.decode(bytes.slice(8,12))!=='WEBP')return json({error:'Invalid WebP'},400);
       const p='assets/photos/'+crypto.randomUUID()+'.webp';
       await github(s.token,'/repos/'+REPO+'/contents/'+p,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Upload photo from mobile studio',branch:'main',content:encode(bytes)})});
       return json({path:p});
     }
     if(path==='/api/publish'){
       const input=await req.json();
       if(JSON.stringify(input).length>250000)return json({error:'Content too large'},413);
       if(!['blog','notes','photos'].includes(input.type)||!input.entry||typeof input.entry.id!=='string')return json({error:'Invalid content'},400);
       const f=await github(s.token,'/repos/'+REPO+'/contents/content.json?ref=main');
       if(typeof input.sha!=='string'||input.sha!==f.sha)return json({error:'內容已在其他裝置更新，請重新整理後再編輯。'},409);
       const data=JSON.parse(decoder.decode(decode(f.content.replace(/\s/g,''))));
       const list=data[input.type];
       if(!Array.isArray(list))return json({error:'Invalid content.json'},500);
       const entry=input.entry,id=entry.id;
       if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id)||!Array.isArray(entry.tags)||entry.tags.length>15||entry.tags.some(t=>typeof t!=='string'||t.length>100)||typeof entry.date!=='string'||!Number.isFinite(Date.parse(entry.date)))return json({error:'Invalid entry fields'},400);
       if(!['delete','upsert'].includes(input.action))return json({error:'Unknown action'},400);
       if(input.action==='upsert'){
       if(input.type==='notes'&&typeof entry.text!=='string')return json({error:'Missing note'},400);
       if(input.type==='blog'&&(typeof entry.title!=='string'||typeof entry.body!=='string'||typeof entry.summary!=='string'))return json({error:'Missing blog fields'},400);
       if(input.type==='photos'&&(typeof entry.caption!=='string'||!Array.isArray(entry.images)||entry.images.length!==1||typeof entry.images[0]!=='string'||!/^assets\/photos\/[a-zA-Z0-9_-]+\.webp$/.test(entry.images[0])))return json({error:'One uploaded photo is required'},400);

       }
       const position=list.findIndex(x=>x.id===id);
       if(input.action==='delete'){
         if(position<0)return json({error:'Entry no longer exists'},404);
         list.splice(position,1);
       }else if(position>=0){list[position]=entry}else{list.push(entry)}
       const next=encoder.encode(JSON.stringify(data,null,2)+'\n');
       await github(s.token,'/repos/'+REPO+'/contents/content.json',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:(input.action==='delete'?'Delete ':'Publish ')+input.type+' '+id,branch:'main',sha:f.sha,content:encode(next)})});
       return json({ok:true});
     }
     return json({error:'Not found'},404);
   }
   return env.ASSETS.fetch(req);
  }catch(e){
   const status=e.status===401?401:e.status===403?403:e.status===409?409:500;
   return json({error:status===500?'Service error. Check Worker logs and configuration.':e.message},status);
  }
 }
};