"""Development-only static server. Serve web/ and never the repository root."""
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import argparse
import ssl

parser = argparse.ArgumentParser()
parser.add_argument('--host', default='127.0.0.1')
parser.add_argument('--port', type=int, default=8765)
parser.add_argument('--cert')
parser.add_argument('--key')
args = parser.parse_args()
if bool(args.cert) != bool(args.key):
    parser.error('--cert and --key must be supplied together')
web = Path(__file__).resolve().parents[1] / 'web'
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(web), **kw)
    def list_directory(self, path):
        self.send_error(403, 'Directory listing disabled')
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
server = ThreadingHTTPServer((args.host, args.port), Handler)
if args.cert:
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(args.cert, args.key)
    server.socket = context.wrap_socket(server.socket, server_side=True)
print(f"Serving {'https' if args.cert else 'http'} on {args.host}:{args.port}", flush=True)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
