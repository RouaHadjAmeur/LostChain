// Public community preview intentionally exposes no emails or credential verifiers.
export function communityPreview(users){
  const members=users.filter(member=>!member.legacyDemo&&member.registrationStatus==='Registered');
  return {total:members.length,initials:members.slice(-4).map(member=>Array.from(member.name.trim())[0]?.toUpperCase()||'?')};
}
