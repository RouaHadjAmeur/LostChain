import {useState} from 'react';
import {Package} from 'lucide-react';
export default function ItemImage({src,name,lazy=false}){
 const [failed,setFailed]=useState(null);
 return src&&failed!==src?<img src={src} alt={name} loading={lazy?'lazy':undefined} onError={()=>setFailed(src)}/>:<div className="image-placeholder" role="img" aria-label={`No photo available for ${name}`}><Package size={48}/></div>;
}
