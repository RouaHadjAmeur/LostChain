import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {createApp} from './app.js';
const filename=process.env.DATABASE_PATH||'server/data/lostchain.sqlite';mkdirSync(dirname(filename),{recursive:true});
const {server,db}=createApp({filename,staffEmails:(process.env.STAFF_EMAILS||'').split(',').map(e=>e.trim()).filter(Boolean),secureCookies:process.env.NODE_ENV==='production',origin:process.env.APP_ORIGIN||'http://127.0.0.1:5173'});
server.listen(Number(process.env.PORT||3001),'127.0.0.1',()=>console.log('LostChain API: http://127.0.0.1:'+(process.env.PORT||3001)));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{db.close();process.exit(0)}));
