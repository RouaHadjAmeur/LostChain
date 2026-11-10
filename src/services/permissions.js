export const isStaff = user => user?.role === 'Staff';
export const normalizeUser = user => user ? {...user, role: isStaff(user) ? 'Staff' : 'Student'} : null;
export const normalizeClaims = claims => claims.map(claim => ({
  ...claim,
  // Legacy review decisions no longer belong to the recovery workflow.
  status: ['Approved', 'Rejected'].includes(claim.status) ? 'Pending' : claim.status,
}));
export function completeHandover({user, claim, items, claims, date = new Date().toISOString()}) {
  const current = claims.find(entry => entry.id === claim?.id);
  const item = items.find(entry => entry.id === current?.itemId);
  if (!isStaff(user) || current?.status !== 'Pending' || item?.status !== 'Found') {
    return null;
  }
  return {
    items: items.map(entry => entry.id === item.id ? {...entry, status: 'Returned'} : entry),
    claims: claims.map(entry => entry.itemId !== item.id || entry.status !== 'Pending' ? entry : {
      ...entry,
      status: entry.id === current.id ? 'Completed' : 'Closed',
      ...(entry.id === current.id ? {completedAt: date, confirmedBy: user.address} : {closedReason: 'Item returned to another claimant'}),
    }),
  };
}
