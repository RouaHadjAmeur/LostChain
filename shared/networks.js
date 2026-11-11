export const NETWORKS = Object.freeze({
  31337: {chainId:31337,name:'LostChain Local',label:'Hardhat local',rpcUrl:'http://127.0.0.1:8545',explorerUrl:'',symbol:'ETH'},
  11155111: {chainId:11155111,name:'Sepolia',label:'Ethereum Sepolia',rpcUrl:'https://ethereum-sepolia-rpc.publicnode.com',explorerUrl:'https://sepolia.etherscan.io',symbol:'ETH'},
});
export function networkFor(chainId){const network=NETWORKS[Number(chainId)];if(!network)throw new Error('Unsupported network. Use Hardhat 31337 or Ethereum Sepolia 11155111.');return network}
export function publicConfig(config){const network=networkFor(config.chainId);return {...config,...network,rpcUrl:network.rpcUrl}}
