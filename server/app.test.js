import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from './app.js';
async function start(options){const app=createApp(options);await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));return {...app,url:`http://127.0.0.1:${app.server.address().port}`,close:()=>new Promise(resolve=>app.server.close(()=>{app.db.close();resolve()}))}}
async function call(app,path,{method='GET',body,cookie}={}){const response=await fetch(app.url+'/api'+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]}}
async function member(app,email,role='Student'){const result=await call(app,'/auth/register',{method:'POST',body:{email,role,name:email.split('@')[0],password:'CampusPass123!'}});assert.equal(result.status,201);return result}
test('API: persistence, sessions, validation, ownership and Staff handover',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'lostchain-'));const filename=join(directory,'test.sqlite');let app=await start({filename,staffEmails:['staff@campus.edu']});
 try{
  assert.equal((await call(app,'/health')).status,200);
  assert.equal((await call(app,'/items',{method:'POST',body:{}})).status,401);
  const reporter=await member(app,'reporter@campus.edu'),claimant=await member(app,'claimant@campus.edu'),other=await member(app,'other@campus.edu'),staff=await member(app,'staff@campus.edu','Staff');
  assert.equal((await call(app,'/auth/register',{method:'POST',body:{email:'reporter@campus.edu',role:'Staff',name:'spoof',password:'CampusPass123!'}})).status,409);
  assert.equal((await call(app,'/demo-session',{method:'POST',body:{}})).status,410);
  const itemBody={name:'Test headphones',description:'Black headphones',category:'Electronics',date:'2026-01-01',status:'Found',location:'Library',reporter:'spoof'};
  const created=await call(app,'/items',{method:'POST',cookie:reporter.cookie,body:itemBody});assert.equal(created.status,201);assert.equal(created.data.reporter,reporter.data.address);
  assert.equal((await call(app,'/items',{method:'POST',cookie:reporter.cookie,body:{...itemBody,status:'Returned'}})).status,400);
  assert.equal((await call(app,'/items',{method:'POST',cookie:reporter.cookie,body:{...itemBody,date:'2026-02-30'}})).status,400);
  const claimBody={itemId:created.data.id,evidence:'Distinctive sticker under the left ear cup',status:'Completed',owner:'spoof'};
  assert.equal((await call(app,'/claims',{method:'POST',cookie:reporter.cookie,body:claimBody})).status,409);
  const claim=await call(app,'/claims',{method:'POST',cookie:claimant.cookie,body:claimBody});assert.equal(claim.status,201);assert.equal(claim.data.status,'Pending');assert.equal(claim.data.owner,claimant.data.address);
  assert.equal((await call(app,'/claims',{method:'POST',cookie:claimant.cookie,body:claimBody})).status,409);
  assert.equal((await call(app,'/state',{cookie:other.cookie})).data.claims.length,0);
  assert.equal((await call(app,'/state',{cookie:reporter.cookie})).data.claims.length,1);
  const second=await call(app,'/claims',{method:'POST',cookie:other.cookie,body:claimBody});assert.equal(second.status,201);
  const path=`/claims/${claim.data.id}/handover`;
  assert.equal((await call(app,path,{method:'POST',cookie:claimant.cookie,body:{confirmed:true}})).status,403);
  assert.equal((await call(app,path,{method:'POST',cookie:staff.cookie,body:{confirmed:false}})).status,400);
  assert.equal((await call(app,path,{method:'POST',cookie:staff.cookie,body:{confirmed:true}})).status,200);
  assert.equal((await call(app,path,{method:'POST',cookie:staff.cookie,body:{confirmed:true}})).status,409);
  const state=(await call(app,'/state',{cookie:staff.cookie})).data;
  assert.equal(state.items.find(i=>i.id===created.data.id).status,'Returned');assert.equal(state.claims.find(c=>c.id===claim.data.id).status,'Completed');assert.equal(state.claims.find(c=>c.id===second.data.id).status,'Closed');
  assert.equal((await call(app,'/profile',{method:'PATCH',cookie:claimant.cookie,body:{name:'Updated',email:'claimant@campus.edu',role:'Staff'}})).data.role,'Student');
  await app.close();app=await start({filename,staffEmails:['staff@campus.edu']});
  const persisted=(await call(app,'/state',{cookie:claimant.cookie})).data;assert.equal(persisted.user.name,'Updated');assert.equal(persisted.items.find(i=>i.id===created.data.id).status,'Returned');
  await call(app,'/session',{method:'DELETE',cookie:claimant.cookie});assert.equal((await call(app,'/state',{cookie:claimant.cookie})).data.user,null);
 }finally{await app.close();rmSync(directory,{recursive:true,force:true})}
});
test('password authentication, role assignment, session rotation and throttling',async()=>{
 const app=await start({filename:':memory:',secureCookies:true});try{
 const account=await member(app,'member@campus.edu','Staff');assert.equal(account.data.role,'Student');
 const stored=app.db.prepare('SELECT password_hash FROM credentials').get().password_hash;assert.ok(!stored.includes('CampusPass123!'));assert.equal(account.data.password,undefined);
 assert.equal((await call(app,'/auth/login',{method:'POST',body:{email:'member@campus.edu',password:'wrong-password'}})).status,401);
 assert.equal((await call(app,'/auth/login',{method:'POST',body:{email:'missing@campus.edu',password:'wrong-password'}})).status,401);
 const login=await call(app,'/auth/login',{method:'POST',cookie:account.cookie,body:{email:'MEMBER@campus.edu',password:'CampusPass123!'}});assert.equal(login.status,200);assert.notEqual(login.cookie,account.cookie);
 assert.equal((await call(app,'/state',{cookie:account.cookie})).data.user,null);
 assert.equal((await call(app,'/state',{cookie:login.cookie})).data.user.email,'member@campus.edu');
 assert.equal((await call(app,'/auth/register',{method:'POST',body:{email:'weak@campus.edu',name:'Weak',password:'short'}})).status,400);
 for(let i=0;i<20;i++)await call(app,'/auth/login',{method:'POST',body:{email:'member@campus.edu',password:'wrong-password'}});
 assert.equal((await call(app,'/auth/login',{method:'POST',body:{email:'member@campus.edu',password:'CampusPass123!'}})).status,429);
 }finally{await app.close()}
});
