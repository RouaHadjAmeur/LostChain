import {HDNodeWallet,JsonRpcProvider} from 'ethers';
// Hardhat's public development mnemonic. These keys must never hold real assets.
const provider=new JsonRpcProvider('http://127.0.0.1:8545',31337,{cacheTimeout:-1});
try{
 if((await provider.getNetwork()).chainId!==31337n)throw new Error('Use only the local Hardhat network.');
 const accounts=await provider.send('eth_accounts',[]);
 const wallets=[0,1,2].map(index=>HDNodeWallet.fromPhrase('test test test test test test test test test test test junk',undefined,`m/44'/60'/0'/0/${index}`));
 if(wallets.some((wallet,index)=>wallet.address.toLowerCase()!==accounts[index]?.toLowerCase()))throw new Error('The node uses custom accounts. Use your own local test-wallet configuration.');
 console.log('PUBLIC HARDHAT DEVELOPMENT ACCOUNTS. Never send real funds to these addresses.\nImport these three accounts into MetaMask for local testing only.');
 for(const [index,wallet]of wallets.entries())console.log(`\nLocal test account ${index+1}\nAddress: ${wallet.address}\nPrivate key: ${wallet.privateKey}`);
}finally{provider.destroy()}
