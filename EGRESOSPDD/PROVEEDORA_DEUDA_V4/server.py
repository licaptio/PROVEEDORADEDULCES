from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import os, webbrowser, threading

HOST = '127.0.0.1'
PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE_DIR)
URL = f'http://{HOST}:{PORT}/assets/DUDACONFI_V4.html'

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        super().end_headers()

if __name__ == '__main__':
    print('=' * 58)
    print(' PROVSOFT - DEUDA INTEGRA V4')
    print(f' {URL}')
    print(' Cierra esta ventana para detener el servidor.')
    print('=' * 58)
    threading.Timer(1.0, lambda: webbrowser.open(URL)).start()
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
