import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {initialItems,categories} from '../src/data/mock.js';
import {hashPassword,verifyPassword} from './auth.js';
import {completeHandover} from '../src/services/permissions.js';
const hash = value => createHash('sha256').update(value).digest('hex');
export function createApp({filename='server/data/lostchain.sqlite',staffEmails=[],secureCookies=false,origin='http://127.0.0.1:5173'}={}){
 const db=new DatabaseSync(filename);db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS members(address TEXT PRIMARY KEY, data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS items(id TEXT PRIMARY KEY,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS claims(id TEXT PRIMARY KEY,item_id TEXT NOT NULL REFERENCES items(id),owner TEXT NOT NULL REFERENCES members(address),data TEXT NOT NULL,UNIQUE(item_id,owner));
 CREATE TABLE IF NOT EXISTS credentials(email TEXT PRIMARY KEY,address TEXT NOT NULL UNIQUE REFERENCES members(address),password_hash TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS migrations(name TEXT PRIMARY KEY);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,address TEXT NOT NULL REFERENCES members(address),expires INTEGER NOT NULL);`);
 if(!db.prepare("SELECT name FROM migrations WHERE name='password-auth'").get()){db.exec("DELETE FROM sessions; INSERT INTO migrations VALUES ('password-auth');")}
 const attempts=new Map();
 if(!db.prepare('SELECT id FROM items LIMIT 1').get())for(const item of initialItems)db.prepare('INSERT INTO items VALUES (?,?)').run(item.id,JSON.stringify(item));
 const all=table=>db.prepare(`SELECT data FROM ${table}`).all().map(row=>JSON.parse(row.data));
 const fail=(status,message)=>{throw Object.assign(new Error(message),{status})};
 const text=(body,key,min=1,max=200)=>{const value=body[key];if(typeof value!=='string'||value.trim().length<min||value.length>max)fail(400,`Invalid ${key}`);return value.trim()};
 const writeItem=item=>db.prepare('UPDATE items SET data=? WHERE id=?').run(JSON.stringify(item),item.id);
 const writeClaim=claim=>db.prepare('UPDATE claims SET data=? WHERE id=?').run(JSON.stringify(claim),claim.id);
 const server=createServer(async(req,res)=>{
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))};
  try{
   const path=new URL(req.url,'http://localhost').pathname,method=req.method;
   if(!['GET','HEAD'].includes(method)&&req.headers.origin&&req.headers.origin!==origin)fail(403,'Origin not allowed');
   let body={};if(['POST','PATCH'].includes(method)){if(!req.headers['content-type']?.startsWith('application/json'))fail(415,'JSON required');let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>3*1024*1024)fail(413,'Request too large')}try{body=JSON.parse(raw||'{}')}catch{fail(400,'Invalid JSON')}if(!body||typeof body!=='object'||Array.isArray(body))fail(400,'Invalid body')}
   const token=req.headers.cookie?.split(';').map(c=>c.trim()).find(c=>c.startsWith('lc_session='))?.slice(11);
   const session=token?db.prepare('SELECT address FROM sessions WHERE token=? AND expires>?').get(hash(token),Date.now()):null;
   const user=session?JSON.parse(db.prepare('SELECT data FROM members WHERE address=?').get(session.address).data):null;
   const requireUser=()=>{if(!user)fail(401,'Sign in first')};
   if(path==='/api/health'&&method==='GET')return send(200,{ok:true});
   if(path==='/api/state'&&method==='GET')return send(200,{user,items:all('items').reverse(),claims:user?all('claims').filter(c=>user.role==='Staff'||c.owner===user.address||all('items').some(i=>i.id===c.itemId&&i.reporter===user.address)):[]});
   if(['/api/auth/register','/api/auth/login'].includes(path)&&method==='POST'){
    const ip=req.socket.remoteAddress;const now=Date.now();for(const [key,value] of attempts)if(value.until<now)attempts.delete(key);
    const bucket=attempts.get(ip)||{count:0,until:now+15*60000};if(bucket.count>=20)fail(429,'Too many attempts. Try again in 15 minutes.');bucket.count++;attempts.set(ip,bucket);
    const email=text(body,'email',3,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(400,'Invalid email');
    const password=body.password;if(typeof password!=='string'||password.length<8||password.length>128)fail(400,'Password must contain 8 to 128 characters');
    let member;
    if(path.endsWith('/register')){
     const name=text(body,'name',1,100);
     if(db.prepare('SELECT email FROM credentials WHERE email=?').get(email)||all('members').some(m=>m.email.toLowerCase()===email))fail(409,'An account already exists for this email.');
     const passwordHash=await hashPassword(password);const address='0x'+hash(email).slice(0,40);
     member={address,email,name,role:staffEmails.map(e=>e.toLowerCase()).includes(email)?'Staff':'Student'};
     db.exec('BEGIN IMMEDIATE');try{if(db.prepare('SELECT address FROM members WHERE address=?').get(address))fail(409,'An account already exists for this email.');db.prepare('INSERT INTO members VALUES (?,?)').run(address,JSON.stringify(member));db.prepare('INSERT INTO credentials VALUES (?,?,?)').run(email,address,passwordHash);db.exec('COMMIT')}catch(error){db.exec('ROLLBACK');throw error}
    }else{
     const credentials=db.prepare('SELECT * FROM credentials WHERE email=?').get(email);
     const valid=await verifyPassword(password,credentials?.password_hash||('0'.repeat(32)+':'+ '0'.repeat(128)));
     if(!credentials||!valid)fail(401,'Incorrect email or password');
     member=JSON.parse(db.prepare('SELECT data FROM members WHERE address=?').get(credentials.address).data);
    }
    if(token)db.prepare('DELETE FROM sessions WHERE token=?').run(hash(token));
    const secret=randomBytes(32).toString('hex');db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(hash(secret),member.address,Date.now()+7*86400000);
    res.setHeader('Set-Cookie',`lc_session=${secret}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=604800${secureCookies?'; Secure':''}`);return send(path.endsWith('/register')?201:200,member);
   }
   if(path==='/api/demo-session')fail(410,'Demo login has been removed. Register or sign in with a password.');
   if(path==='/api/session'&&method==='DELETE'){if(token)db.prepare('DELETE FROM sessions WHERE token=?').run(hash(token));res.setHeader('Set-Cookie',`lc_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0${secureCookies?'; Secure':''}`);return send(200,{ok:true})}
   requireUser();
   if(path==='/api/profile'&&method==='PATCH'){const name=text(body,'name',1,100),email=text(body,'email',3,254).toLowerCase();if(email!==user.email)fail(400,'Campus email cannot be changed');const member={...user,name};db.prepare('UPDATE members SET data=? WHERE address=?').run(JSON.stringify(member),user.address);return send(200,member)}
   if(path==='/api/items'&&method==='POST'){
    const status=text(body,'status');if(!['Lost','Found'].includes(status))fail(400,'Invalid item status');const category=text(body,'category');if(!categories.includes(category))fail(400,'Invalid category');
    const date=text(body,'date',10,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>new Date().toISOString().slice(0,10))fail(400,'Invalid item date');
    const image=body.image||'';if(typeof image!=='string'||image.length>2900000||(image&&!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image)))fail(400,'Invalid image (PNG, JPG or WebP; max 2 MB)');
    const item={id:'LC-'+randomUUID(),name:text(body,'name',1,100),description:text(body,'description',1,2000),location:text(body,'location'),category,status,date,image,reporter:user.address};db.prepare('INSERT INTO items VALUES (?,?)').run(item.id,JSON.stringify(item));return send(201,item);
   }
   if(path==='/api/claims'&&method==='POST'){
    const itemId=text(body,'itemId');const item=all('items').find(i=>i.id===itemId);if(!item)fail(404,'Item not found');if(item.status!=='Found'||item.reporter===user.address)fail(409,'This item cannot be claimed');if(db.prepare('SELECT id FROM claims WHERE item_id=? AND owner=?').get(itemId,user.address))fail(409,'You already submitted a claim');
    const claim={id:'CL-'+randomUUID(),itemId,owner:user.address,name:user.name,evidence:text(body,'evidence',15,2000),date:new Date().toISOString().slice(0,10),status:'Pending'};db.prepare('INSERT INTO claims VALUES (?,?,?,?)').run(claim.id,itemId,user.address,JSON.stringify(claim));return send(201,claim);
   }
   const match=path.match(/^\/api\/claims\/([^/]+)\/handover$/);
   if(match&&method==='POST'){
    if(user.role!=='Staff')fail(403,'Only Staff can confirm physical returns');if(body.confirmed!==true)fail(400,'Physical handover confirmation required');
    db.exec('BEGIN IMMEDIATE');try{const items=all('items'),claims=all('claims'),claim=claims.find(c=>c.id===match[1]);if(!claim)fail(404,'Claim not found');const result=completeHandover({user,claim,items,claims});if(!result)fail(409,'This handover is no longer pending');result.items.forEach(writeItem);result.claims.forEach(writeClaim);db.exec('COMMIT')}catch(error){db.exec('ROLLBACK');throw error}return send(200,{ok:true});
   }
   fail(404,'API route not found');
  }catch(error){if(!error.status)console.error(error);send(error.status||500,{error:error.status?error.message:'Internal server error'})}
 });return {server,db};
}
