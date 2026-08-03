from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os
import webbrowser

PORT = 8000
BASE_DIR = Path(__file__).resolve().parent

if __name__ == "__main__":
    os.chdir(BASE_DIR)
    url = f"http://localhost:{PORT}/index.html"
    print(f"PROVSOFT Entradas disponible en {url}")
    webbrowser.open(url)
    ThreadingHTTPServer(("0.0.0.0", PORT), SimpleHTTPRequestHandler).serve_forever()
