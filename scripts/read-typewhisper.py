"""Read only TypeWhisper's aggregate statistics, never history or audio stores."""
import datetime as dt
from contextlib import closing
import json
import math
import os
from pathlib import Path
import sqlite3
import stat
import sys

MAX_BYTES = 8 * 1024 * 1024
MAX_DAYS = 36600
ENGINES = {
    'Apple Speech': 'Apple Speech', 'apple-speech': 'Apple Speech',
    'speech-analyzer': 'Apple Speech', 'com.typewhisper.speech-analyzer': 'Apple Speech',
    'speechAnalyzer': 'Apple Speech', 'com.typewhisper.speechanalyzer': 'Apple Speech',
    'sherpa-onnx': 'Parakeet / sherpa-onnx',
    'com.typewhisper.sherpa-onnx': 'Parakeet / sherpa-onnx',
    'whisperkit': 'WhisperKit', 'com.typewhisper.whisperkit': 'WhisperKit',
    'whisper-cpp': 'Whisper.cpp', 'com.typewhisper.whisper-cpp': 'Whisper.cpp',
}


def number(value, integer=False):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError('Invalid aggregate')
    if not math.isfinite(value) or value < 0 or value > 2**53 - 1:
        raise ValueError('Invalid aggregate')
    if integer and int(value) != value:
        raise ValueError('Invalid count')
    return int(value) if integer else value


def regular_file(file):
    info = file.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_size > MAX_BYTES:
        raise ValueError('Unsupported statistics file')
    # Reject symlinked parent directories too, including source routing changes.
    if any(parent.is_symlink() for parent in file.parents):
        raise ValueError('Unsupported statistics path')
    return info


def engines(raw, separator, total):
    if isinstance(raw, str):
        raw = json.loads(raw)
    if raw is None:
        return []
    if not isinstance(raw, dict) or len(raw) > 1000:
        raise ValueError('Invalid engine counts')
    counts = {}
    for key, count in raw.items():
        count = number(count, True)
        # Never emit model aliases, user-defined names, application names or paths.
        engine = ENGINES.get(key.split(separator, 1)[0], 'Unknown')
        counts[engine] = counts.get(engine, 0) + count
    if sum(counts.values()) > total:
        raise ValueError('Inconsistent engine counts')
    return [{'engine': key, 'transcriptions': count} for key, count in sorted(counts.items())]


def day(date, count, words, seconds, models, separator):
    parsed = dt.date.fromisoformat(date)
    if not 2001 <= parsed.year <= 2200:
        raise ValueError('Invalid date')
    count = number(count, True)
    return {'date': parsed.isoformat(), 'transcriptions': count,
            'words': number(words, True), 'audioSeconds': number(seconds),
            'engines': engines(models, separator, count)}


def read_mac(file):
    regular_file(file)
    with closing(sqlite3.connect(file.as_uri() + '?mode=ro', uri=True, timeout=2)) as db:
        db.execute('PRAGMA query_only=ON')
        columns = {row[1] for row in db.execute('PRAGMA table_info(ZUSAGESTATISTICSDAY)')}
        required = {'ZDAY', 'ZTRANSCRIPTIONCOUNT', 'ZTOTALWORDS', 'ZTOTALDURATIONSECONDS'}
        if not required <= columns:
            raise ValueError('Unsupported statistics schema')
        model_column = 'ZMODELCOUNTSJSON' if 'ZMODELCOUNTSJSON' in columns else 'NULL'
        rows = db.execute('SELECT ZDAY,ZTRANSCRIPTIONCOUNT,ZTOTALWORDS,ZTOTALDURATIONSECONDS,'
                          + model_column + ' FROM ZUSAGESTATISTICSDAY LIMIT ?', (MAX_DAYS + 1,)).fetchall()
    if len(rows) > MAX_DAYS:
        raise ValueError('Statistics limit exceeded')
    result = []
    for stamp, count, words, seconds, models in rows:
        stamp = number(stamp)
        date = dt.datetime.fromtimestamp(stamp + 978307200).date().isoformat()
        result.append(day(date, count, words, seconds, models, '||'))
    return result


def read_windows(file):
    before = regular_file(file)
    fd = os.open(file, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0) | getattr(os, 'O_NONBLOCK', 0) | getattr(os, 'O_BINARY', 0))
    with os.fdopen(fd, 'r', encoding='utf-8-sig') as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_size > MAX_BYTES or (info.st_dev, info.st_ino) != (before.st_dev, before.st_ino):
            raise ValueError('Unsupported statistics file')
        text = stream.read(MAX_BYTES + 1)
        after = regular_file(file)
        if (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns) != (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns):
            raise ValueError('Changing statistics file')
    if len(text) > MAX_BYTES:
        raise ValueError('Statistics limit exceeded')
    raw = json.loads(text)
    if raw.get('version') != 1 or not isinstance(raw.get('days'), list) or len(raw['days']) > MAX_DAYS:
        raise ValueError('Unsupported statistics schema')
    return [day(dt.datetime.fromisoformat(row['day']).date().isoformat(),
                row['transcriptionCount'], row['totalWords'], row['totalDurationSeconds'],
                row.get('modelCounts'), '\x1f') for row in raw['days']]


def report(mode, home):
    home = Path(home)
    if mode == 'mac':
        files = [home / 'Library/Application Support/TypeWhisper/usage-statistics.store']
        reader = read_mac
    elif mode == 'windows':
        local = home / 'AppData/Local'
        files = [local / 'Packages/TypeWhisper.TypeWhisper_51tqb5623pxja/LocalCache/Local/TypeWhisper-UserData/Data/usage-statistics.json',
                 local / 'TypeWhisper-UserData/Data/usage-statistics.json']
        reader = read_windows
    else:
        raise ValueError('Unsupported platform')
    existing = [file for file in files if file.exists() or file.is_symlink()]
    if not existing:
        return {'status': 'not-found'}
    # Do not double count or silently choose between Store and direct installations.
    if len(existing) != 1:
        return {'status': 'ambiguous'}
    rows = sorted(reader(existing[0]), key=lambda row: row['date'])
    if len({row['date'] for row in rows}) != len(rows):
        raise ValueError('Duplicate aggregate dates')
    return {'status': 'ok', 'days': rows, 'calendar': 'device-local', 'scope': 'retained-transcriptions'}


if __name__ == '__main__':
    try:
        print(json.dumps(report(MODE, sys.argv[1]), allow_nan=False))
    except Exception:
        print(json.dumps({'status': 'unavailable'}))
