"""家庭局域网小屋服务。

本机当主机：同 Wi-Fi 的手机 / 平板用浏览器打开即可。
照片、视频、音乐和文字记录都保存在项目里的「小屋数据」文件夹。
"""
from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import re
import socket
import subprocess
import threading
import uuid
import urllib.error
import urllib.request
import webbrowser
from datetime import datetime, timezone
from functools import partial
from http import HTTPStatus
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
DATA = ROOT / '小屋数据'
PHOTOS = DATA / '照片'
VIDEOS = DATA / '视频'
MUSIC = DATA / '音乐'
DB = DATA / '数据库'
COLLECTIONS = {
    'memories': DB / 'memories.json',
    'journeys': DB / 'journeys.json',
    'albums': DB / 'albums.json',
    'settings': DB / 'settings.json',
}
MEDIA_DIRS = {
    'photos': PHOTOS,
    'videos': VIDEOS,
    'music': MUSIC,
}
LOCK = threading.RLock()
MAX_UPLOAD = 400 * 1024 * 1024
DATA_URL_RE = re.compile(r'^data:([a-z0-9.+/-]+);base64,([A-Za-z0-9+/=]+)$', re.I)


def ensure_dirs():
    for path in (PHOTOS, VIDEOS, MUSIC, DB):
        path.mkdir(parents=True, exist_ok=True)
    for path in COLLECTIONS.values():
        if not path.exists():
            path.write_text('[]' if path.name != 'settings.json' else '{}', encoding='utf-8')


def lan_ips():
    ips = []
    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        probe.connect(('8.8.8.8', 80))
        ips.append(probe.getsockname()[0])
        probe.close()
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if ip and not ip.startswith('127.') and ip not in ips:
                ips.append(ip)
    except OSError:
        pass
    return ips


def print_banner(port):
    local = f'http://127.0.0.1:{port}'
    print()
    print('========================================')
    print('  小小的我们 · 已在本机启动')
    print('========================================')
    print(f'  本机打开：{local}')
    for ip in lan_ips():
        print(f'  手机打开：http://{ip}:{port}')
    if not lan_ips():
        print('  手机打开：请确认电脑已连 Wi-Fi 后再试')
    print(f'  数据目录：{DATA}')
    print('  同一 Wi-Fi 下，用手机浏览器输入上面的「手机打开」地址即可。')
    print('  这个窗口请保持打开；关掉就等于关闭小屋。')
    print('  终端里按 Control+C 可关闭。')
    print('========================================')
    print(flush=True)
    return local


def probe_home(port):
    try:
        with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/health', timeout=1.5) as response:
            data = json.loads(response.read().decode('utf-8'))
            if data.get('ok') and data.get('mode') == 'home':
                return data
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError, OSError):
        return None
    return None


def free_port(port):
    try:
        result = subprocess.run(
            ['lsof', '-tiTCP:%d' % port, '-sTCP:LISTEN'],
            capture_output=True, text=True, check=False,
        )
        pids = [line.strip() for line in result.stdout.splitlines() if line.strip()]
        for pid in pids:
            subprocess.run(['kill', '-9', pid], check=False)
        return bool(pids)
    except OSError:
        return False


def read_collection(name):
    path = COLLECTIONS[name]
    with LOCK:
        data = json.loads(path.read_text(encoding='utf-8') or ('[]' if name != 'settings' else '{}'))
        if name == 'settings':
            return data if isinstance(data, dict) else {}
        return data if isinstance(data, list) else []


def write_collection(name, data):
    path = COLLECTIONS[name]
    with LOCK:
        tmp = path.with_suffix('.tmp')
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
        tmp.replace(path)


def save_bytes(kind, raw, content_type='', filename=''):
    folder = MEDIA_DIRS[kind]
    mime = (content_type or '').split(';')[0].strip().lower()
    ext = {
        'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
        'audio/mpeg': '.mp3', 'audio/mp4': '.m4a', 'audio/x-m4a': '.m4a', 'audio/wav': '.wav',
        'audio/x-wav': '.wav', 'audio/ogg': '.ogg',
        'video/mp4': '.mp4', 'video/webm': '.webm', 'video/ogg': '.ogv', 'video/quicktime': '.mov',
    }.get(mime)
    if not ext and filename:
        suffix = Path(filename).suffix.lower()
        if suffix in {'.jpg', '.jpeg', '.png', '.webp', '.mp3', '.m4a', '.wav', '.ogg', '.mp4', '.webm', '.ogv', '.mov'}:
            ext = '.jpg' if suffix == '.jpeg' else suffix
    if not ext:
        ext = '.bin'
    name = f'{datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")}-{uuid.uuid4().hex[:10]}{ext}'
    (folder / name).write_bytes(raw)
    chinese = {'photos': '照片', 'videos': '视频', 'music': '音乐'}[kind]
    return f'/media/{chinese}/{name}'


