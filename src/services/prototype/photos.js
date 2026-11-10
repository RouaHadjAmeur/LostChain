export const MAX_PROOF_PHOTO_BYTES=2*1024*1024;
export function validateProofPhoto(photo){
 if(photo===undefined||photo==='')return '';
 if(typeof photo!=='string')throw new Error('Choose a JPG, PNG or WebP proof photo.');
 const match=photo.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
 if(!match||match[2].length%4!==0)throw new Error('Choose a JPG, PNG or WebP proof photo.');
 const padding=match[2].endsWith('==')?2:match[2].endsWith('=')?1:0;
 if(match[2].length*3/4-padding>MAX_PROOF_PHOTO_BYTES)throw new Error('Proof photos must be smaller than 2 MB.');
 return photo;
}
