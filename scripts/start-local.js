import {probeService} from './service-check.js';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),chain=fileURLToPath(new URL('../blockchain/',import.meta.url));
const children=[];let stopping=false;
function start(args,{cwd=root,quiet=false,env={}}={}){const child=spawn(process.execPath,args,{cwd,stdio:quiet?'ignore':'inherit',env:{...process.env,...env}});children.push(child);child.on('error',error=>{console.error(error.message);stop(1)});return child}
function stop(code=0){if(stopping)return;stopping=true;children.forEach(child=>{if(child.exitCode===null)child.kill('SIGTERM')});process.exitCode=code}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
async function finished(child){const code=await new Promise(resolve=>child.on('exit',resolve));if(code!==0)throw new Error('Local setup command failed. Check the output above.')}
async function rpc(method,params=[]){const response=await fetch('http://127.0.0.1:8545',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(1500)});const data=await response.json();if(data.error)throw new Error(data.error.message);return data.result}
try{
 await finished(start(['node_modules/hardhat/dist/src/cli.js','build'],{cwd:chain}));
 let chainId;try{chainId=await rpc('eth_chainId')}catch{}
 if(!chainId){console.log('Starting local Hardhat network (31337)…');const node=start(['node_modules/hardhat/dist/src/cli.js','node','--hostname','127.0.0.1'],{cwd:chain,quiet:true});for(let i=0;i<60;i++){if(node.exitCode!==null)throw new Error('Hardhat could not start on 127.0.0.1:8545.');try{chainId=await rpc('eth_chainId');break}catch{await new Promise(resolve=>setTimeout(resolve,500))}}}
 if(Number(chainId)!==31337)throw new Error('Port 8545 is not a local Hardhat chain (31337). Stop the conflicting service first.');
 let deployed=false;try{const config=JSON.parse(await readFile(new URL('../blockchain/deployments/localhost.json',import.meta.url),'utf8'));deployed=(await rpc('eth_getCode',[config.identity.address,'latest']))!=='0x'&&(await rpc('eth_getCode',[config.registry.address,'latest']))!=='0x'}catch{}
 if(!deployed)await finished(start(['node_modules/hardhat/dist/src/cli.js','run','scripts/deploy-local.ts','--network','localhost'],{cwd:chain}));else console.log('Reusing the existing local deployment.');
 const config=JSON.parse(await readFile(new URL('../blockchain/deployments/localhost.json',import.meta.url),'utf8'));
 const apiUrl='http://127.0.0.1:3002/api/chain/config';
 const apiMatches=data=>data.deploymentId===config.deploymentId&&data.chainId===31337;
 const frontendUrl='http://127.0.0.1:5174/__lostchain/status';
 const frontendMatches=data=>data.app==='LostChain'&&data.dataMode==='blockchain';
 // Check both ports before launching anything, so a conflict does not create
 // another watcher or interfere with a service owned by another terminal.
 const apiRunning=await probeService(apiUrl,apiMatches);
 const frontendRunning=await probeService(frontendUrl,frontendMatches);
 async function waitReady(url,matches,child){for(let i=0;i<40;i++){if(child.exitCode!==null)throw new Error('A local service stopped during startup.');if(await probeService(url,matches))return;await new Promise(resolve=>setTimeout(resolve,250))}throw new Error(`Timed out starting ${new URL(url).origin}.`)}
 if(apiRunning)console.log('Reusing the running metadata API on port 3002.');
 else{const api=start(['server/chain-index.js'],{env:{APP_ORIGIN:'http://127.0.0.1:5174'}});api.on('exit',code=>{if(!stopping)stop(code||0)});await waitReady(apiUrl,apiMatches,api)}
 if(frontendRunning)console.log('Reusing the running blockchain frontend on port 5174.');
 else{const frontend=start(['node_modules/vite/bin/vite.js','--mode','chain','--host','127.0.0.1','--port','5174','--strictPort']);frontend.on('exit',code=>{if(!stopping)stop(code||0)});await waitReady(frontendUrl,frontendMatches,frontend)}
 if(apiRunning&&frontendRunning)console.log('LostChain is already running; no duplicate services were started.');
 console.log('Local integration: http://127.0.0.1:5174/ (prototype on port 5173 is untouched).');
}catch(error){console.error(error.message);stop(1)}
