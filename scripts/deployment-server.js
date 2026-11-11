import {createServer} from 'node:http';
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {randomUUID,randomBytes} from 'node:crypto';
import {Contract,JsonRpcProvider,getCreateAddress,isAddress,HDNodeWallet} from 'ethers';
const origin='http://127.0.0.1:5176',token=randomBytes(32).toString('hex');
const rpc=process.env.SEPOLIA_RPC_URL||'https://ethereum-sepolia-rpc.publicnode.com';
const provider=new JsonRpcProvider(rpc,11155111);
const blockedWallets=Array.from({length:20},(_,index)=>HDNodeWallet.fromPhrase('test test test test test test test test test test test junk',undefined,`m/44'/60'/0'/0/${index}`).address.toLowerCase());
const manifestPath='blockchain/deployments/sepolia.json';
const artifact=async name=>JSON.parse(await readFile(`blockchain/artifacts/contracts/${name}.sol/${name}.json`,'utf8'));
const [identity,registry]=await Promise.all(['CampusIdentity','LostItemRegistry'].map(artifact));
const server=createServer(async(req,res)=>{
 const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))};
 try{
  if(!['127.0.0.1:3004','127.0.0.1:5176'].includes(req.headers.host))return send(403,{error:'Host not allowed'});
  if(req.method==='GET'&&req.url==='/api/deployment/config'){
   let saved=null;try{saved=JSON.parse(await readFile(manifestPath,'utf8'))}catch{}
   return send(200,{token,blockedWallets,chainId:11155111,identity:{abi:identity.abi,bytecode:identity.bytecode},registry:{abi:registry.abi,bytecode:registry.bytecode},saved});
  }
  if(req.method!=='POST'||req.url!=='/api/deployment/save')return send(404,{error:'Not found'});
  if(req.headers.origin!==origin||req.headers['x-deployment-token']!==token)return send(403,{error:'Open the local deployment assistant to save.'});
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096)return send(413,{error:'Payload too large'})}
  const body=JSON.parse(raw);if(blockedWallets.includes(String(body.address).toLowerCase()))return send(400,{error:'Public Hardhat wallets are forbidden on Sepolia'});if(!isAddress(body.address)||![body.identityHash,body.registryHash].every(h=>/^0x[0-9a-fA-F]{64}$/.test(h)))return send(400,{error:'Invalid deployment receipts'});
  if(Number((await provider.getNetwork()).chainId)!==11155111)throw new Error('Wrong RPC network');
  const check=async(hash,expected)=>{const tx=await provider.getTransaction(hash),receipt=await provider.getTransactionReceipt(hash);if(!tx||!receipt||receipt.status!==1||tx.to!==null||tx.from.toLowerCase()!==body.address.toLowerCase()||tx.data.toLowerCase()!==expected.toLowerCase())throw new Error('Deployment transaction does not match the compiled contract and wallet');const address=getCreateAddress(tx);if(receipt.contractAddress?.toLowerCase()!==address.toLowerCase()||await provider.getCode(address)==='0x')throw new Error('Contract not found');return {address,block:receipt.blockNumber}};
  const first=await check(body.identityHash,identity.bytecode);
  const args=first.address.slice(2).toLowerCase().padStart(64,'0');
  const second=await check(body.registryHash,registry.bytecode+args);
  if((await new Contract(second.address,registry.abi,provider).campusIdentity()).toLowerCase()!==first.address.toLowerCase())throw new Error('Registry uses a different identity contract');
  let existing;try{existing=JSON.parse(await readFile(manifestPath,'utf8'))}catch{}
  if(existing&&existing.identity.address.toLowerCase()!==first.address.toLowerCase())return send(409,{error:'A different Sepolia deployment already exists. Preserve or archive its manifest manually first.'});
  const config=existing||{deploymentId:randomUUID(),chainId:11155111,deploymentBlock:Math.min(first.block,second.block),identity:{address:first.address,abi:identity.abi},registry:{address:second.address,abi:registry.abi},transactions:{identity:body.identityHash,registry:body.registryHash}};
  await mkdir('blockchain/deployments',{recursive:true});await writeFile(manifestPath+'.tmp',JSON.stringify(config,null,2)+'\n',{mode:0o600});await rename(manifestPath+'.tmp',manifestPath);
  send(200,{ok:true,config});
 }catch(error){console.error('Deployment verification failed:',error.code||error.name);send(400,{error:'Unable to verify and save the deployment. Check receipts, RPC and network; do not redeploy confirmed transactions.'})}
});
server.listen(3004,'127.0.0.1',()=>console.log('Deployment verifier ready on 127.0.0.1:3004. Open http://127.0.0.1:5176/deploy'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{provider.destroy();process.exit(0)}));
