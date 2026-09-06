import path from 'node:path';

const xml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
export function loginJobs({ root, node, windowsHost }) {
  if (!path.isAbsolute(root) || !path.isAbsolute(node)) throw Error('Absolute paths required');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(windowsHost)) throw Error('Invalid SSH alias');
  const jobs = {
    'io.ai-usage-dashboard.server': [node, path.join(root, 'serve-local.mjs')],
    'io.ai-usage-dashboard.tunnel': ['/usr/bin/ssh', '-N', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8',
      '-o', 'ExitOnForwardFailure=yes', '-o', 'ServerAliveInterval=30', '-o', 'ServerAliveCountMax=3',
      '-R', '127.0.0.1:5601:127.0.0.1:5601', windowsHost],
  };
  return Object.fromEntries(Object.entries(jobs).map(([label, args]) => [label,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array>${args.map(arg => `<string>${xml(arg)}</string>`).join('')}</array>
<key>WorkingDirectory</key><string>${xml(root)}</string>
<key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>30</integer>
<key>ProcessType</key><string>Background</string>
</dict></plist>
`]));
}
