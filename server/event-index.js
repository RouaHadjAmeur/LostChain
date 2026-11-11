// Incremental in-memory index; rescan a short tail for testnet reorganizations.
// Restarting the API rebuilds the index from the deployment block.
export function createEventIndex(provider,{range=10,reorgDepth=12}={}){
 let scope=null,cursor=-1,logs=[],pending=null;
 async function update(config){
  const id=`${config.chainId}:${config.deploymentId}:${config.registry.address}`;
  const latest=await provider.getBlockNumber();
  if(id!==scope||latest<cursor){scope=id;cursor=config.deploymentBlock-1;logs=[]}
  const from=Math.max(config.deploymentBlock,cursor-reorgDepth+1);
  const next=logs.filter(log=>log.blockNumber<from);
  for(let start=from;start<=latest;start+=range)next.push(...await provider.getLogs({address:config.registry.address,fromBlock:start,toBlock:Math.min(start+range-1,latest)}));
  logs=next;cursor=latest;return [...logs];
 }
 return async config=>{if(pending)await pending;pending=update(config);try{return await pending}finally{pending=null}};
}
