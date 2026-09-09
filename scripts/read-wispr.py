"""Read only numeric Wispr history metadata. Never fetch text or audio columns."""
import datetime
import json
import math
import pathlib
import re
import sqlite3
import sys
import time
from zoneinfo import ZoneInfo


def report(home, mode):
    relative = ('Library/Application Support/Wispr Flow/flow.sqlite' if mode == 'mac'
                else 'AppData/Roaming/Wispr Flow/flow.sqlite')
    database = pathlib.Path(home) / relative
    if not database.is_file():
        return {'status': 'not-found'}
    connection = sqlite3.connect(database.as_uri() + '?mode=ro', uri=True, timeout=2)
    try:
        connection.execute('PRAGMA query_only=ON')
        connection.execute('PRAGMA trusted_schema=OFF')
        allowed = {'timestamp', 'duration', 'numWords'}

        def authorize(action, table, column, *_):
            if action == sqlite3.SQLITE_SELECT:
                return sqlite3.SQLITE_OK
            if action == sqlite3.SQLITE_READ and table == 'History' and column in allowed:
                return sqlite3.SQLITE_OK
            return sqlite3.SQLITE_DENY

        connection.set_authorizer(authorize)
        deadline = time.monotonic() + 20
        connection.set_progress_handler(lambda: int(time.monotonic() > deadline), 1000)
        days = {}
        for index, (stamp, duration, words) in enumerate(connection.execute(
                'SELECT timestamp, duration, numWords FROM History')):
            if index >= 1000000:
                raise ValueError('History exceeds bounded scan')
            parsed = datetime.datetime.fromisoformat(re.sub(r'\s+([+-]\d\d:\d\d)$', r'\1', stamp))
            if parsed.tzinfo is None:
                raise ValueError('Unknown timestamp timezone')
            day = parsed.astimezone(ZoneInfo('America/New_York')).date().isoformat()
            row = days.setdefault(day, {'date': day, 'transcriptions': 0, 'words': 0,
                                       'audioSeconds': 0, 'wordRecords': 0, 'audioRecords': 0,
                                       'engines': []})
            row['transcriptions'] += 1
            if isinstance(words, int) and not isinstance(words, bool) and 0 <= words <= 2**53 - 1:
                row['words'] += words
                row['wordRecords'] += 1
            if isinstance(duration, (float, int)) and math.isfinite(duration) and 0 <= duration <= 2**53 - 1:
                row['audioSeconds'] += duration
                row['audioRecords'] += 1
        return {'status': 'ok', 'days': sorted(days.values(), key=lambda row: row['date'])}
    finally:
        connection.close()


if __name__ == '__main__':
    try:
        result = report(sys.argv[1], globals().get('MODE', 'mac'))
    except Exception:
        result = {'status': 'unavailable'}
    print(json.dumps(result, allow_nan=False))
