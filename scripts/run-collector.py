"""Serialize local collection and publish a small status record, without log text."""
import argparse
import datetime as dt
import fcntl
import json
import os
import pathlib
import shutil
import signal
import subprocess
import tempfile


def stamp():
    return dt.datetime.now(dt.timezone.utc).isoformat().replace('+00:00', 'Z')


def write_status(folder, value):
    folder.mkdir(mode=0o700, parents=True, exist_ok=True)
    if folder.is_symlink():
        raise ValueError('Status folder must not be a symlink')
    handle, temporary = tempfile.mkstemp(prefix='.collector-', suffix='.tmp', dir=folder)
    try:
        with os.fdopen(handle, 'w') as stream:
            json.dump(value, stream, allow_nan=False)
        os.replace(temporary, folder / 'collector.json')
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def stop_child(child):
    # This process group was created exclusively for this collection.
    if child.poll() is not None:
        return
    try:
        os.killpg(child.pid, signal.SIGTERM)
        child.wait(timeout=5)
    except subprocess.TimeoutExpired:
        os.killpg(child.pid, signal.SIGKILL)
        child.wait()
    except ProcessLookupError:
        pass


def run_collection(root, node, interval=0, timeout=240):
    root = pathlib.Path(root).resolve(strict=True)
    runtime = root / '.runtime'
    runtime.mkdir(mode=0o700, exist_ok=True)
    if runtime.is_symlink():
        raise ValueError('Runtime folder must not be a symlink')
    lock = os.open(runtime / 'collector.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return 'busy'
        started = stamp()
        state = dict(state='running', startedAt=started, finishedAt=None,
                     intervalSeconds=interval, maxRunSeconds=timeout)
        folder = root / 'public' / 'local'
        write_status(folder, state)
        child = None
        try:
            # Keep the normal installed tool locations available at login.
            env = dict(os.environ)
            env['PATH'] = os.pathsep.join(dict.fromkeys([
                str(pathlib.Path(node).parent), '/opt/homebrew/bin', '/usr/local/bin',
                '/usr/bin', '/bin', env.get('PATH', '')]))
            child = subprocess.Popen([node, str(root / 'scripts' / 'collect-dashboard.mjs')],
                                     cwd=root, env=env, stdout=subprocess.DEVNULL,
                                     stderr=subprocess.DEVNULL, start_new_session=True)
            if child.wait(timeout=timeout) != 0:
                raise ValueError('Collector failed')
            snapshot_file = folder / 'usage.json'
            if snapshot_file.stat().st_size > 16_000_000:
                raise ValueError('Snapshot too large')
            snapshot = json.loads(snapshot_file.read_text())
            snapshot_at = snapshot.get('collectedAt')
            if not isinstance(snapshot_at, str) or dt.datetime.fromisoformat(snapshot_at.replace('Z', '+00:00')) < dt.datetime.fromisoformat(started.replace('Z', '+00:00')):
                raise ValueError('No new snapshot')
            sources = snapshot.get('activity', []) + snapshot.get('tokens', []) + snapshot.get('settings', [])
            sources += [snapshot[k] for k in ('quota', 'localModel') if isinstance(snapshot.get(k), dict)]
            sources = [s for s in sources if s.get('status') != 'not-connected']
            read = sum(s.get('status') == 'ok' for s in sources)
            state.update(state='ok' if sources and read == len(sources) else 'partial',
                         snapshotAt=snapshot_at, sourcesRead=read, sourcesConfigured=len(sources))
        except (Exception, KeyboardInterrupt):
            if child is not None:
                stop_child(child)
            state['state'] = 'failed'
        state['finishedAt'] = stamp()
        write_status(folder, state)
        return state['state']
    finally:
        os.close(lock)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--node', default=shutil.which('node'))
    parser.add_argument('--interval', type=int, default=0)
    args = parser.parse_args()
    if not args.node or not os.path.isabs(args.node) or args.interval not in (0, 300):
        parser.error('Use an absolute Node path and a zero or 300-second cadence')
    def interrupted(signum, frame):
        raise InterruptedError('Collection stopped')
    signal.signal(signal.SIGTERM, interrupted)
    result = run_collection(pathlib.Path(__file__).resolve().parent.parent, args.node, args.interval)
    print(json.dumps(dict(collection=result)))
    raise SystemExit(1 if result == 'failed' else 0)
