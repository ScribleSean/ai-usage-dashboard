import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('prepare_runtime', Path(__file__).with_name('prepare-runtime.py'))
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)


class RuntimeTests(unittest.TestCase):
    def test_safe_symlink(self):
        member = tarfile.TarInfo('python/bin/python3')
        member.type, member.linkname = tarfile.SYMTYPE, 'python3.13'
        runtime.validate_member(member)

    def test_unsafe_paths_and_special_files(self):
        for name in ('/etc/file', 'python/../escape', 'python\\escape'):
            with self.subTest(name=name), self.assertRaises(ValueError):
                runtime.validate_member(tarfile.TarInfo(name))
        member = tarfile.TarInfo('python/device')
        member.type = tarfile.CHRTYPE
        with self.assertRaises(ValueError):
            runtime.validate_member(member)

    def test_escaping_symlinks(self):
        for target in ('/etc/file', '../../outside', '..\\outside'):
            member = tarfile.TarInfo('python/bin/python3')
            member.type, member.linkname = tarfile.SYMTYPE, target
            with self.subTest(target=target), self.assertRaises(ValueError):
                runtime.validate_member(member)

    def test_checksum_and_filename(self):
        with tempfile.TemporaryDirectory() as directory:
            cache = Path(directory)
            (cache / 'asset').write_bytes(b'fixture')
            asset = {'filename':'asset', 'sha256':hashlib.sha256(b'fixture').hexdigest()}
            self.assertEqual(runtime.verified_archive(cache, asset), cache / 'asset')
            with self.assertRaises(ValueError):
                runtime.verified_archive(cache, {**asset, 'sha256':'0'*64})
            with self.assertRaises(ValueError):
                runtime.verified_archive(cache, {**asset, 'filename':'../asset'})

    def test_payload_selection_licenses_and_no_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            cache = Path(directory)
            assets = {}
            for kind, files in {'node':{'node-test/bin/node':b'node', 'node-test/LICENSE':b'notice',
                                        'node-test/lib/node_modules/npm/index.js':b'exclude'},
                                'python':{'python/bin/python3.13':b'python', 'python/lib/LICENSE.txt':b'license',
                                          'python/lib/__pycache__/module.pyc':b'exclude'}}.items():
                archive = cache / (kind + '.tar.gz')
                with tarfile.open(archive, 'w:gz') as target:
                    for name, data in files.items():
                        item = tarfile.TarInfo(name)
                        item.size = len(data)
                        target.addfile(item, io.BytesIO(data))
                assets[kind] = {'filename':archive.name, 'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()}
            assets['pythonFull'] = assets['python']
            output = cache / 'payload.tar.gz'
            with patch.object(runtime, 'python_notices', return_value=({'licenses/dependency.txt':b'notice'}, [])):
                result = runtime.prepare(cache, output, assets)
                self.assertEqual(result['pythonDependencyNotices'], 1)
                original = output.read_bytes()
                second = cache / 'same-payload-another-name.tar.gz'
                runtime.prepare(cache, second, assets)
                self.assertEqual(original, second.read_bytes())
                with self.assertRaises(FileExistsError):
                    runtime.prepare(cache, output, assets)
                self.assertEqual(original, output.read_bytes())
            with tarfile.open(output) as payload:
                self.assertEqual(set(payload.getnames()), {'node/bin/node', 'node/LICENSE',
                    'python/bin/python3.13', 'python/lib/LICENSE.txt', 'python/licenses/dependency.txt', 'runtime-manifest.json'})

    def test_missing_notice_exception_is_limited_to_pinned_system_zlib(self):
        asset = {'version':'3.13.15', 'build':'20260901'}
        record = {'license_paths':['licenses/LICENSE.zlib-ng.txt'], 'links':[{'name':'z', 'system':True}]}
        metadata = {'python_version':'3.13.15', 'target_triple':'aarch64-apple-darwin',
                    'build_info':{'extensions':{'zlib':[record]}}}
        def read(command, **kwargs):
            return b'' if '-tf' in command else json.dumps(metadata).encode()
        with patch.object(runtime.subprocess, 'check_output', side_effect=read):
            notices, exceptions = runtime.python_notices(Path('fixture.tar.zst'), asset)
            self.assertEqual(notices, {})
            self.assertEqual(len(exceptions), 1)
            with self.assertRaises(ValueError):
                runtime.python_notices(Path('fixture.tar.zst'), {**asset, 'build':'different'})
            record['links'][0]['system'] = False
            with self.assertRaises(ValueError):
                runtime.python_notices(Path('fixture.tar.zst'), asset)
            record['links'][0]['system'] = True
            record['license_paths'] = ['licenses/LICENSE.unknown.txt']
            with self.assertRaises(ValueError):
                runtime.python_notices(Path('fixture.tar.zst'), asset)


if __name__ == '__main__':
    unittest.main()
