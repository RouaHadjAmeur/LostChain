import {test} from 'node:test';
import assert from 'node:assert/strict';
import {networkFor,publicConfig} from '../shared/networks.js';
import {createEventIndex} from '../server/event-index.js';
test('public network configuration never exposes a credential-bearing RPC',()=>{
 const cfg=publicConfig({chainId:11155111,rpcUrl:'https://private.example/SECRET',deploymentId:'demo'});
 assert.equal(cfg.chainId,11155111);assert.ok(!JSON.stringify(cfg).includes('SECRET'));
 assert.equal(networkFor(31337).rpcUrl,'http://127.0.0.1:8545');assert.throws(()=>networkFor(1),/Unsupported/);
});
test('event indexing chunks queries, rescans reorg tail and retains previous data on failure',async()=>{
 let height=40,fail=false,calls=[];
 const provider={getBlockNumber:async()=>height,getLogs:async filter=>{calls.push(filter);if(fail)throw new Error('RPC unavailable');return Array.from({length:filter.toBlock-filter.fromBlock+1},(_,i)=>({blockNumber:filter.fromBlock+i}))}};
 const read=createEventIndex(provider,{range:10,reorgDepth:3}),cfg={chainId:11155111,deploymentId:'one',deploymentBlock:10,registry:{address:'registry'}};
 assert.equal((await read(cfg)).length,31);assert.equal(calls.length,4);calls=[];height=42;
 assert.equal((await read(cfg)).length,33);assert.equal(calls[0].fromBlock,38);fail=true;height=44;await assert.rejects(read(cfg));fail=false;
 assert.equal((await read(cfg)).length,35);height=12;assert.equal((await read(cfg)).length,3);
});

test('wallet switching uses Sepolia and a public RPC, never server credentials',async()=>{
 const {createChainRepository}=await import('../src/services/chain/repository.js');
 const previous=globalThis.window,calls=[];
 try{
  globalThis.window={ethereum:{request:async request=>{calls.push(request);if(request.method==='wallet_switchEthereumChain')throw Object.assign(new Error('Missing network'),{code:4902})}}};
  const repository=createChainRepository({fetcher:async()=>({ok:true,json:async()=>publicConfig({chainId:11155111,rpcUrl:'https://private/SECRET'})})});
  await repository.switchNetwork();
  assert.equal(calls[0].params[0].chainId,'0xaa36a7');assert.equal(calls[1].params[0].chainName,'Sepolia');assert.ok(!JSON.stringify(calls).includes('SECRET'));
 }finally{globalThis.window=previous}
});
