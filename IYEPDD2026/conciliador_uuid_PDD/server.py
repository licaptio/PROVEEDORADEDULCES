import http.server
import socketserver
import webbrowser
import os
import sys
import threading

HOST = "127.0.0.1"
PORT = 8000


class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """
    Servidor HTTP local para PROVSOFT.
    Evita que el navegador conserve versiones anteriores de los archivos.
    """

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, format, *args):
        print(f"[SERVER] {self.address_string()} - {format % args}")


def abrir_navegador():
    url = f"http://{HOST}:{PORT}"
    print(f"\nAbriendo PROVSOFT en: {url}\n")
    webbrowser.open(url)


def main():
    # Hace que el servidor trabaje desde la carpeta donde está server.py
    carpeta_app = os.path.dirname(os.path.abspath(__file__))
    os.chdir(carpeta_app)

    print("=" * 60)
    print("PROVSOFT - SERVIDOR LOCAL")
    print("=" * 60)
    print(f"Carpeta: {carpeta_app}")
    print(f"Dirección: http://{HOST}:{PORT}")
    print("Para cerrar el servidor presiona CTRL + C")
    print("=" * 60)

    try:
        with socketserver.ThreadingTCPServer((HOST, PORT), NoCacheHTTPRequestHandler) as servidor:
            servidor.allow_reuse_address = True

            # Abre el navegador después de iniciar el servidor
            threading.Timer(1.0, abrir_navegador).start()

            servidor.serve_forever()

    except OSError as error:
        print("\nERROR AL INICIAR EL SERVIDOR")
        print(error)
        print(f"\nEs posible que el puerto {PORT} ya esté ocupado.")
        print("Cierra el otro servidor o cambia PORT = 8000 por otro número.")
        input("\nPresiona ENTER para cerrar...")
        sys.exit(1)

    except KeyboardInterrupt:
        print("\n\nServidor detenido correctamente.")

    except Exception as error:
        print("\nOcurrió un error inesperado:")
        print(error)
        input("\nPresiona ENTER para cerrar...")
        sys.exit(1)


if __name__ == "__main__":
    main()
