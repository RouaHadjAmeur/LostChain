import {Link} from 'react-router-dom';
import {Plus,ClipboardList,ArrowUpRight} from 'lucide-react';
import {useApp} from '../context/AppContext';
import Heading from '../components/PageHeading';
import MemberRequired from '../components/MemberRequired';
import ItemCard from '../components/ItemCard';
export default function Dashboard(){
 const {user,items,claims,activities,notifications}=useApp();if(!user)return <MemberRequired/>;
 const mine=items.filter(i=>i.reporter===user.address),related=claims.filter(c=>c.owner===user.address||mine.some(i=>i.id===c.itemId));
 const returned=items.filter(i=>i.status==='Returned'&&(i.reporter===user.address||claims.some(c=>c.itemId===i.id&&c.owner===user.address&&c.status==='Completed'))).length;
 const unread=notifications.filter(n=>!n.read).length;
 const stats=[['My Lost Reports',mine.filter(i=>(i.reportType||i.status)==='Lost').length],['My Found Reports',mine.filter(i=>(i.reportType||i.status)==='Found'||i.status==='Returned').length],['Pending Claims',related.filter(c=>c.status==='Pending').length],['Accepted Claims',related.filter(c=>c.status==='Accepted').length],['Returned Items',returned]];
 return <><Heading title={`Welcome, ${user.name.split(' ')[0]}.`} description="Your reports, your connections, and the little things that find their way home."><Link to="/report/lost" className="button primary"><Plus size={17}/>Report an item</Link></Heading>{unread>0&&<Link to="/received-claims" className="demo-notice"><strong>{unread} unread update{unread===1?'':'s'}</strong> · Open the notification bell to view claim activity.</Link>}<div className="stats-grid dashboard-stats">{stats.map(([title,count])=><div className="stat-card" key={title}><span className="stat-icon mint"><ClipboardList/></span><div><p>{title}</p><strong>{count}</strong></div></div>)}</div><div className="section-heading"><h2>Your recent reports</h2><Link className="text-link" to="/my-reports">All my reports<ArrowUpRight size={16}/></Link></div>{mine.length?<div className="items-grid">{mine.slice(0,3).map(item=><ItemCard item={item} key={item.id}/>)}</div>:<div className="empty-state"><h3>A fresh start.</h3><p>Your reports will appear here when you share an item.</p><Link className="button primary" to="/report/found">Report found item</Link></div>}<section className="panel activity"><h2>Recent activities</h2>{activities.length?activities.slice(0,8).map(activity=><div className="activity-row" key={activity.id}><span className="activity-dot"/><span>{activity.text}</span><small>{new Date(activity.date).toLocaleString('en-GB')}</small></div>):<p className="muted">Your next report, claim or handover will appear here.</p>}</section></>
}
