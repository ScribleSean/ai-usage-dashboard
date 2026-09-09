const fields=['pairId','deviceId','comparisonId','comparisonSalt','host','codexHosts'];
const hex=value=>typeof value==='string' && /^[a-f0-9]{64}$/.test(value);

// Pairing is supplied by a trusted private configuration loader, never by the
// dashboard or received payload. The salt travels to Python on stdin only.
export function preparePeerCollection(value,host,codexHosts) {
  if(!value || typeof value!=='object' || Array.isArray(value) ||
    Object.keys(value).length!==fields.length || Object.keys(value).some(key=>!fields.includes(key)) ||
    fields.slice(0,4).some(key=>!hex(value[key])) || value.host!==host ||
    !['Mac','Windows'].includes(host) || !Array.isArray(value.codexHosts) ||
    JSON.stringify(value.codexHosts)!==JSON.stringify(codexHosts))throw Error('Invalid private collection pairing');
  const {comparisonSalt,...config}=value;
  return {config:{...config,codexHosts:[...config.codexHosts]},readerPrefix:`INVENTORY_SALT = '${comparisonSalt}'\n`};
}
