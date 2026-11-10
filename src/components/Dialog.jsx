import {useEffect,useId,useRef} from 'react';
import {X} from 'lucide-react';
export default function Dialog({title,onClose,children}){
 const ref=useRef(null),id=useId();
 useEffect(()=>{const previous=document.activeElement;const element=ref.current;element.focus();function key(e){if(e.key==='Escape'){e.preventDefault();onClose()}if(e.key==='Tab'){const nodes=[...element.querySelectorAll('button:not(:disabled),input,textarea,select,a[href]')];if(!nodes.length){e.preventDefault();return}const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===element)){e.preventDefault();last.focus()}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===element)){e.preventDefault();first.focus()}}}element.addEventListener('keydown',key);return()=>{element.removeEventListener('keydown',key);previous?.focus()}},[onClose]);
 return <div className="modal-backdrop"><section className="panel modal" role="dialog" aria-modal="true" aria-labelledby={id} ref={ref} tabIndex={-1}><div className="dialog-heading"><h2 id={id}>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20}/></button></div>{children}</section></div>
}
