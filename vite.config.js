import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({mode})=>({
 plugins:[react(),{name:'lostchain-local-health',configureServer(server){server.middlewares.use('/__lostchain/status',(_req,res)=>{res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({app:'LostChain',dataMode:mode==='chain'?'blockchain':'prototype'}))})}}],
 server:{proxy:{'/api/chain':'http://127.0.0.1:3002'}},
 preview:{proxy:{'/api/chain':'http://127.0.0.1:3002'}}
}));
