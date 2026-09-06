"""Read bounded benchmark metrics. Never transfer prompts or model responses."""
import json
import math
import pathlib
import sys

def number(value):
    return value if type(value) in (int, float) and math.isfinite(value) and value >= 0 else None

def collect(folder):
    root = pathlib.Path(folder).resolve(strict=True)
    files = sorted(root.glob('*/*.metrics.json'))
    if len(files) > 2000:
        raise ValueError('Too many receipts')
    rows = []
    for file in files:
        if file.is_symlink() or not file.resolve().is_relative_to(root) or file.stat().st_size > 1_000_000:
            continue
        data = json.loads(file.read_text())
        final = data.get('final') or {}
        model = final.get('model', '')
        if not isinstance(model, str) or len(model) > 100 or not all(c.isalnum() or c in '-_./:' for c in model):
            model = 'unknown'
        rows.append(dict(model=model, status='complete' if data.get('status') == 'complete' else 'incomplete',
            recordedAt=final.get('created_at'), seconds=number(data.get('end_to_end_s')),
            input=number(final.get('prompt_eval_count')), cached=number(final.get('prompt_eval_cached_count')),
            output=number(final.get('eval_count')), ttft=number(data.get('ttft_s')),
            peakGpuMiB=number(data.get('peak_gpu_used_mib'))))
    return dict(status='ok', host='Ubuntu', records=rows)

if __name__ == '__main__':
    print(json.dumps(collect(sys.argv[1]), allow_nan=False))
