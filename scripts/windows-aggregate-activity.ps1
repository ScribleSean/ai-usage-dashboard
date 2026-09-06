# Read-only host adapter: aggregate before crossing SSH. Never emit titles or raw app names.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$base = 'http://127.0.0.1:5600/api/0'
$end = [DateTimeOffset]::UtcNow
$start = $end.AddDays(-7)
$buckets = Invoke-RestMethod -Uri "$base/buckets/" -TimeoutSec 10
$windows = @($buckets.PSObject.Properties | Where-Object {$_.Value.type -eq 'currentwindow'})
$afks = @($buckets.PSObject.Properties | Where-Object {$_.Value.type -eq 'afkstatus'})
if ($windows.Count -ne 1 -or $afks.Count -ne 1) { throw 'Ambiguous collectors' }
$w = ConvertTo-Json -Compress -InputObject $windows[0].Name
$a = ConvertTo-Json -Compress -InputObject $afks[0].Name
$query = "w = query_bucket($w); a = query_bucket($a); a = filter_keyvals(a, `"status`", [`"not-afk`"]); w = filter_period_intersect(w, a); RETURN = merge_events_by_keys(w, [`"app`"]);"
$body = @{query=@($query);timeperiods=@(($start.ToString('o') + '/' + $end.ToString('o')))} | ConvertTo-Json -Compress
$result = Invoke-RestMethod -Method Post -Uri "$base/query/" -Body $body -ContentType 'application/json' -TimeoutSec 30
$totals = @{Coding=0.0;Terminal=0.0;Browser=0.0;Other=0.0}
foreach ($event in $result[0]) {
  $app = [string]$event.data.app
  $category = 'Other'
  if ($app -match '(?i)codex|chatgpt|code\.exe|cursor|antigravity|idea|pycharm') { $category='Coding' }
  elseif ($app -match '(?i)terminal|powershell|cmd\.exe|conhost|wezterm|ubuntu') { $category='Terminal' }
  elseif ($app -match '(?i)chrome|firefox|msedge|brave|safari') { $category='Browser' }
  $duration = [double]$event.duration
  if ([double]::IsNaN($duration) -or [double]::IsInfinity($duration) -or $duration -lt 0) { throw 'Invalid duration' }
  $totals[$category] += $duration
}
$latest = Invoke-RestMethod -Uri "$base/buckets/$([Uri]::EscapeDataString($windows[0].Name))/events?limit=1" -TimeoutSec 10
[pscustomobject]@{host='Windows';status='ok';start=$start.ToString('o');end=$end.ToString('o');latestEvent=$latest[0].timestamp;categories=$totals} | ConvertTo-Json -Compress
