import {shortAddress} from '../campus.js';
// Presentation anonymity: ownership still uses the immutable member identifier.
// Legacy reports default to hiding the name.
export function reporterLabel(item){
  return item.reporterVisibility==='name'&&item.reporterName
    ? item.reporterName
    : `Anonymous · ${shortAddress(item.reporter)}`;
}
