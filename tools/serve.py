"""Local-only static preview with no uploads sent to a server."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from pathlib import Path
import argparse
import webbrowser

parser=argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=4173)
parser.add_argument('--open', action='store_true')
args=parser.parse_args()
root=Path(__file__).resolve().parents[1] / 'dist'
handler=partial(SimpleHTTPRequestHandler, directory=str(root))
server=ThreadingHTTPServer(('127.0.0.1',args.port),handler)
url=f'http://127.0.0.1:{args.port}'
print(f'Little us: {url}',flush=True)
if args.open:webbrowser.open(url)
try:server.serve_forever()
except KeyboardInterrupt:pass
finally:server.server_close()