def materialize(value):
    if isinstance(value, dict):
        return {k: materialize(v) for k, v in value.items()}
    if isinstance(value, list):
        return [materialize(v) for v in value]
    if not isinstance(value, str):
        return value
    match = DATA_URL_RE.match(value)
    if not match or len(value) < 64:
        return value
    mime = match.group(1).lower()
    raw = base64.b64decode(match.group(2))
    if mime.startswith('image/'):
        kind = 'photos'
    elif mime.startswith('video/'):
        kind = 'videos'
    elif mime.startswith('audio/'):
        kind = 'music'
    else:
        return value
    return save_bytes(kind, raw, mime)


class HomeHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **getattr(SimpleHTTPRequestHandler, 'extensions_map', {}),
        '.js': 'application/javascript',
        '.mjs': 'application/javascript',
        '.webp': 'image/webp',
        '.json': 'application/json',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mov': 'video/quicktime',
        '.m4a': 'audio/mp4',
        '.mp3': 'audio/mpeg',
    }

    def log_message(self, fmt, *args):
        if str(self.path).startswith('/api/'):
            super().log_message(fmt, *args)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def send_json(self, payload, status=HTTPStatus.OK):
        raw = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def read_body(self, limit=MAX_UPLOAD):
        length = int(self.headers.get('Content-Length') or 0)
        if length <= 0:
            return b''
        if length > limit:
            raise ValueError('文件太大了，请换小一些的。')
        return self.rfile.read(length)

    def send_file(self, file_path: Path):
        if not file_path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        ctype = mimetypes.guess_type(str(file_path))[0] or 'application/octet-stream'
        data = file_path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        if path == '/api/health':
            port = self.server.server_address[1]
            self.send_json({
                'ok': True,
                'mode': 'home',
                'dataDir': str(DATA),
                'lanUrls': [f'http://{ip}:{port}' for ip in lan_ips()],
            })
            return
        if path.startswith('/api/store/'):
            parts = [p for p in path.split('/') if p]
            if len(parts) == 3 and parts[2] in COLLECTIONS:
                self.send_json(read_collection(parts[2]))
                return
            if len(parts) == 4 and parts[2] in COLLECTIONS:
                data = read_collection(parts[2])
                key = parts[3]
                item = data.get(key) if parts[2] == 'settings' else next((r for r in data if str(r.get('id')) == key), None)
                if item is None:
                    self.send_json({'error': 'not found'}, HTTPStatus.NOT_FOUND)
                else:
                    self.send_json(item)
                return
            self.send_json({'error': 'bad path'}, HTTPStatus.BAD_REQUEST)
            return
        if path.startswith('/media/'):
            rel = path[len('/media/'):]
            file_path = (DATA / rel).resolve()
            if not str(file_path).startswith(str(DATA.resolve())):
                self.send_error(HTTPStatus.FORBIDDEN)
                return
            return self.send_file(file_path)
        return super().do_GET()

    def do_PUT(self):
        path = unquote(urlparse(self.path).path)
        parts = [p for p in path.split('/') if p]
        if len(parts) != 4 or parts[0] != 'api' or parts[1] != 'store' or parts[2] not in COLLECTIONS:
            self.send_json({'error': 'bad path'}, HTTPStatus.BAD_REQUEST)
            return
        try:
            body = materialize(json.loads(self.read_body(32 * 1024 * 1024).decode('utf-8')))
            collection, key = parts[2], parts[3]
            data = read_collection(collection)
            if collection == 'settings':
                if not isinstance(body, dict):
                    raise ValueError('设置格式不正确。')
                body = {**body, 'id': key}
                data[key] = body
                write_collection(collection, data)
                self.send_json(body)
                return
            if not isinstance(body, dict) or str(body.get('id')) != key:
                raise ValueError('记录格式不正确。')
            items = [r for r in data if str(r.get('id')) != key]
            items.append(body)
            write_collection(collection, items)
            self.send_json(body)
        except Exception as exc:
            self.send_json({'error': str(exc)}, HTTPStatus.BAD_REQUEST)

    def do_DELETE(self):
        path = unquote(urlparse(self.path).path)
        parts = [p for p in path.split('/') if p]
        if len(parts) != 4 or parts[0] != 'api' or parts[1] != 'store' or parts[2] not in COLLECTIONS:
            self.send_json({'error': 'bad path'}, HTTPStatus.BAD_REQUEST)
            return
        collection, key = parts[2], parts[3]
        data = read_collection(collection)
        if collection == 'settings':
            data.pop(key, None)
            write_collection(collection, data)
        else:
            write_collection(collection, [r for r in data if str(r.get('id')) != key])
        self.send_json({'ok': True})

    def do_POST(self):
        path = unquote(urlparse(self.path).path)
        if path == '/api/media':
            try:
                body = json.loads(self.read_body().decode('utf-8'))
                kind = body.get('kind') or 'photos'
                if kind not in MEDIA_DIRS:
                    raise ValueError('不支持的媒体类型。')
                if body.get('dataUrl'):
                    url = materialize(body['dataUrl'])
                    if not isinstance(url, str) or not url.startswith('/media/'):
                        raise ValueError('无法保存这个文件。')
                    self.send_json({'url': url, 'kind': kind})
                    return
                raw = base64.b64decode(body.get('base64') or '')
                if len(raw) > MAX_UPLOAD:
                    raise ValueError('文件太大了，请换小一些的。')
                url = save_bytes(kind, raw, body.get('contentType') or '', body.get('filename') or '')
                self.send_json({'url': url, 'kind': kind})
            except Exception as exc:
                self.send_json({'error': str(exc)}, HTTPStatus.BAD_REQUEST)
            return
        if path == '/api/import':
            try:
                payload = materialize(json.loads(self.read_body(150 * 1024 * 1024).decode('utf-8')))
                if isinstance(payload.get('memories'), list):
                    write_collection('memories', payload['memories'])
                if isinstance(payload.get('journeys'), list):
                    write_collection('journeys', payload['journeys'])
                if isinstance(payload.get('albums'), list):
                    write_collection('albums', payload['albums'])
                settings = read_collection('settings')
                if 'cinema' in payload:
                    if payload['cinema'] is None:
                        settings.pop('cinema-playlist', None)
                    else:
                        settings['cinema-playlist'] = payload['cinema']
                if 'ktv' in payload:
                    if payload['ktv'] is None:
                        settings.pop('ktv-playlist', None)
                    else:
                        settings['ktv-playlist'] = payload['ktv']
                write_collection('settings', settings)
                self.send_json({'ok': True})
            except Exception as exc:
                self.send_json({'error': str(exc)}, HTTPStatus.BAD_REQUEST)
            return
        self.send_json({'error': 'bad path'}, HTTPStatus.BAD_REQUEST)


