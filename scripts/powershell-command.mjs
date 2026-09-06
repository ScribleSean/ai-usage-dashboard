import { gzipSync } from 'node:zlib';

// Keep the adapter below the Windows SSH command-line limit as it grows.
export function powershellCommand(source) {
  const payload = gzipSync(Buffer.from(source, 'utf8')).toString('base64');
  const loader = `$m=[IO.MemoryStream]::new([Convert]::FromBase64String('${payload}'));$g=[IO.Compression.GzipStream]::new($m,[IO.Compression.CompressionMode]::Decompress);$r=[IO.StreamReader]::new($g);& ([ScriptBlock]::Create($r.ReadToEnd()))`;
  const command = 'powershell.exe -NoProfile -NonInteractive -EncodedCommand ' + Buffer.from(loader, 'utf16le').toString('base64');
  if (command.length > 7900) throw Error('Windows adapter exceeds safe command length');
  return command;
}
