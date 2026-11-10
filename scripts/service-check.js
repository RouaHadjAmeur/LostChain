export async function probeService(url, matches, fetcher=fetch){
 let response;
 try{response=await fetcher(url,{signal:AbortSignal.timeout(1500)})}
 catch(error){if(error.cause?.code==='ECONNREFUSED'||error.code==='ECONNREFUSED')return false;throw new Error(`Cannot verify the service at ${new URL(url).origin}. It may be busy or unresponsive; leave it running or stop it from its own terminal.`)}
 let data;try{data=await response.json()}catch{throw new Error(`Port ${new URL(url).port} is occupied by an unrecognized service. Stop that service before starting LostChain.`)}
 if(!response.ok||!matches(data))throw new Error(`Port ${new URL(url).port} is occupied by a different service or configuration. Stop it from its own terminal before retrying.`);
 return true;
}
