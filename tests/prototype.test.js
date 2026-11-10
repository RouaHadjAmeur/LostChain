import {test} from 'node:test';
import {reporterLabel} from '../src/services/prototype/reporter.js';
import assert from 'node:assert/strict';
import {createPrototypeRepository,STORAGE_KEY} from '../src/services/prototype/repository.js';
function storage(){const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}}
const account=(email,role='Student')=>({email,name:email.split('@')[0],role,password:'Testing123!'});
const itemData={name:'Green water bottle',category:'Accessories',description:'Insulated bottle with a campus sticker.',location:'North Library',date:'2026-01-01',status:'Found',image:''};
const evidence='A small star sticker is underneath the bottle.';
for(const reporterRole of ['Student','Staff'])for(const first of ['receive','handover'])test(`${reporterRole} reporter: complete journey, ${first} first, persisted between accounts`,async()=>{
 const disk=storage();let repo=createPrototypeRepository(disk);
 const reporter=await repo.register(account('reporter@campus.edu',reporterRole));
 const item=repo.createItem(itemData);repo.logout();
 const claimant=await repo.register(account('claimant@campus.edu',reporterRole==='Student'?'Staff':'Student'));
 const claim=repo.createClaim({itemId:item.id,evidence});
 assert.throws(()=>repo.claimAction(claim.id,'accept'),/Only the item reporter/);
 assert.throws(()=>repo.claimAction(claim.id,'receive'),/Accept the claim/);
 repo.logout();await repo.login(account('reporter@campus.edu'));
 assert.ok(repo.snapshot().notifications.some(n=>n.claimId===claim.id&&!n.read));
 repo.markNotificationsRead();assert.ok(repo.snapshot().notifications.every(n=>n.read));
 repo.claimAction(claim.id,'accept');repo.arrangeHandover(claim.id,'Library reception at noon.');
 assert.equal(repo.snapshot().items.find(i=>i.id===item.id).status,'Found');
 if(first==='receive'){repo.logout();await repo.login(account('claimant@campus.edu'))}
 repo.claimAction(claim.id,first);
 assert.equal(repo.snapshot().claims.find(c=>c.id===claim.id).status,'Accepted');
 assert.equal(repo.snapshot().items.find(i=>i.id===item.id).status,'Found');
 assert.throws(()=>repo.claimAction(claim.id,first),/already been confirmed/);
 repo=createPrototypeRepository(disk); // Browser reload restores the session and partial confirmation.
 assert.equal(repo.snapshot().user.address,first==='receive'?claimant.address:reporter.address);
 assert.equal(repo.snapshot().claims.find(c=>c.id===claim.id).meeting,'Library reception at noon.');
 repo.logout();await repo.login(account(first==='receive'?'reporter@campus.edu':'claimant@campus.edu'));
 repo.claimAction(claim.id,first==='receive'?'handover':'receive');
 const completed=repo.snapshot().claims.find(c=>c.id===claim.id);assert.equal(completed.status,'Completed');assert.ok(completed.receivedAt&&completed.handedOverAt);assert.equal(repo.snapshot().items.find(i=>i.id===item.id).status,'Returned');
 repo=createPrototypeRepository(disk);assert.equal(repo.snapshot().claims.find(c=>c.id===claim.id).status,'Completed');
 assert.throws(()=>repo.claimAction(claim.id,'handover'),/Accept the claim/);
});
test('reject, duplicate/self claims, unrelated members, competing requests and role parity',async()=>{
 const repo=createPrototypeRepository(storage());await repo.register(account('reporter@campus.edu'));const item=repo.createItem(itemData);
 assert.throws(()=>repo.createClaim({itemId:item.id,evidence}),/another member/);
 repo.logout();await repo.register(account('a@campus.edu'));const a=repo.createClaim({itemId:item.id,evidence});assert.throws(()=>repo.createClaim({itemId:item.id,evidence}),/already submitted/);
 repo.logout();await repo.register(account('b@campus.edu','Staff'));const b=repo.createClaim({itemId:item.id,evidence});assert.throws(()=>repo.claimAction(a.id,'accept'),/Only the item reporter/);assert.throws(()=>repo.arrangeHandover(a.id,'Meet today.'),/Only the participants/);
 repo.logout();await repo.login(account('reporter@campus.edu'));repo.claimAction(a.id,'reject');assert.equal(repo.snapshot().claims.find(c=>c.id===a.id).status,'Rejected');repo.claimAction(b.id,'accept');assert.throws(()=>repo.claimAction(b.id,'reject'),/cannot be reviewed/);
 repo.logout();await repo.register(account('c@campus.edu'));assert.equal(repo.snapshot().claims.length,0);assert.throws(()=>repo.claimAction(b.id,'receive'),/Only the claimant/);assert.throws(()=>repo.createClaim({itemId:item.id,evidence}),/already arranged/);
});
test('registration, login, profile, input validation and storage failure are handled',async()=>{
 const disk=storage(),repo=createPrototypeRepository(disk);await assert.rejects(repo.register(account('invalid-email')),/valid campus email/);await assert.rejects(repo.register({...account('a@campus.edu'),role:'Admin'}),/Student or Staff/);await assert.rejects(repo.register({...account('a@campus.edu'),password:'123'}),/8–128/);
 await repo.register(account('a@campus.edu'));await assert.rejects(repo.register(account('A@CAMPUS.EDU')),/already registered/);repo.logout();await assert.rejects(repo.login({...account('a@campus.edu'),password:'bad'}),/Incorrect/);await repo.login(account('A@CAMPUS.EDU'));repo.updateProfile({name:'Updated Name',email:'new@campus.edu',role:'Staff'});assert.equal(createPrototypeRepository(disk).snapshot().user.name,'Updated Name');repo.logout();await repo.login(account('new@campus.edu'));assert.equal(repo.snapshot().user.role,'Staff');
 assert.throws(()=>repo.createItem({...itemData,name:'   '}),/Item name/);assert.throws(()=>repo.createItem({...itemData,date:'2026-02-30'}),/valid date/);assert.throws(()=>repo.createItem({...itemData,image:'javascript:bad'}),/photo/);assert.throws(()=>repo.createItem({...itemData,status:'Returned'}),/valid category/);
 const before=disk.getItem(STORAGE_KEY);disk.setItem=()=>{throw new Error('QuotaExceeded')};assert.throws(()=>repo.createItem(itemData),/storage is full/);assert.equal(disk.getItem(STORAGE_KEY),before);
});
test('acceptance rejects competing claims immediately and only the selected claim can complete',async()=>{
 const repo=createPrototypeRepository(storage());await repo.register(account('reporter@campus.edu'));const item=repo.createItem(itemData);repo.logout();await repo.register(account('a@campus.edu'));const a=repo.createClaim({itemId:item.id,evidence});repo.logout();await repo.register(account('b@campus.edu'));const b=repo.createClaim({itemId:item.id,evidence});repo.logout();await repo.login(account('reporter@campus.edu'));repo.claimAction(a.id,'accept');assert.equal(repo.snapshot().claims.find(c=>c.id===b.id).status,'Rejected');assert.throws(()=>repo.claimAction(b.id,'accept'),/cannot be reviewed/);repo.claimAction(a.id,'handover');repo.logout();await repo.login(account('a@campus.edu'));repo.claimAction(a.id,'receive');repo.logout();await repo.login(account('reporter@campus.edu'));assert.equal(repo.snapshot().claims.find(c=>c.id===b.id).status,'Rejected');
});
test('noticeboard starts empty and user reports persist across sessions',async()=>{
 const disk=storage();let repo=createPrototypeRepository(disk);
 assert.deepEqual(repo.snapshot().items,[]);assert.deepEqual(repo.snapshot().claims,[]);
 await repo.register(account('real-reporter@campus.edu'));const found=repo.createItem(itemData),lost=repo.createItem({...itemData,status:'Lost',name:'Missing notebook'});
 repo=createPrototypeRepository(disk);assert.deepEqual(repo.snapshot().items.map(i=>i.id),[lost.id,found.id]);repo.logout();assert.equal(repo.snapshot().items.length,2);
});
test('upgrade removes legacy examples without removing user reports or recovery data',async()=>{
 const disk=storage(),repo=createPrototypeRepository(disk);const user=await repo.register(account('member@campus.edu'));const real=repo.createItem(itemData);
 const state=JSON.parse(disk.getItem(STORAGE_KEY));state.version=1;state.items.push({id:'LC-1042',name:'Seeded headphones'});state.claims.push({id:'CL-demo',itemId:'LC-1042'},{id:'CL-real',itemId:real.id,owner:user.address,status:'Pending'});state.notifications.push({id:'N-demo',claimId:'CL-demo',recipient:user.address},{id:'N-real',claimId:'CL-real',recipient:user.address});state.activities.push({id:'A-LC-1042',participants:[user.address]},{id:'A-CL-demo',participants:[user.address]});disk.setItem(STORAGE_KEY,JSON.stringify(state));
 const upgraded=createPrototypeRepository(disk).snapshot();assert.deepEqual(upgraded.items.map(i=>i.id),[real.id]);assert.deepEqual(upgraded.claims.map(c=>c.id),['CL-real']);assert.deepEqual(upgraded.notifications.map(n=>n.id),['N-real']);assert.ok(!upgraded.activities.some(a=>a.id==='A-LC-1042'||a.id==='A-CL-demo'));assert.equal(upgraded.user.address,user.address);assert.equal(JSON.parse(disk.getItem(STORAGE_KEY)).version,4);assert.equal(createPrototypeRepository(disk).snapshot().items.length,1);
});
test('community preview shows registered members, excludes demos and persists profile changes',async()=>{
 const disk=storage(),repo=createPrototypeRepository(disk);
 assert.deepEqual(repo.snapshot().community,{total:0,initials:[]});
 assert.equal(JSON.parse(disk.getItem(STORAGE_KEY)).users.length,0);
 await repo.register({...account('community@campus.edu'),name:'Rania'});
 assert.deepEqual(repo.snapshot().community,{total:1,initials:['R']});
 repo.updateProfile({name:'Lina',email:'community@campus.edu',role:'Student'});
 assert.deepEqual(createPrototypeRepository(disk).snapshot().community,{total:1,initials:['L']});
 repo.logout();assert.deepEqual(repo.snapshot().community,{total:1,initials:['L']});
 assert.equal(JSON.stringify(repo.snapshot().community).includes('community@campus.edu'),false);
});
for(const role of ['Student','Staff'])test(`${role}: claimant cancels only their pending claim; reporter closes only open reports`,async()=>{
 const disk=storage();let repo=createPrototypeRepository(disk);
 await repo.register(account('reporter@campus.edu',role));const item=repo.createItem(itemData);const lost=repo.createItem({...itemData,status:'Lost'});
 repo.logout();await repo.register(account('claimant@campus.edu'));const claim=repo.createClaim({itemId:item.id,evidence});
 assert.throws(()=>repo.closeItem(item.id),/Only the reporter/);repo.logout();assert.throws(()=>repo.closeItem(item.id),/sign in/);assert.throws(()=>repo.claimAction(claim.id,'cancel'),/sign in/);
 await repo.login(account('reporter@campus.edu'));assert.throws(()=>repo.claimAction(claim.id,'cancel'),/Only the claimant/);
 repo.logout();await repo.login(account('claimant@campus.edu'));repo.claimAction(claim.id,'cancel');
 repo=createPrototypeRepository(disk);assert.equal(repo.snapshot().claims.find(c=>c.id===claim.id).status,'Cancelled');assert.equal(repo.snapshot().items.find(i=>i.id===item.id).status,'Found');
 assert.throws(()=>repo.claimAction(claim.id,'cancel'),/Only pending/);assert.throws(()=>repo.createClaim({itemId:item.id,evidence}),/already submitted/);
 repo.logout();await repo.login(account('reporter@campus.edu'));assert.ok(repo.snapshot().notifications.some(n=>n.claimId===claim.id&&n.text.includes('cancelled')));repo.closeItem(item.id);repo.closeItem(lost.id);assert.equal(repo.snapshot().items.find(i=>i.id===lost.id).status,'Closed');assert.throws(()=>repo.closeItem(item.id),/cannot be closed/);
});
test('closing an item cancels pending claims and notifies claimants, surviving refresh',async()=>{
 const disk=storage(),repo=createPrototypeRepository(disk);await repo.register(account('reporter@campus.edu'));const item=repo.createItem(itemData);
 repo.logout();await repo.register(account('claimant@campus.edu'));const claim=repo.createClaim({itemId:item.id,evidence});
 repo.logout();await repo.login(account('reporter@campus.edu'));repo.closeItem(item.id);assert.equal(repo.snapshot().claims.find(c=>c.id===claim.id).status,'Cancelled');assert.equal(createPrototypeRepository(disk).snapshot().items.find(i=>i.id===item.id).status,'Closed');
 assert.throws(()=>repo.claimAction(claim.id,'accept'),/cannot be reviewed/);
 repo.logout();await repo.login(account('claimant@campus.edu'));assert.ok(repo.snapshot().notifications.some(n=>n.claimId===claim.id&&n.text.includes('closed by the reporter')));assert.throws(()=>repo.createClaim({itemId:item.id,evidence}),/available found item/);
});
test('accepted handovers cannot be cancelled, rejected or closed, including after the first confirmation',async()=>{
 const repo=createPrototypeRepository(storage());await repo.register(account('reporter@campus.edu'));const item=repo.createItem(itemData);repo.logout();await repo.register(account('claimant@campus.edu'));const claim=repo.createClaim({itemId:item.id,evidence});repo.logout();await repo.login(account('reporter@campus.edu'));repo.claimAction(claim.id,'accept');
 assert.throws(()=>repo.closeItem(item.id),/cannot be closed/);assert.throws(()=>repo.claimAction(claim.id,'reject'),/cannot be reviewed/);repo.claimAction(claim.id,'handover');assert.throws(()=>repo.closeItem(item.id),/cannot be closed/);
 repo.logout();await repo.login(account('claimant@campus.edu'));assert.throws(()=>repo.claimAction(claim.id,'cancel'),/Only pending/);repo.claimAction(claim.id,'receive');repo.logout();await repo.login(account('reporter@campus.edu'));assert.throws(()=>repo.closeItem(item.id),/cannot be closed/);
});
test('acceptance notifies competing claimants immediately',async()=>{
 const repo=createPrototypeRepository(storage());await repo.register(account('reporter@campus.edu'));const item=repo.createItem(itemData);repo.logout();await repo.register(account('a@campus.edu'));const a=repo.createClaim({itemId:item.id,evidence});repo.logout();await repo.register(account('b@campus.edu'));const b=repo.createClaim({itemId:item.id,evidence});repo.logout();await repo.login(account('reporter@campus.edu'));repo.claimAction(a.id,'accept');repo.logout();await repo.login(account('b@campus.edu'));assert.equal(repo.snapshot().claims.find(c=>c.id===b.id).status,'Rejected');assert.ok(repo.snapshot().notifications.some(n=>n.claimId===b.id&&n.text.includes('rejected')));
});
test('upgrading stored handovers rejects competing pending claims without losing confirmations',async()=>{
 const disk=storage(),repo=createPrototypeRepository(disk);await repo.register(account('reporter@campus.edu'));const item=repo.createItem(itemData);const state=JSON.parse(disk.getItem(STORAGE_KEY));state.version=2;state.claims=[{id:'accepted',itemId:item.id,status:'Accepted',handedOverAt:'2026-01-02'},{id:'pending',itemId:item.id,status:'Pending'}];disk.setItem(STORAGE_KEY,JSON.stringify(state));const updated=createPrototypeRepository(disk).snapshot();assert.equal(updated.claims.find(c=>c.id==='pending').status,'Rejected');assert.equal(updated.claims.find(c=>c.id==='accepted').handedOverAt,'2026-01-02');assert.equal(updated.items.find(i=>i.id===item.id).status,'Found');
});
test('new reports notify other members and keep per-member unread counts after refresh',async()=>{
 const disk=storage();let repo=createPrototypeRepository(disk);await repo.register(account('second-reader@campus.edu'));repo.logout();await repo.register(account('reader@campus.edu'));repo.logout();await repo.register(account('reporter@campus.edu'));
 const first=repo.createItem(itemData),second=repo.createItem({...itemData,name:'Lost notebook',status:'Lost'});
 assert.deepEqual(repo.snapshot().newReportIds,[]);assert.ok(first.createdAt);
 repo.logout();await repo.login(account('reader@campus.edu'));repo=createPrototypeRepository(disk);
 assert.deepEqual(new Set(repo.snapshot().newReportIds),new Set([first.id,second.id]));
 const notice=repo.snapshot().notifications.find(n=>n.itemId===first.id);assert.equal(notice.kind,'report');assert.equal(notice.read,false);assert.ok(notice.text.includes(first.name));
 repo.markReportsSeen([first.id]);assert.deepEqual(repo.snapshot().newReportIds,[second.id]);repo=createPrototypeRepository(disk);assert.deepEqual(repo.snapshot().newReportIds,[second.id]);repo.markReportsSeen([second.id]);assert.deepEqual(repo.snapshot().newReportIds,[]);
 repo.logout();await repo.login(account('second-reader@campus.edu'));assert.equal(repo.snapshot().newReportIds.length,2);repo.markNotificationsRead();assert.equal(repo.snapshot().newReportIds.length,0);
});
test('marking reports seen preserves claim notifications and does not backfill old reports to new members',async()=>{
 const disk=storage(),repo=createPrototypeRepository(disk);await repo.register(account('reporter@campus.edu'));repo.createItem(itemData);repo.logout();const observer=await repo.register(account('reader@campus.edu'));assert.equal(repo.snapshot().newReportIds.length,0);
 repo.logout();await repo.login(account('reporter@campus.edu'));const item=repo.createItem(itemData);repo.logout();await repo.login(account('reader@campus.edu'));
 const data=JSON.parse(disk.getItem(STORAGE_KEY));data.notifications.push({id:'claim-notice',recipient:observer.address,claimId:'claim-id',read:false,text:'A claim update'});disk.setItem(STORAGE_KEY,JSON.stringify(data));
 repo.markReportsSeen([item.id]);assert.equal(repo.snapshot().notifications.find(n=>n.id==='claim-notice').read,false);assert.equal(repo.snapshot().newReportIds.length,0);
 repo.createItem(itemData);assert.equal(repo.snapshot().newReportIds.length,0);
});
test('legacy demo cleanup removes unused accounts while preserving registered accounts and report owners',async()=>{
 const disk=storage(),repo=createPrototypeRepository(disk);const member=await repo.register(account('real@campus.edu'));const report=repo.createItem(itemData);
 const state=JSON.parse(disk.getItem(STORAGE_KEY));state.version=3;const unused='0x32a9188f794A0f645892a85f52f1233d58C64BA9',used='0x71C7656EC7ab88b098defB751B7401B5f6d8976F';state.users.push({address:unused,email:'sarah@campus.edu',registrationStatus:'Registered',name:'Sarah'},{address:used,email:'alex@campus.edu',registrationStatus:'Registered',name:'Alex'});state.items.push({...report,id:'historical-report',reporter:used});disk.setItem(STORAGE_KEY,JSON.stringify(state));
 const snapshot=createPrototypeRepository(disk).snapshot(),saved=JSON.parse(disk.getItem(STORAGE_KEY));assert.equal(saved.users.some(u=>u.address===unused),false);assert.equal(saved.users.find(u=>u.address===used).legacyDemo,true);assert.equal(snapshot.user.address,member.address);assert.equal(snapshot.items.length,2);assert.equal(snapshot.community.total,1);assert.equal(saved.version,4);
});

