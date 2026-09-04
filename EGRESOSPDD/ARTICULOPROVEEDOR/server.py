from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import os
import webbrowser

PUERTO = 8000

class Handler(SimpleHTTPRequestHandler):

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def guess_type(self, path):
        if path.endswith(".js"):
            return "application/javascript"
        return super().guess_type(path)


if __name__ == "__main__":

    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    servidor = ThreadingHTTPServer(("0.0.0.0", PUERTO), Handler)

    print("=" * 50)
    print("PROVSOFT - Buscador de Conceptos")
    print("=" * 50)
    print(f"Servidor: http://localhost:{PUERTO}")
    print("=" * 50)

    webbrowser.open(f"http://localhost:{PUERTO}")

    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
        servidor.server_close()