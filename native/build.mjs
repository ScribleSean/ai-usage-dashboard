import {execFileSync,spawnSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,cpSync,writeFileSync,readdirSync,rmSync,statSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('..',import.meta.url));
const output=path.join(root,'.native-build');
mkdirSync(output,{recursive:true});
if (process.argv.includes('--native-only')) {
  // Explicit opt-in for Swift-only edits. The packaged web smoke test still runs.
  if (!existsSync(path.join(output,'web/index.html'))) throw Error('Build the web bundle first');
  console.log('Reusing the existing web bundle for a native-only change.');
} else {
  execFileSync(path.join(root,'node_modules/.bin/vite'),['build','--config','native/vite.config.mts'],{cwd:root,stdio:'inherit'});
}
// Build app bundles outside file-provider-managed project folders.
const staging=mkdtempSync(path.join(tmpdir(),'observatory-build-'));
const bundle=path.join(staging,'Workspace Observatory.app');
const contents=path.join(bundle,'Contents');
const resources=path.join(contents,'Resources');
mkdirSync(path.join(contents,'MacOS'),{recursive:true});
mkdirSync(resources,{recursive:true});
const mark=path.join(root,'public/brand/telescope.svg');
cpSync(mark,path.join(resources,'telescope.svg'));
const iconset=path.join(staging,'AppIcon.iconset');
execFileSync('/usr/bin/xcrun',['swift','-module-cache-path',path.join(output,'module-cache'),
  path.join(root,'native/tools/build-icons.swift'),mark,iconset],{stdio:'inherit'});
execFileSync('/usr/bin/iconutil',['-c','icns',iconset,'-o',path.join(resources,'AppIcon.icns')],{stdio:'inherit'});
const web=path.join(resources,'Web');
if(existsSync(web))rmSync(web,{recursive:true});
cpSync(path.join(output,'web'),web,{recursive:true});
if(existsSync(path.join(web,'local')))throw Error('Private snapshots must never enter the app bundle');
const scripts=path.join(resources,'Collector','scripts');
mkdirSync(scripts,{recursive:true});
for(const name of readdirSync(path.join(root,'scripts'))) {
  if(name.endsWith('.test.mjs') || !/\.(mjs|py|ps1)$/.test(name))continue;
  cpSync(path.join(root,'scripts',name),path.join(scripts,name));
}
const sources=readdirSync(path.join(root,'native')).filter(name=>name.endsWith('.swift')).map(name=>path.join(root,'native',name));
const binary=path.join(contents,'MacOS','WorkspaceObservatory');
execFileSync('/usr/bin/xcrun',['swiftc','-swift-version','5','-O','-module-cache-path',path.join(output,'module-cache'),
  '-target','arm64-apple-macosx14.0','-framework','AppKit','-framework','SwiftUI','-framework','WebKit',
  '-framework','ServiceManagement',...sources,'-o',binary],{cwd:root,stdio:'inherit'});
writeFileSync(path.join(contents,'Info.plist'),`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>io.workspace-observatory.app</string>
<key>CFBundleName</key><string>Workspace Observatory</string>
<key>CFBundleDisplayName</key><string>Workspace Observatory</string>
<key>CFBundleExecutable</key><string>WorkspaceObservatory</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleIconFile</key><string>AppIcon</string>
<key>CFBundleShortVersionString</key><string>0.2.0</string>
<key>CFBundleVersion</key><string>5</string>
<key>LSMinimumSystemVersion</key><string>14.0</string>
<key>LSUIElement</key><true/>
<key>NSHighResolutionCapable</key><true/>
</dict></plist>\n`);
// Remove Finder metadata only from this generated bundle before local signing.
for (const attribute of ['com.apple.FinderInfo','com.apple.ResourceFork']) {
  spawnSync('/usr/bin/xattr',['-rd',attribute,bundle],{stdio:'ignore'});
}
execFileSync('/usr/bin/codesign',['--force','--sign','-','--timestamp=none',bundle],{stdio:'inherit'});
execFileSync(binary,['--self-test'],{stdio:'inherit'});
execFileSync('/usr/bin/codesign',['--verify','--strict',bundle],{stdio:'inherit'});
execFileSync(binary,['--test-web'],{stdio:'inherit',timeout:35000});
writeFileSync(path.join(output,'app.json'),JSON.stringify({bundle,builtAt:new Date().toISOString()}));
console.log(`Built ${bundle} (native binary ${(statSync(binary).size/1048576).toFixed(1)} MiB). No live data bundled.`);