for(const reportType of ['Lost','Found'])test(`${reportType} report: reporter chooses name or anonymity and choice survives refresh`,async()=>{
 const disk=storage(),repo=createPrototypeRepository(disk);await repo.register({...account('reader@campus.edu'),name:'Reader'});repo.logout();const reporter=await repo.register({...account('reporter@campus.edu'),name:'Private Reporter'});
 const anonymous=repo.createItem({...itemData,status:reportType,reporterVisibility:'anonymous',reporterName:'Spoofed Name'});
 const named=repo.createItem({...itemData,status:reportType,reporterVisibility:'name',reporterName:'Spoofed Name'});
 assert.equal(anonymous.reporterName,undefined);assert.ok(reporterLabel(anonymous).startsWith('Anonymous · LC-'));assert.ok(!reporterLabel(anonymous).includes('Private Reporter'));assert.equal(reporterLabel(named),'Private Reporter');assert.equal(anonymous.reporter,reporter.address);
 const refreshed=createPrototypeRepository(disk).snapshot();assert.equal(reporterLabel(refreshed.items.find(i=>i.id===named.id)),'Private Reporter');assert.equal(refreshed.items.find(i=>i.id===anonymous.id).reporterVisibility,'anonymous');
 repo.logout();await repo.login(account('reader@campus.edu'));assert.ok(!repo.snapshot().notifications.find(n=>n.itemId===anonymous.id).text.includes('Private Reporter'));assert.ok(repo.snapshot().notifications.find(n=>n.itemId===named.id).text.includes('Private Reporter'));
});
test('anonymous reporters stay unnamed in claim decisions and handover arrangements',async()=>{
 const repo=createPrototypeRepository(storage());await repo.register({...account('reporter@campus.edu'),name:'Hidden Person'});const item=repo.createItem({...itemData,reporterVisibility:'anonymous'});repo.logout();await repo.register(account('claimant@campus.edu'));const claim=repo.createClaim({itemId:item.id,evidence});repo.logout();await repo.login(account('reporter@campus.edu'));repo.claimAction(claim.id,'accept');repo.arrangeHandover(claim.id,'Campus reception at noon.');repo.claimAction(claim.id,'handover');repo.logout();await repo.login(account('claimant@campus.edu'));assert.ok(repo.snapshot().notifications.length>=3);assert.ok(repo.snapshot().notifications.every(n=>!n.text.includes('Hidden Person')));assert.ok(repo.snapshot().activities.every(a=>!a.text.includes('Hidden Person')));
});
test('legacy reports remain anonymous and invalid visibility is rejected',async()=>{
 const repo=createPrototypeRepository(storage());await repo.register(account('reporter@campus.edu'));const item=repo.createItem(itemData);assert.equal(item.reporterVisibility,'anonymous');assert.ok(reporterLabel({reporter:item.reporter}).startsWith('Anonymous ·'));assert.throws(()=>repo.createItem({...itemData,reporterVisibility:'public-email'}),/show your name/);
});
const proofPhoto='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
test('claim photos persist and are visible to the claimant and reporter only',async()=>{
 const disk=storage();let repo=createPrototypeRepository(disk);await repo.register(account('reporter@campus.edu'));const item=repo.createItem(itemData);repo.logout();await repo.register(account('claimant@campus.edu'));const claim=repo.createClaim({itemId:item.id,evidence,evidencePhoto:proofPhoto});assert.equal(claim.evidencePhoto,proofPhoto);repo=createPrototypeRepository(disk);assert.equal(repo.snapshot().claims.find(c=>c.id===claim.id).evidencePhoto,proofPhoto);
 repo.logout();await repo.login(account('reporter@campus.edu'));assert.equal(repo.snapshot().claims.find(c=>c.id===claim.id).evidencePhoto,proofPhoto);assert.ok(!JSON.stringify(repo.snapshot().notifications).includes(proofPhoto));assert.ok(!JSON.stringify(repo.snapshot().items).includes(proofPhoto));repo.logout();assert.equal(repo.snapshot().claims.length,0);await repo.register(account('outsider@campus.edu'));assert.equal(repo.snapshot().claims.length,0);
});
test('proof photo is optional; invalid, unsupported and oversized photos cannot create claims',async()=>{
 const disk=storage(),repo=createPrototypeRepository(disk);await repo.register(account('reporter@campus.edu'));const item=repo.createItem(itemData);repo.logout();await repo.register(account('claimant@campus.edu'));
 for(const evidencePhoto of ['https://example.com/photo.png','data:image/svg+xml;base64,AAAA','data:image/png;base64,??',{},'data:image/png;base64,'+'A'.repeat(2796208)]){assert.throws(()=>repo.createClaim({itemId:item.id,evidence,evidencePhoto}),/proof photo|Proof photos/);assert.equal(repo.snapshot().claims.length,0)}
 const claim=repo.createClaim({itemId:item.id,evidence});assert.equal(claim.evidencePhoto,'');
});
test('failed photo claim storage keeps the item claimable for a retry',async()=>{
 const disk=storage(),repo=createPrototypeRepository(disk);await repo.register(account('reporter@campus.edu'));const item=repo.createItem(itemData);repo.logout();await repo.register(account('claimant@campus.edu'));const save=disk.setItem;disk.setItem=()=>{throw new Error('QuotaExceeded')};assert.throws(()=>repo.createClaim({itemId:item.id,evidence,evidencePhoto:proofPhoto}),/storage is full/);assert.equal(repo.snapshot().claims.length,0);disk.setItem=save;assert.equal(repo.createClaim({itemId:item.id,evidence,evidencePhoto:proofPhoto}).evidencePhoto,proofPhoto);
});
test('reading one notification decrements only its recipient count and persists after refresh',async()=>{
 const disk=storage(),repo=createPrototypeRepository(disk);await repo.register(account('reporter@campus.edu'));const first=repo.createItem(itemData),second=repo.createItem(itemData);repo.logout();await repo.register(account('reader@campus.edu'));repo.logout();await repo.login(account('reporter@campus.edu'));repo.createItem(itemData);repo.createItem(itemData);repo.logout();await repo.login(account('reader@campus.edu'));
 const notices=repo.snapshot().notifications.filter(n=>!n.read);assert.equal(notices.length,2);repo.markNotificationsRead([notices[0].id]);assert.equal(repo.snapshot().notifications.filter(n=>!n.read).length,1);assert.equal(repo.snapshot().newReportIds.length,1);repo.markNotificationsRead([notices[0].id]);assert.equal(repo.snapshot().notifications.filter(n=>!n.read).length,1);assert.equal(createPrototypeRepository(disk).snapshot().notifications.filter(n=>!n.read).length,1);repo.markNotificationsRead();assert.equal(repo.snapshot().notifications.filter(n=>!n.read).length,0);
});
test('read notification selection cannot clear someone else’s notifications or unrelated updates',async()=>{
 const disk=storage(),repo=createPrototypeRepository(disk);const reporter=await repo.register(account('reporter@campus.edu'));const item=repo.createItem(itemData);repo.logout();await repo.register(account('claimant@campus.edu'));repo.createClaim({itemId:item.id,evidence});repo.logout();await repo.login(account('reporter@campus.edu'));const claimNotice=repo.snapshot().notifications.find(n=>n.claimId);repo.logout();await repo.register(account('other@campus.edu'));repo.createItem(itemData);repo.markNotificationsRead([claimNotice.id]);repo.logout();await repo.login(account('reporter@campus.edu'));assert.equal(repo.snapshot().notifications.find(n=>n.id===claimNotice.id).read,false);repo.markNotificationsRead([claimNotice.id]);assert.equal(repo.snapshot().notifications.find(n=>n.id===claimNotice.id).read,true);assert.ok(repo.snapshot().notifications.some(n=>n.kind==='report'&&!n.read));
});
