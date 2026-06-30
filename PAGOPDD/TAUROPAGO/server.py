from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import webbrowser
import threading
import os

PUERTO = 8000

os.chdir(os.path.dirname(os.path.abspath(__file__)))

def abrir():
    webbrowser.open(f"http://localhost:{PUERTO}")

print("="*50)
print("PROVSOFT - Servidor Local")
print("="*50)
print(f"URL: http://localhost:{PUERTO}")
print("Ctrl+C para cerrar")
print("="*50)

threading.Timer(1, abrir).start()

ThreadingHTTPServer(
    ("localhost", PUERTO),
    SimpleHTTPRequestHandler
).serve_forever()