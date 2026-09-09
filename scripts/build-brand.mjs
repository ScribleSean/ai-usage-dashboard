import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const mark=readFileSync(new URL('../public/brand/telescope.svg',import.meta.url),'utf8').replaceAll('\r\n','\n');
const body=mark.match(/<svg[^>]*>([\s\S]*)<\/svg>/)?.[1];
if(!body || /<script|<image|href=|on\w+=/i.test(mark))throw Error('Invalid canonical brand mark');
const destination=new URL('../public/favicon.svg',import.meta.url);
const rendered=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#09090b"/><g transform="translate(4 4)" fill="none" stroke="#f5f5f5" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>\n`;
if(!existsSync(destination) || readFileSync(destination,'utf8').replaceAll('\r\n','\n')!==rendered)writeFileSync(destination,rendered);
