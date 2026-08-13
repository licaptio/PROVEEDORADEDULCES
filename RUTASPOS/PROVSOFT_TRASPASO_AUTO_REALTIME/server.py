from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import webbrowser
import threading
import os

PORT = 8000
os.chdir(os.path.dirname(os.path.abspath(__file__)))

url = f"http://localhost:{PORT}/TRASPASOMOVIL26.html"
threading.Timer(0.8, lambda: webbrowser.open(url)).start()
print(f"PROVSOFT disponible en {url}")
ThreadingHTTPServer(("0.0.0.0", PORT), SimpleHTTPRequestHandler).serve_forever()
