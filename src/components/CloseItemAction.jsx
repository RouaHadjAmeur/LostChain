import {useCallback,useState} from 'react';
import {useApp} from '../context/AppContext';
import Dialog from './Dialog';
export default function CloseItemAction({item}){
 const {user,claims,closeItem,pending,notify}=useApp();
 const [open,setOpen]=useState(false),[error,setError]=useState('');const dismiss=useCallback(()=>setOpen(false),[]);
 if(!user||item.reporter!==user.address||!['Lost','Found'].includes(item.status))return null;
 if(claims.some(c=>c.itemId===item.id&&c.status==='Accepted'))return <p className="field-help">An accepted handover is in progress. This item can only become Returned after both parties confirm.</p>;
 return <><button className="button secondary full" disabled={pending} onClick={()=>{setOpen(true);setError('')}}>Close item</button>{open&&<Dialog title="Close item" onClose={dismiss}><p className="description">Close “{item.name}”? It will remain in your report history, and all pending claims will be cancelled. This does not mark the item Returned.</p>{error&&<p className="error" role="alert">{error}</p>}<div className="form-actions"><button className="button secondary" disabled={pending} onClick={dismiss}>Keep item open</button><button className="button primary" disabled={pending} onClick={async()=>{try{await closeItem(item.id);notify('Item closed. Pending claims have been cancelled.');setOpen(false)}catch(e){setError(e.message)}}}>Close item</button></div></Dialog>}</>
}
