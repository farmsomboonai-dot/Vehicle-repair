"""Static server สำหรับระบบซ่อมบำรุงรถ (แอปแยกจากระบบขายไข่)

วิธีรัน: /usr/bin/python3 serve.py  ->  http://127.0.0.1:5174
"""
import http.server
import os

APP_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(APP_DIR)


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".jsx": "text/babel",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=APP_DIR, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


http.server.ThreadingHTTPServer(("127.0.0.1", 5174), Handler).serve_forever()
