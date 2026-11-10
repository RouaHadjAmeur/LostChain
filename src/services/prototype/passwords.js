// Local prototype credential simulation; never a production authentication boundary.
const iterations = 100000;
const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
export async function passwordDigest(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations,hash:'SHA-256'},key,256)));
}
export async function encodePassword(password) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  return {salt, digest: await passwordDigest(password,salt)};
}
