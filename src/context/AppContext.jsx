import {useState,useEffect,useMemo,useRef,lazy,Suspense} from 'react';
import {createPrototypeRepository,STORAGE_KEY} from '../services/prototype/repository.js';
const ChainProvider=lazy(()=>import('./ChainProvider'));
const CHAIN_MODE=import.meta.env.VITE_DATA_MODE==='blockchain';
import {AppContext as Context} from './context';
export {useApp} from './context';
export function AppProvider({children}){return CHAIN_MODE?<Suspense fallback={<div className="empty-state">Loading local blockchain integration…</div>}><ChainProvider>{children}</ChainProvider></Suspense>:<PrototypeProvider>{children}</PrototypeProvider>}
function PrototypeProvider({children}) {
  const repository=useMemo(()=>createPrototypeRepository(window.localStorage),[]);
  const [state,setState]=useState(()=>{try{return repository.snapshot()}catch(error){return {error:error.message}}});
  const [pending,setPending]=useState(false),[toast,setToast]=useState('');const timer=useRef(null),busy=useRef(false),latest=useRef(state);
  function notify(message){setToast(message);clearTimeout(timer.current);timer.current=setTimeout(()=>setToast(''),4500)}
  useEffect(()=>{const sync=e=>{if(e.key===STORAGE_KEY||e.key===null){try{const next=repository.snapshot();const previous=latest.current;latest.current=next;setState(next);if(next.user?.address&&previous.user?.address===next.user.address){const added=(next.newReportIds||[]).filter(id=>!(previous.newReportIds||[]).includes(id));if(added.length)notify(`${added.length} new campus report${added.length===1?'':'s'}. Open Explore items to see what’s new.`)}}catch(error){setState({error:error.message})}}};window.addEventListener('storage',sync);return()=>{window.removeEventListener('storage',sync);clearTimeout(timer.current)}},[repository]);
  async function run(method,...args){if(busy.current)throw new Error('Please wait for the current action.');busy.current=true;setPending(true);try{const result=await repository[method](...args);const next=repository.snapshot();latest.current=next;setState(next);return result}catch(error){notify(error.message);throw error}finally{busy.current=false;setPending(false)}}
  const actions=Object.fromEntries(['login','register','updateProfile','createItem','createClaim','closeItem','claimAction','arrangeHandover','markNotificationsRead','markReportsSeen'].map(method=>[method,(...args)=>run(method,...args)]));
  async function logout(){try{await run('logout');notify('Signed out')}catch{}}
  return <Context.Provider value={{...state,...actions,logout,pending,notify}}>{state.error?<div className="empty-state" role="alert"><h3>Unable to load saved prototype</h3><p>{state.error}</p></div>:children}{toast&&<div role="status" className="toast">{toast}</div>}</Context.Provider>;
}