def main():
    parser = argparse.ArgumentParser(description='小小的我们 · 家庭局域网服务')
    parser.add_argument('--port', type=int, default=4173)
    parser.add_argument('--open', action='store_true')
    parser.add_argument('--host', default='0.0.0.0')
    args = parser.parse_args()
    if not DIST.exists():
        raise SystemExit('还没有 dist/，请先运行：python3 tools/build.py')
    ensure_dirs()

    existing = probe_home(args.port)
    if existing:
        print('小屋已经在运行了，直接打开即可。')
        local = print_banner(args.port)
        if args.open:
            webbrowser.open(local)
        try:
            input('按回车键关闭这个窗口（不会关掉正在运行的小屋）… ')
        except EOFError:
            pass
        return

    handler = partial(HomeHandler, directory=str(DIST))
    try:
        server = ThreadingHTTPServer((args.host, args.port), handler)
    except OSError as exc:
        if getattr(exc, 'errno', None) not in {48, 98}:
            raise
        print('发现端口被占用，正在清理后重新启动…', flush=True)
        free_port(args.port)
        existing = probe_home(args.port)
        if existing:
            print('小屋已经在运行了，直接打开即可。')
            local = print_banner(args.port)
            if args.open:
                webbrowser.open(local)
            try:
                input('按回车键关闭这个窗口（不会关掉正在运行的小屋）… ')
            except EOFError:
                pass
            return
        try:
            server = ThreadingHTTPServer((args.host, args.port), handler)
        except OSError:
            print()
            print('启动失败：4173 端口仍被其他程序占用。')
            print('请关掉之前打开的「启动小屋」窗口后，再双击一次。')
            print()
            try:
                input('按回车键关闭… ')
            except EOFError:
                pass
            raise SystemExit(1)

    local = print_banner(args.port)
    if args.open:
        webbrowser.open(local)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n已关闭小屋服务。', flush=True)
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
