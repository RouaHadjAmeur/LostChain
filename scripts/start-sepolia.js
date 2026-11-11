import {spawn} from 'node:child_process';
import {access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {probeService} from './service-check.js';
const root=fileURLToPath(new URL('../',import.meta.url));process.chdir(root);
try{process.loadEnvFile('.env.sepolia.local')}catch(error){if(error.code!=='ENOENT')throw error}
const prepare=process.argv.includes('--prepare'),apiPort=prepare?3004:3003,webPort=prepare?5176:5175,mode=prepare?'deploy':'sepolia';
const children=[];let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;for(const child of children)if(child.exitCode===null)child.kill('SIGTERM');process.exitCode=code}
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>stop());
function start(args,extra={}){const child=spawn(process.execPath,args,{cwd:root,stdio:'inherit',env:{...process.env,...extra}});children.push(child);child.on('error',()=>stop(1));return child}
async function ready(url,matches,child){for(let i=0;i<120;i++){if(child.exitCode!==null)throw new Error('A Sepolia service stopped during startup.');try{if(await probeService(url,matches))return}catch(error){if(i===119)throw error}await new Promise(resolve=>setTimeout(resolve,500))}throw new Error('Service did not become ready.')}
try{
 if(prepare){const build=spawn(process.execPath,['node_modules/hardhat/dist/src/cli.js','build'],{cwd:root+'blockchain',stdio:'inherit',env:process.env});children.push(build);
 if(await new Promise((resolve,reject)=>{build.on('exit',resolve);build.on('error',reject)})!==0)throw new Error('Contract build failed.');
 }else await access('blockchain/deployments/sepolia.json');
 const apiUrl=`http://127.0.0.1:${apiPort}/api/${prepare?'deployment/config':'chain/config'}`;
 const matches=prepare?data=>data.chainId===11155111&&!!data.token:data=>data.chainId===11155111;
 const apiRunning=await probeService(apiUrl,matches);
 const webUrl=`http://127.0.0.1:${webPort}/__lostchain/status`;
 const webMatches=data=>data.app==='LostChain'&&data.buildMode===mode;
 const webRunning=await probeService(webUrl,webMatches);
 if(!apiRunning){const api=start([prepare?'scripts/deployment-server.js':'server/chain-index.js'],{CHAIN_ID:'11155111',CHAIN_API_PORT:String(apiPort),APP_ORIGIN:`http://127.0.0.1:${webPort}`,CHAIN_RPC_URL:process.env.SEPOLIA_RPC_URL||'https://ethereum-sepolia-rpc.publicnode.com'});api.on('exit',code=>{if(!stopping)stop(code||0)});await ready(apiUrl,matches,api)}
 if(!webRunning){const web=start(['node_modules/vite/bin/vite.js','--mode',mode,'--host','127.0.0.1','--port',String(webPort),'--strictPort']);web.on('exit',code=>{if(!stopping)stop(code||0)});await ready(webUrl,webMatches,web)}
 console.log(`LostChain ${prepare?'deployment assistant':'Sepolia'}: http://127.0.0.1:${webPort}/${prepare?'deploy':''}`);
}catch(error){console.error(error.code==='ENOENT'?'Sepolia deployment missing. Run npm run sepolia:prepare first.':error.message);stop(1)}
