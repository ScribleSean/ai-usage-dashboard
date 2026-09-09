import {execFileSync} from 'node:child_process';

export function sourceState(project) {
  const run=args=>execFileSync('git',args,{cwd:project,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  const changed=args=>{
    try{run(args);return false;}
    catch(error){if(error.status===1)return true;throw error;}
  };
  // Compare Git-normalized content. On Windows a regenerated LF file can have
  // a stale modified stat while its CRLF-normalized Git content is identical.
  return {revision:run(['rev-parse','HEAD']),dirty:
    changed(['diff','--no-ext-diff','--quiet']) || changed(['diff','--cached','--no-ext-diff','--quiet']) ||
    Boolean(run(['ls-files','--others','--exclude-standard']))};
}
