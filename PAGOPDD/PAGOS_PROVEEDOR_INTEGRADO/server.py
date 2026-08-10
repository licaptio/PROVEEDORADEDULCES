from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import os, webbrowser

PORT = 8000
os.chdir(os.path.dirname(os.path.abspath(__file__)))
url = f"http://localhost:{PORT}/"
print(f"PROVSOFT - Pagos a Proveedores\nAbriendo {url}\nCTRL+C para cerrar.")
webbrowser.open(url)
ThreadingHTTPServer(("127.0.0.1", PORT), SimpleHTTPRequestHandler).serve_forever()
