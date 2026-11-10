import {readFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createChainApp} from './chain-app.js';
const filename=process.env.CHAIN_DATABASE_PATH||'server/data/chain.sqlite';await mkdir(dirname(filename),{recursive:true});
const app=createChainApp({filename,origin:process.env.APP_ORIGIN||'http://127.0.0.1:5174',getConfig:async()=>JSON.parse(await readFile('blockchain/deployments/localhost.json','utf8'))});
app.server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'LostChain metadata port is already in use. Run npm run local:start to reuse existing services.':error.message);app.provider.destroy();app.db.close();process.exit(1)});
app.server.listen(Number(process.env.CHAIN_API_PORT||3002),'127.0.0.1',()=>console.log('LostChain local metadata API listening on 127.0.0.1:3002'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await app.close();process.exit(0)});
