import http.server
import socketserver
import webbrowser
import threading
import os

PORT = 8000

# 📂 Carpeta donde está tu index.html
DIRECTORIO = os.path.dirname(os.path.abspath(__file__))

os.chdir(DIRECTORIO)

def abrir_navegador():
    webbrowser.open(f"http://localhost:{PORT}/index.html")

Handler = http.server.SimpleHTTPRequestHandler

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Servidor corriendo en http://localhost:{PORT}/index.html")
    
    threading.Timer(1, abrir_navegador).start()
    
    httpd.serve_forever()
