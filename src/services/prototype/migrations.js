// Remove only the original seeded listings when upgrading an existing browser.
// Member-created reports, accounts and sessions retain their original identifiers.
const legacyItemIds=new Set(['LC-1042','LC-1041','LC-1040','LC-1039','LC-1038','LC-1037']);
function removeLegacyListings(state){
  if(state.version!==1)return state;
  const removedClaims=new Set(state.claims.filter(c=>legacyItemIds.has(c.itemId)).map(c=>c.id));
  return {...state,version:2,
    items:state.items.filter(item=>!legacyItemIds.has(item.id)),
    claims:state.claims.filter(claim=>!legacyItemIds.has(claim.itemId)),
    notifications:state.notifications.filter(n=>!removedClaims.has(n.claimId)),
    activities:state.activities.filter(a=>!legacyItemIds.has(a.id.slice(2))&&!removedClaims.has(a.id.slice(2))&&!removedClaims.has(a.claimId)),
  };
}

function normalizeClaimWorkflow(original){
  let state=removeLegacyListings(original);
  if(state.version!==2)return state;
  const claims=state.claims.map(claim=>{
    if(claim.status==='Pending'&&state.claims.some(other=>other.itemId===claim.itemId&&other.status==='Accepted'))return {...claim,status:'Rejected',rejectionReason:'Another claim was accepted for this item.'};
    if(claim.status==='Closed')return {...claim,status:'Rejected',rejectionReason:claim.closedReason||'This item was returned to another claimant.'};
    return claim;
  });
  return {...state,version:3,claims};
}

// Retain historical participants when their reports/claims exist, but retire
// unused built-in accounts. Member-created accounts are never removed.
const legacyDemoAddresses=new Set([
 '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
 '0x32a9188f794A0f645892a85f52f1233d58C64BA9',
 '0x12b7656EC7ab88b098defB751B7401B5f6d8976F',
]);
export function upgradePrototype(original){
 const state=normalizeClaimWorkflow(original);
 if(state.version!==3)return state;
 const users=state.users.filter(member=>!legacyDemoAddresses.has(member.address)||state.items.some(item=>item.reporter===member.address)||state.claims.some(claim=>claim.owner===member.address)).map(member=>legacyDemoAddresses.has(member.address)?{...member,legacyDemo:true}:member);
 const remaining=new Set(users.map(member=>member.address));
 return {...state,version:4,users,activeAddress:remaining.has(state.activeAddress)?state.activeAddress:null,notifications:state.notifications.filter(n=>remaining.has(n.recipient))};
}
