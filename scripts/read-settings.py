"""Summarize saved Codex settings and tool-call categories without exporting text."""
import datetime as dt
import json
import math
import pathlib
import sys
from zoneinfo import ZoneInfo

FIELDS = ['input_tokens', 'cached_input_tokens', 'cache_write_input_tokens', 'output_tokens', 'reasoning_output_tokens', 'total_tokens']
EFFORTS = {'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'}

def number(x):
    return x if type(x) in (int, float) and math.isfinite(x) and x >= 0 else None

def label(x):
    return x if isinstance(x, str) and 0 < len(x) <= 100 and all(c.isalnum() or c in '-_./:' for c in x) else 'unknown'

def summarize(events, cutoff):
    model, effort, speed = 'unknown', 'unknown', 'unknown'
    prior = None
    profiles, tools = {}, {}
    seen_calls = set()
    for event in events:
        p = event.get('payload') or {}
        if not isinstance(p, dict):
            continue
        if p.get('type') == 'thread_settings_applied':
            s = p.get('thread_settings') or {}
            model = label(s.get('model'))
            effort = s.get('reasoning_effort') if s.get('reasoning_effort') in EFFORTS else 'unknown'
            speed = {'default':'standard', 'priority':'fast', 'fast':'fast'}.get(s.get('service_tier'), 'unknown')
        if event.get('type') == 'turn_context':
            next_model = label(p.get('model'))
            if next_model != model:
                speed = 'unknown'
            model = next_model
            effort = p.get('effort') if p.get('effort') in EFFORTS else 'unknown'
            if 'service_tier' in p:
                speed = {'default':'standard', 'priority':'fast', 'fast':'fast'}.get(p['service_tier'], 'unknown')
        try:
            stamp = dt.datetime.fromisoformat(event['timestamp'].replace('Z', '+00:00'))
            date = stamp.astimezone(ZoneInfo('America/New_York')).date().isoformat()
        except (ValueError, KeyError, TypeError):
            continue
        if event.get('type') == 'response_item' and p.get('type') in ('function_call', 'custom_tool_call'):
            call_id = p.get('call_id')
            if not isinstance(call_id, str) or call_id in seen_calls:
                continue
            seen_calls.add(call_id)
            name = str(p.get('name', '')).lower()
            category = 'Shell' if any(x in name for x in ('exec_command','write_stdin','shell')) else 'File edits' if 'apply_patch' in name else 'Browser' if any(x in name for x in ('browser','cua')) else 'Research' if any(x in name for x in ('web','search')) else 'Other tools'
            if stamp >= cutoff:
                tools[(date,category)] = tools.get((date,category),0)+1
        if event.get('type') != 'event_msg' or p.get('type') != 'token_count':
            continue
        raw = (p.get('info') or {}).get('total_token_usage')
        if not isinstance(raw, dict):
            continue
        current = {k:number(raw.get(k, 0 if k == 'cache_write_input_tokens' else None)) for k in FIELDS}
        if any(v is None for v in current.values()):
            continue
        delta = {k:current[k]-(prior[k] if prior else 0) for k in FIELDS}
        prior = current
        if stamp < cutoff or any(v < 0 for v in delta.values()) or delta['total_tokens'] == 0:
            continue
        # Codex input includes cache reads and writes. Output includes reasoning.
        uncached = delta['input_tokens']-delta['cached_input_tokens']-delta['cache_write_input_tokens']
        if uncached < 0 or abs(delta['input_tokens']+delta['output_tokens']-delta['total_tokens']) > 1:
            continue
        key = (date,model,effort,speed)
        row = profiles.setdefault(key, dict(date=date,model=model,effort=effort,speed=speed,inputTokens=0,cacheReadTokens=0,cacheCreationTokens=0,outputTokens=0,reasoningOutputTokens=0,totalTokens=0))
        for dest, value in dict(inputTokens=uncached,cacheReadTokens=delta['cached_input_tokens'],cacheCreationTokens=delta['cache_write_input_tokens'],outputTokens=delta['output_tokens'],reasoningOutputTokens=delta['reasoning_output_tokens'],totalTokens=delta['total_tokens']).items():
            row[dest] += value
    return list(profiles.values()), [dict(date=d,category=c,count=n) for (d,c),n in tools.items()]

def collect(folder):
    root = pathlib.Path(folder).resolve(strict=True)
    cutoff = dt.datetime.now(dt.timezone.utc)-dt.timedelta(days=8)
    candidates = []
    for name in ('sessions', 'archived_sessions'):
        candidates.extend((root/name).rglob('*.jsonl'))
    if len(candidates) > 20000:
        raise ValueError('Too many files')
    sessions = {}
    for file in candidates:
        if file.is_symlink() or not file.resolve().is_relative_to(root):
            continue
        info = file.stat()
        if info.st_mtime < cutoff.timestamp():
            continue
        with file.open() as stream:
            first = stream.readline(1_000_000)
        try:
            meta = json.loads(first)
            identity = meta.get('payload',{}).get('id') if meta.get('type') == 'session_meta' else None
        except ValueError:
            identity = None
        identity = identity or str(file)
        if identity not in sessions or info.st_size > sessions[identity][1]:
            sessions[identity] = (file,info.st_size)
    if sum(size for _,size in sessions.values()) > 1_000_000_000:
        raise ValueError('Report exceeds scan budget')
    profiles, tools = {}, {}
    for file, _ in sessions.values():
        def events():
            with file.open() as stream:
                for line in stream:
                    if len(line) > 8_000_000:
                        continue
                    try:
                        row = json.loads(line)
                        if isinstance(row,dict):
                            yield row
                    except ValueError:
                        pass
        rows, calls = summarize(events(), cutoff)
        for row in rows:
            key=(row['date'],row['model'],row['effort'],row['speed'])
            if key not in profiles:
                profiles[key]=row
            else:
                for field in ('inputTokens','cacheReadTokens','cacheCreationTokens','outputTokens','reasoningOutputTokens','totalTokens'):
                    profiles[key][field]+=row[field]
        for row in calls:
            key=(row['date'],row['category'])
            tools[key]=tools.get(key,0)+row['count']
    return dict(status='ok',profiles=list(profiles.values()),tools=[dict(date=d,category=c,count=n) for (d,c),n in sorted(tools.items())],scope='Recent saved Codex logs only')

if __name__ == '__main__':
    print(json.dumps(collect(sys.argv[1]),allow_nan=False))
