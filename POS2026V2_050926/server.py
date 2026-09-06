import http.server
import socketserver
import webbrowser
import threading
import os
import sys

PORT = 8000
DIRECTORIO = os.path.dirname(os.path.abspath(__file__))
os.chdir(DIRECTORIO)

class CustomHandler(http.server.SimpleHTTPRequestHandler):

    def end_headers(self):
        # Modulos ES, acceso local y archivos siempre actualizados.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def guess_type(self, path):
        if path.endswith(".js"):
            return "application/javascript"
        return super().guess_type(path)

def abrir_navegador():
    webbrowser.open(f"http://localhost:{PORT}/index.html")

class ServidorLocal(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

try:
    with ServidorLocal(("127.0.0.1", PORT), CustomHandler) as httpd:
        print("=" * 58)
        print(" PROVSOFT POS 2026 - SERVIDOR LOCAL")
        print(f" http://localhost:{PORT}/index.html")
        print(" Para cerrar el servidor presiona CTRL + C")
        print("=" * 58)
        threading.Timer(1, abrir_navegador).start()
        httpd.serve_forever()
except OSError as err:
    print(f"No se pudo iniciar el puerto {PORT}: {err}")
    print("Cierra otra ventana del POS que siga abierta e intenta nuevamente.")
    sys.exit(1)
except KeyboardInterrupt:
    print("\nServidor PROVSOFT cerrado.")
