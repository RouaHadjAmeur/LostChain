import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({mode})=>({
 plugins:[react(),{name:'lostchain-local-health',configureServer(server){server.middlewares.use('/__lostchain/status',(_req,res)=>{res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({app:'LostChain',buildMode:mode,dataMode:['chain','sepolia'].includes(mode)?'blockchain':'prototype'}))})}}],
 server:{proxy:{'/api/deployment':'http://127.0.0.1:3004','/api/chain':mode==='sepolia'?'http://127.0.0.1:3003':'http://127.0.0.1:3002'}},
 preview:{proxy:{'/api/deployment':'http://127.0.0.1:3004','/api/chain':mode==='sepolia'?'http://127.0.0.1:3003':'http://127.0.0.1:3002'}}
}));
