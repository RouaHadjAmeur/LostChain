import {useEffect,useRef} from 'react';
import {useApp} from '../context/AppContext';
// Mark only notifications for claims actually visible under the current filter.
export default function ReadClaimNotifications({claimIds}){
 const {user,notifications,pending,markNotificationsRead}=useApp();const attempted=useRef('');
 const ids=notifications.filter(n=>!n.read&&n.claimId&&claimIds.includes(n.claimId)).map(n=>n.id);
 const key=JSON.stringify([user?.address,ids]);
 useEffect(()=>{if(!user||pending||!ids.length||attempted.current===key)return;attempted.current=key;markNotificationsRead(ids).catch(()=>{})},[key,pending]);
 return null;
}
