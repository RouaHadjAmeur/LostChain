import {network,artifacts} from 'hardhat';
import {mkdir,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const {ethers}=await network.create();
const chain=await ethers.provider.getNetwork();
if(chain.chainId!==31337n)throw new Error('This deployment script is restricted to local chain 31337.');
const identity=await ethers.deployContract('CampusIdentity');await identity.waitForDeployment();
const registry=await ethers.deployContract('LostItemRegistry',[await identity.getAddress()]);await registry.waitForDeployment();
const receipt=await registry.deploymentTransaction()!.wait();
const config={deploymentId:randomUUID(),chainId:31337,rpcUrl:'http://127.0.0.1:8545',deploymentBlock:receipt!.blockNumber,
 identity:{address:await identity.getAddress(),abi:(await artifacts.readArtifact('CampusIdentity')).abi},
 registry:{address:await registry.getAddress(),abi:(await artifacts.readArtifact('LostItemRegistry')).abi}};
await mkdir('deployments',{recursive:true});await writeFile('deployments/localhost.json',JSON.stringify(config,null,2)+'\n');
console.log('Local contracts deployed. Configuration saved to blockchain/deployments/localhost.json');
