import ItemImage from './ItemImage';
import {Link} from 'react-router-dom';
import {MapPin,ArrowUpRight,Package} from 'lucide-react';
export const Badge=({status})=><span className={`badge ${status.toLowerCase()}`}><i/>{status}</span>;
export default function ItemCard({item,isNew=false}){return <Link to={`/items/${item.id}`} className="item-card"><div className="item-image"><ItemImage src={item.image} name={item.name} lazy/><Badge status={item.status}/>{isNew&&<span className="new-report-badge">New</span>}<span className="image-arrow"><ArrowUpRight size={18}/></span></div><div className="item-body"><span className="item-category">{item.category}</span><h3>{item.name}</h3><p><MapPin size={14}/>{item.location}</p><div className="item-meta"><span>{new Date(item.date+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</span><span>View details ↗</span></div></div></Link>}
