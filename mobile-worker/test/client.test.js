import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../public/client.js',import.meta.url),'utf8');
async function boot(contentFails){
 const elements=new Map();
 const el=id=>{if(!elements.has(id))elements.set(id,{hidden:false,disabled:false,textContent:'',innerHTML:'',classList:{toggle(){}},reset(){}});return elements.get(id)};
 const calls=[];
 const context=vm.createContext({document:{getElementById:el,querySelectorAll:()=>[]},navigator:{},URL,fetch:async path=>{
  calls.push(path);
  if(path==='/api/me')return Response.json({login:'TypeConflict'});
  if(contentFails)return Response.json({error:'GitHub access denied'},{status:403});
  return Response.json({content:{notes:[{id:'note',text:'A note',date:'2026-11-24'}],blog:[],photos:[]},sha:'current'});
 }});
 vm.runInContext(source,context);
 await new Promise(resolve=>setImmediate(resolve));
 return {el,calls};
}
test('signed-in editor stays visible and reports content errors',async()=>{
 const {el}=await boot(true);
 assert.equal(el('login').hidden,true);
 assert.equal(el('editor').hidden,false);
 assert.match(el('status').textContent,/GitHub access denied/);
 assert.equal(el('submit').disabled,true);
});
test('signed-in editor loads posts and enables publish',async()=>{
 const {el,calls}=await boot(false);
 assert.deepEqual(calls,['/api/me','/api/content']);
 assert.equal(el('login').hidden,true);
 assert.equal(el('editor').hidden,false);
 assert.match(el('posts').innerHTML,/A note/);
 assert.equal(el('submit').disabled,false);
});

test('form controls do not shadow the native reset method',async()=>{
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 assert.doesNotMatch(html,/(?:id|name)=["']reset["']/);
 assert.match(html,/id="clearForm"/);
});
