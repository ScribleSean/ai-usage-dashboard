import {readFileSync,readdirSync,lstatSync,readlinkSync,realpathSync,cpSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';

const hash=data=>createHash('sha256').update(data).digest('hex');
export function inspectRuntime(root,assets) {
  root=realpathSync(root);
  const manifest=JSON.parse(readFileSync(path.join(root,'runtime-manifest.json'),'utf8'));
  if(manifest.schema!==1 || !manifest.files || !manifest.symlinks)throw Error('Invalid runtime manifest schema');
  if(JSON.stringify(manifest.assets)!==JSON.stringify(assets))throw Error('Runtime provenance differs from pinned assets');
  const found=new Set(),links=new Set(),binaries=[];
  function walk(directory) {
    for(const name of readdirSync(directory)) {
      const file=path.join(directory,name),relative=path.relative(root,file).split(path.sep).join('/');
      const info=lstatSync(file);
      if(name==='__pycache__' || /\.(pyc|pyo)$/.test(name) || name==='node_modules')throw Error('Unexpected runtime cache or dependency tree');
      if(info.isSymbolicLink()) {
        const target=readlinkSync(file),resolved=realpathSync(file);
        if(path.isAbsolute(target) || !resolved.startsWith(root+path.sep))throw Error('Escaping runtime symlink');
        if(manifest.symlinks[relative]!==target)throw Error('Runtime symlink mismatch');
        links.add(relative);
      } else if(info.isDirectory())walk(file);
      else if(info.isFile()) {
        if(relative==='runtime-manifest.json')continue;
        const bytes=readFileSync(file);
        if(manifest.files[relative]!==hash(bytes))throw Error(`Runtime file mismatch: ${relative}`);
        found.add(relative);
        if(['cffaedfe','cefaedfe','cafebabe','bebafeca','cafebabf'].includes(bytes.subarray(0,4).toString('hex')))binaries.push(relative);
      } else throw Error('Unsupported runtime file');
    }
  }
  walk(root);
  if(Object.keys(manifest.files).length!==found.size)throw Error('Runtime manifest contains missing files');
  if(Object.keys(manifest.symlinks).length!==links.size)throw Error('Runtime manifest contains missing symlinks');
  for(const required of ['node/bin/node','node/LICENSE','python/bin/python3.13','python/licenses/LICENSE.cpython.txt'])
    if(!found.has(required))throw Error('Required runtime file missing');
  return binaries;
}

export function bundleRuntime(source,destination,assets) {
  const binaries=inspectRuntime(source,assets);
  cpSync(source,destination,{recursive:true,verbatimSymlinks:true,errorOnExist:true,force:false});
  for(const relative of binaries) {
    const file=path.join(destination,relative);
    execFileSync('/usr/bin/codesign',['--force','--sign','-','--timestamp=none',file],{stdio:'inherit'});
    execFileSync('/usr/bin/codesign',['--verify','--strict',file],{stdio:'inherit'});
  }
  return binaries.length;
}
