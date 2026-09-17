from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os
import webbrowser

HOST = "127.0.0.1"
PORT = 8000
BASE_DIR = Path(__file__).resolve().parent

class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

def main():
    os.chdir(BASE_DIR)
    url = f"http://{HOST}:{PORT}"
    print("=" * 55)
    print("PROVSOFT RECORDATORIOS - SERVIDOR DE PRUEBAS")
    print(f"Abre: {url}")
    print("Para cerrar: Ctrl + C")
    print("=" * 55)

    try:
        webbrowser.open(url)
    except Exception:
        pass

    servidor = ThreadingHTTPServer((HOST, PORT), NoCacheHandler)
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
    finally:
        servidor.server_close()

if __name__ == "__main__":
    main()
