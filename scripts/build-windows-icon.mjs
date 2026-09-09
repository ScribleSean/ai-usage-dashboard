import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
if(process.platform!=='darwin')throw Error('Regenerate the canonical Windows icon on Mac. Windows builds use the checked-in ICO.');
const temp=mkdtempSync(path.join(tmpdir(),'observatory-windows-icon-'));
const iconset=path.join(temp,'AppIcon.iconset');
execFileSync('/usr/bin/xcrun',['swift','-module-cache-path',path.join(temp,'modules'),
  path.join(root,'native/tools/build-icons.swift'),path.join(root,'public/brand/telescope.svg'),iconset],{stdio:'inherit'});
const sizes=[16,32,128,256];
const images=sizes.map(size=>readFileSync(path.join(iconset,`icon_${size}x${size}.png`)));
const header=Buffer.alloc(6+16*images.length);header.writeUInt16LE(1,2);header.writeUInt16LE(images.length,4);
let offset=header.length;
images.forEach((image,index)=>{
  const start=6+16*index;header[start]=sizes[index]%256;header[start+1]=sizes[index]%256;
  header.writeUInt16LE(1,start+4);header.writeUInt16LE(32,start+6);
  header.writeUInt32LE(image.length,start+8);header.writeUInt32LE(offset,start+12);offset+=image.length;
});
writeFileSync(path.join(root,'native/windows/telescope.ico'),Buffer.concat([header,...images]));
console.log('Windows icon generated from the canonical telescope mark.');
