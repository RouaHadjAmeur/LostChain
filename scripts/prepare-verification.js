import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {AbiCoder} from 'ethers';
const manifest=JSON.parse(await readFile('blockchain/deployments/sepolia.json','utf8'));
if(manifest.chainId!==11155111)throw new Error('Expected Sepolia deployment.');
const directory='output/etherscan';await mkdir(directory,{recursive:true});const contracts=[];
for(const [key,name] of [['identity','CampusIdentity'],['registry','LostItemRegistry']]){
 const artifact=JSON.parse(await readFile(`blockchain/artifacts/contracts/${name}.sol/${name}.json`,'utf8'));
 const build=JSON.parse(await readFile(`blockchain/artifacts/build-info/${artifact.buildInfoId}.json`,'utf8'));
 const input=build.input;for(const source of Object.values(input.sources))if(!source.content)throw new Error('Source content missing.');
 const constructorArguments=key==='registry'?AbiCoder.defaultAbiCoder().encode(['address'],[manifest.identity.address]).slice(2):'';
 await writeFile(`${directory}/${name}.standard-input.json`,JSON.stringify(input,null,2)+'\n');
 await writeFile(`${directory}/${name}.constructor-arguments.txt`,constructorArguments+'\n');
 contracts.push({name,address:manifest[key].address,compiler:'v'+build.solcLongVersion,evmVersion:input.settings.evmVersion,optimizer:input.settings.optimizer||{enabled:false},contract:`${artifact.inputSourceName||artifact.sourceName}:${name}`,constructorArguments,url:`https://sepolia.etherscan.io/address/${manifest[key].address}#code`});
}
await writeFile(`${directory}/verification-settings.json`,JSON.stringify({chainId:11155111,contracts},null,2)+'\n');
console.log('Standard JSON sources and constructor arguments prepared in output/etherscan (no credentials).');
