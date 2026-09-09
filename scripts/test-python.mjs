import {execFileSync} from 'node:child_process';
import path from 'node:path';

// Tests use the installed launcher, never the Windows Store python3 alias.
export const execPython=(args,options)=>execFileSync(
  process.platform==='win32'?path.join(process.env.SystemRoot || 'C:/Windows','py.exe'):'python3',
  [...(process.platform==='win32'?['-3']:[]),'-B','-X','utf8',...args],options);
