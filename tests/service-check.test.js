import {test} from 'node:test';
import assert from 'node:assert/strict';
import {probeService} from '../scripts/service-check.js';
const url='http://127.0.0.1:5174/__lostchain/status';
const matches=data=>data.app==='LostChain'&&data.dataMode==='blockchain';
const response=data=>async()=>({ok:true,json:async()=>data});
test('startup reuses a healthy existing blockchain frontend',async()=>{assert.equal(await probeService(url,matches,response({app:'LostChain',dataMode:'blockchain'})),true)});
test('startup starts a service only when the port is not listening',async()=>{assert.equal(await probeService(url,matches,async()=>{throw Object.assign(new Error('fetch failed'),{cause:{code:'ECONNREFUSED'}})}),false)});
test('startup refuses to replace other services, prototype mode or an unresponsive port',async()=>{await assert.rejects(probeService(url,matches,response({app:'LostChain',dataMode:'prototype'})),/different service/);await assert.rejects(probeService(url,matches,async()=>({ok:true,json:async()=>{throw new Error('Not JSON')}})),/unrecognized service/);await assert.rejects(probeService(url,matches,async()=>{throw new Error('Timeout')}),/Cannot verify/)});
