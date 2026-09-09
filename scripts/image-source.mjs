// Native Vite emits a URL string. The web image loader emits image metadata.
export function imageSource(asset) {
  const source=typeof asset==='string'?asset:asset?.src;
  if(typeof source!=='string' || !source)throw Error('Missing image asset URL');
  return source;
}
