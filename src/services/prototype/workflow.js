// Pure domain transitions. Future adapters can implement these operations without
// changing the pages; no chain SDK or network connection belongs in this module.
export function transitionClaim(state, actor, claimId, action, now = new Date().toISOString()) {
  if (!actor) throw new Error('Please sign in.');
  const claim = state.claims.find(entry => entry.id === claimId);
  const item = state.items.find(entry => entry.id === claim?.itemId);
  if (!claim || !item) throw new Error('This claim is no longer available.');
  const reporter = item.reporter === actor.address;
  const claimant = claim.owner === actor.address;
  let updated = {...claim, updatedAt: now};
  if (['accept', 'reject'].includes(action)) {
    if (!reporter) throw new Error('Only the item reporter can respond to this claim.');
    if (claim.status !== 'Pending' || item.status !== 'Found') throw new Error('This claim cannot be reviewed now.');
    if (action === 'accept' && state.claims.some(entry => entry.itemId === item.id && entry.status === 'Accepted')) throw new Error('Another claim is already accepted for this item.');
    updated.status = action === 'accept' ? 'Accepted' : 'Rejected';
  } else if (action === 'cancel') {
    if (!claimant) throw new Error('Only the claimant can cancel this claim.');
    if (claim.status !== 'Pending' || item.status !== 'Found') throw new Error('Only pending claims can be cancelled.');
    updated.status = 'Cancelled';
    updated.cancelledAt = now;
    updated.cancelledReason = 'Cancelled by the claimant.';
  } else if (['receive', 'handover'].includes(action)) {
    if (claim.status !== 'Accepted' || item.status !== 'Found') throw new Error('Accept the claim before confirming the handover.');
    if (action === 'receive') {
      if (!claimant) throw new Error('Only the claimant can confirm receiving the item.');
      if (claim.receivedAt) throw new Error('Receipt has already been confirmed.');
      updated.receivedAt = now;
    } else {
      if (!reporter) throw new Error('Only the reporter can confirm handing over the item.');
      if (claim.handedOverAt) throw new Error('Handover has already been confirmed.');
      updated.handedOverAt = now;
    }
    if (updated.receivedAt && updated.handedOverAt) {
      updated.status = 'Completed';
      updated.completedAt = now;
    }
  } else throw new Error('Unknown claim action.');
  const completed = updated.status === 'Completed';
  const claims = state.claims.map(entry => entry.id === claim.id ? updated : action === 'accept' && entry.itemId === item.id && entry.status === 'Pending' ? {...entry, status: 'Rejected', updatedAt: now, rejectionReason: 'Another claim was accepted for this item.'} : entry);
  return {...state, claims, items: state.items.map(entry => completed && entry.id === item.id ? {...entry, status: 'Returned'} : entry)};
}

export function closeReportedItem(state, actor, itemId, now = new Date().toISOString()) {
  if (!actor) throw new Error('Please sign in.');
  const item = state.items.find(entry => entry.id === itemId);
  if (!item) throw new Error('This item is no longer available.');
  if (item.reporter !== actor.address) throw new Error('Only the reporter can close this item.');
  if (!['Lost','Found'].includes(item.status) || state.claims.some(claim => claim.itemId === itemId && claim.status === 'Accepted')) throw new Error('An accepted, returned or closed item cannot be closed.');
  return {...state,
    items: state.items.map(entry => entry.id === itemId ? {...entry, status:'Closed',closedAt:now} : entry),
    claims: state.claims.map(claim => claim.itemId === itemId && claim.status === 'Pending' ? {...claim,status:'Cancelled',updatedAt:now,cancelledAt:now,cancelledReason:'The reporter closed this item.'} : claim),
  };
}
