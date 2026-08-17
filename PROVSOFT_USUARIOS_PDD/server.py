from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import webbrowser
import threading
import os

PORT = 8080
os.chdir(os.path.dirname(os.path.abspath(__file__)))

def abrir():
    webbrowser.open(f"http://localhost:{PORT}")

threading.Timer(0.8, abrir).start()
print(f"PROVSOFT Usuarios disponible en http://localhost:{PORT}")
print("Ctrl+C para cerrar.")
ThreadingHTTPServer(("127.0.0.1", PORT), SimpleHTTPRequestHandler).serve_forever()
