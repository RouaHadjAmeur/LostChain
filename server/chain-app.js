import {createEventIndex} from './event-index.js';
import {networkFor,publicConfig} from '../shared/networks.js';
import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,createHash} from 'node:crypto';
import {Contract,JsonRpcProvider,verifyMessage,isAddress,keccak256,toUtf8Bytes} from 'ethers';
import {validateProofPhoto} from '../src/services/prototype/photos.js';
import {reporterLabel} from '../src/services/prototype/reporter.js';
const hash=value=>createHash('sha256').update(value).digest('hex');
const same=(a,b)=>a?.toLowerCase()===b?.toLowerCase();
export function createChainApp({filename=':memory:',getConfig,origin='http://127.0.0.1:5173',rpcUrl='http://127.0.0.1:8545',chainId=31337,secureCookies=false}={}){
 const db=new DatabaseSync(filename);db.exec(`PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS metadata(scope TEXT,kind TEXT,id TEXT,data TEXT NOT NULL,PRIMARY KEY(scope,kind,id));
 CREATE TABLE IF NOT EXISTS wallet_sessions(scope TEXT,token TEXT PRIMARY KEY,address TEXT,expires INTEGER);
 CREATE TABLE IF NOT EXISTS wallet_challenges(id TEXT PRIMARY KEY,scope TEXT,address TEXT,message TEXT,expires INTEGER);`);
 networkFor(chainId);
 const provider=new JsonRpcProvider(rpcUrl,chainId,{cacheTimeout:-1});
 const eventLogs=createEventIndex(provider);
 const cookieSuffix=secureCookies?'; Secure':'';
 const fail=(status,message)=>{throw Object.assign(new Error(message),{status})};
 const text=(value,label,min=1,max=200)=>{if(typeof value!=='string'||value.trim().length<min||value.length>max)fail(400,`Invalid ${label}`);return value.trim()};
 const email=value=>{const result=text(value,'campus email',3,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result))fail(400,'Invalid campus email');return result};
 const counters=new Map();
 const server=createServer(async(req,res)=>{
  const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value))};
  try{
   const path=new URL(req.url,'http://localhost').pathname,method=req.method;
   if(!['GET','HEAD'].includes(method)&&req.headers.origin&&req.headers.origin!==origin)fail(403,'Origin not allowed');
   let config;try{config=await getConfig()}catch{fail(503,'Deployment manifest not found. Deploy and configure the selected network first.');}
   if(config.chainId!==chainId)fail(503,'Deployment does not match the configured network.');
   if(Number((await provider.getNetwork()).chainId)!==chainId)fail(503,'RPC is on the wrong network.');
   const scope=config.deploymentId;
   const identity=new Contract(config.identity.address,config.identity.abi,provider),registry=new Contract(config.registry.address,config.registry.abi,provider);
   const get=(kind,id)=>{const row=db.prepare('SELECT data FROM metadata WHERE scope=? AND kind=? AND id=?').get(scope,kind,id);return row?JSON.parse(row.data):{}};
   const put=(kind,id,data)=>db.prepare('INSERT INTO metadata VALUES (?,?,?,?) ON CONFLICT(scope,kind,id) DO UPDATE SET data=excluded.data').run(scope,kind,id,JSON.stringify(data));
   if(path==='/api/chain/config'&&method==='GET')return send(200,publicConfig(config));
   if(path==='/api/chain/health'&&method==='GET')return send(200,{ok:true,chainId});
   if(await provider.getCode(config.registry.address)==='0x'||await provider.getCode(config.identity.address)==='0x')fail(503,'Contracts not found. Check the selected network and deployment.');
   let body={};if(['POST','PATCH'].includes(method)){if(!req.headers['content-type']?.startsWith('application/json'))fail(415,'JSON required');let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>3*1024*1024)fail(413,'Attachment too large')}try{body=JSON.parse(raw||'{}')}catch{fail(400,'Invalid JSON')}if(!body||Array.isArray(body)||typeof body!=='object')fail(400,'Invalid JSON body')}
   const token=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('lc_chain='))?.slice(9);
   const session=token?db.prepare('SELECT address FROM wallet_sessions WHERE scope=? AND token=? AND expires>?').get(scope,hash(token),Date.now()):null;
   const address=session?.address;
   const requireUser=async()=>{if(!address)fail(401,'Connect and sign in with your wallet.');if(!await identity.isRegistered(address))fail(403,'Register this wallet first.')};
   if(path.startsWith('/api/chain/auth/')&&method==='POST'){
    const ip=req.socket.remoteAddress,now=Date.now();for(const [key,value]of counters)if(value.until<now)counters.delete(key);const entry=counters.get(ip)||{count:0,until:now+900000};if(entry.count>=40)fail(429,'Too many wallet sign-in attempts. Try again later.');entry.count++;counters.set(ip,entry);
    if(path.endsWith('/challenge')){if(!isAddress(body.address))fail(400,'Invalid wallet address');const nonce=randomBytes(24).toString('hex'),id=randomBytes(16).toString('hex');const message=`LostChain sign-in\nOrigin: ${origin}\nWallet: ${body.address.toLowerCase()}\nChain ID: ${chainId}\nDeployment: ${scope}\nNonce: ${nonce}\nExpires: ${new Date(now+300000).toISOString()}\nThis signature signs in to LostChain. It does not authorize a transaction.`;db.prepare('DELETE FROM wallet_challenges WHERE expires<?').run(now);db.prepare('INSERT INTO wallet_challenges VALUES (?,?,?,?,?)').run(id,scope,body.address.toLowerCase(),message,now+300000);return send(200,{id,message})}
    if(path.endsWith('/verify')){const challenge=db.prepare('SELECT * FROM wallet_challenges WHERE id=? AND scope=? AND expires>?').get(String(body.id),scope,now);if(!challenge)fail(401,'Wallet challenge expired or already used.');db.prepare('DELETE FROM wallet_challenges WHERE id=?').run(challenge.id);let signer;try{signer=verifyMessage(challenge.message,body.signature)}catch{fail(401,'Invalid wallet signature')}if(!same(signer,challenge.address))fail(401,'Wallet signature does not match.');const secret=randomBytes(32).toString('hex');if(token)db.prepare('DELETE FROM wallet_sessions WHERE token=?').run(hash(token));db.prepare('DELETE FROM wallet_sessions WHERE expires<?').run(now);db.prepare('INSERT INTO wallet_sessions VALUES (?,?,?,?)').run(scope,hash(secret),challenge.address,now+86400000);res.setHeader('Set-Cookie',`lc_chain=${secret}; HttpOnly; SameSite=Strict; Path=/api/chain; Max-Age=86400${cookieSuffix}`);return send(200,{address:challenge.address})}
   }
   if(path==='/api/chain/session'&&method==='DELETE'){if(token)db.prepare('DELETE FROM wallet_sessions WHERE token=?').run(hash(token));res.setHeader('Set-Cookie',`lc_chain=; HttpOnly; SameSite=Strict; Path=/api/chain; Max-Age=0${cookieSuffix}`);return send(200,{ok:true})}
   if(path==='/api/chain/profile'&&method==='PATCH'){await requireUser();const data={email:email(body.email)};const duplicate=db.prepare("SELECT id,data FROM metadata WHERE scope=? AND kind='profile' AND id<>?").all(scope,address).some(row=>JSON.parse(row.data).email===data.email);if(duplicate)fail(409,'This email is already used by another wallet.');put('profile',address,data);return send(200,data)}
   let match=path.match(/^\/api\/chain\/items\/(\d+)$/);
   if(match&&method==='PATCH'){await requireUser();const item=await registry.getItemDetails(match[1]);if(!same(item.reporter,address))fail(403,'Only the reporter can attach item data.');const visibility=body.reporterVisibility||'anonymous';if(!['anonymous','name'].includes(visibility))fail(400,'Invalid reporter visibility');let image;try{image=validateProofPhoto(body.image)}catch(e){fail(400,e.message)}const date=text(body.date,'date',10,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>new Date().toISOString().slice(0,10))fail(400,'Invalid report date');put('item',match[1],{image,date,reporterVisibility:visibility});return send(200,{ok:true})}
   match=path.match(/^\/api\/chain\/claims\/(\d+)$/);
   if(match&&method==='PATCH'){await requireUser();const claim=await registry.getClaimDetails(match[1]);if(!same(claim.claimant,address))fail(403,'Only the claimant can attach proof.');const evidence=text(body.evidence,'ownership details',15,2000),salt=text(body.salt,'proof salt',16,100);let evidencePhoto;try{evidencePhoto=validateProofPhoto(body.evidencePhoto)}catch(e){fail(400,e.message)}const commitment='proof:'+keccak256(toUtf8Bytes(JSON.stringify({evidence,evidencePhoto,salt})));if(claim.message!==commitment)fail(400,'Proof does not match the on-chain commitment.');const prior=get('claim',match[1]);put('claim',match[1],{...prior,evidence,evidencePhoto,salt});return send(200,{ok:true})}
   match=path.match(/^\/api\/chain\/claims\/(\d+)\/meeting$/);
   if(match&&method==='PATCH'){await requireUser();const claim=await registry.getClaimDetails(match[1]),item=await registry.getItemDetails(claim.itemId);if(!same(address,claim.claimant)&&!same(address,item.reporter))fail(403,'Only the handover participants can edit arrangements.');if(Number(claim.status)!==1)fail(409,'Only accepted claims can arrange a handover.');put('claim',match[1],{...get('claim',match[1]),meeting:text(body.meeting,'meeting details',5,500)});return send(200,{ok:true})}
   if(path==='/api/chain/read'&&method==='POST'){await requireUser();if(!Array.isArray(body.ids)||body.ids.length>500||body.ids.some(id=>typeof id!=='string'||id.length>200))fail(400,'Invalid notification IDs');const read=new Set(get('read',address).ids||[]);body.ids.forEach(id=>read.add(id));put('read',address,{ids:[...read]});return send(200,{ok:true})}
   if(path==='/api/chain/state'&&method==='GET'){
    const rawItems=await registry.getItems();const profiles=new Map();
    const profile=async wallet=>{const key=wallet.toLowerCase();if(!profiles.has(key)){const member=await identity.getUserProfile(wallet);profiles.set(key,{name:member.name,role:Number(member.role)===0?'Student':'Staff',address:key,registeredAt:new Date(Number(member.registeredAt)*1000).toISOString(),registrationStatus:'Registered'})}return profiles.get(key)};
    const members=await identity.getRegisteredUsers();await Promise.all(members.map(profile));
    const registered=address&&await identity.isRegistered(address);const user=registered?{...await profile(address),email:get('profile',address).email||''}:null;
    if(user && identity.interface.hasFunction('memberTokenId') && registry.interface.hasFunction('RETURN_REWARD')){user.tokens={identityId:String(await identity.memberTokenId(address)),points:String(await registry.balanceOf(address)),symbol:await registry.symbol(),identityAddress:config.identity.address,pointsAddress:config.registry.address};}
    const allClaims=[];const items=await Promise.all(rawItems.map(async item=>{const id=String(item.id),extra=get('item',id),owner=await profile(item.reporter);const rawClaims=await registry.getClaimsForItem(item.id);for(const claim of rawClaims)allClaims.push({raw:claim,item,extra:get('claim',String(claim.id))});const type=Number(item.itemType)===0?'Lost':'Found';return {id,reporter:owner.address,name:item.title,category:item.category,description:item.description,location:item.location,reportType:type,status:Number(item.status)===3?'Returned':Number(item.status)===4?'Closed':type,date:extra.date||new Date(Number(item.dateReported)*1000).toISOString().slice(0,10),createdAt:new Date(Number(item.dateReported)*1000).toISOString(),image:extra.image||'',reporterVisibility:extra.reporterVisibility||'anonymous',...(extra.reporterVisibility==='name'?{reporterName:owner.name}:{})}}));
    const itemMap=new Map(items.map(i=>[i.id,i]));const claimMap=new Map(allClaims.map(entry=>[String(entry.raw.id),entry]));
    const statuses=['Pending','Accepted','Rejected','Cancelled','Completed'];
    const claims=user?await Promise.all(allClaims.filter(({raw,item})=>same(raw.claimant,address)||same(item.reporter,address)).map(async({raw,item,extra})=>({id:String(raw.id),itemId:String(raw.itemId),owner:raw.claimant.toLowerCase(),name:(await profile(raw.claimant)).name,status:statuses[Number(raw.status)],evidence:extra.evidence||'Private proof has not been synced yet.',evidencePhoto:extra.evidencePhoto||'',meeting:extra.meeting||'',receivedAt:(Number(item.itemType)===0?raw.reporterConfirmed:raw.claimantConfirmed)?'confirmed':null,handedOverAt:(Number(item.itemType)===0?raw.claimantConfirmed:raw.reporterConfirmed)?'confirmed':null,date:'',completedAt:null}))) : [];
    const notifications=[],activities=[];const readIds=new Set(user?(get('read',address).ids||[]):[]);
    if(user){const logs=await eventLogs(config);const txs=new Map(),blocks=new Map();for(const log of logs){let event;try{event=registry.interface.parseLog(log)}catch{continue}if(!event)continue;const name=event.name;const itemId=name==='ItemReported'||name==='ItemClosed'?String(event.args.itemId):name==='ItemReturned'?String(event.args.itemId):String(claimMap.get(String(event.args.claimId))?.raw.itemId);const item=itemMap.get(itemId);if(!item)continue;const claimId=event.args.claimId===undefined?null:String(event.args.claimId),entry=claimMap.get(claimId);if(!txs.has(log.transactionHash))txs.set(log.transactionHash,await provider.getTransaction(log.transactionHash));const sender=txs.get(log.transactionHash).from.toLowerCase();if(!blocks.has(log.blockNumber))blocks.set(log.blockNumber,await provider.getBlock(log.blockNumber));const date=new Date(blocks.get(log.blockNumber).timestamp*1000).toISOString();const actorName=same(sender,item.reporter)?reporterLabel(item):(await profile(sender)).name;const texts={ItemReported:`${actorName} reported a ${item.reportType.toLowerCase()} item: ${item.name}.`,ClaimSubmitted:item.reportType==='Lost'?`${actorName} found your lost item: ${item.name}.`:`${actorName} submitted a claim for ${item.name}.`,ClaimAccepted:`${actorName} accepted your request for ${item.name}.`,ClaimRejected:`Your request for ${item.name} was rejected.`,ClaimCancelled:`The request for ${item.name} was cancelled.`,HandoverConfirmed:`${actorName} confirmed their side of the handover for ${item.name}.`,ItemReturned:`${item.name} has been returned. Both parties confirmed.`,ItemClosed:`${item.name} was closed by its reporter.`};if(!texts[name])continue;
     const related=same(item.reporter,address)||same(entry?.raw.claimant,address);const reportNotice=name==='ItemReported'&&new Date(date)>=new Date(user.registeredAt);const recipient=reportNotice||name==='ClaimSubmitted'&&same(item.reporter,address)||['ClaimAccepted','ClaimRejected','ClaimCancelled','HandoverConfirmed','ItemReturned'].includes(name)&&related;
     const id=`${log.transactionHash}:${log.index}`;if(recipient&&!same(sender,address))notifications.push({id,kind:reportNotice?'report':'claim',itemId,claimId,text:texts[name],date,read:readIds.has(id)});
     if(related||same(sender,address))activities.push({id,text:texts[name],date});const mapped=claims.find(c=>c.id===claimId);if(mapped){if(name==='ClaimSubmitted')mapped.date=date.slice(0,10);if(name==='ItemReturned')mapped.completedAt=date;if(name==='HandoverConfirmed'){if(same(sender,item.reportType==='Lost'?item.reporter:mapped.owner))mapped.receivedAt=date;else mapped.handedOverAt=date}}
    }}
    return send(200,{user,items:items.reverse(),claims,notifications:notifications.reverse(),activities:activities.reverse(),newReportIds:[...new Set(notifications.filter(n=>n.kind==='report'&&!n.read).map(n=>n.itemId))],community:{total:profiles.size,initials:[...profiles.values()].slice(-4).map(p=>p.name[0].toUpperCase())},deploymentId:scope,chainId});
   }
   fail(404,'API route not found');
  }catch(error){if(!error.status)console.error('Blockchain API request failed:',error.code||error.name);send(error.status||503,{error:error.status?error.message:'Blockchain unavailable. Check the RPC and deployment configuration.'})}
 });
 return {server,db,provider,close:()=>new Promise(resolve=>server.close(()=>{provider.destroy();db.close();resolve()}))};
}
