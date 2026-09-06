import http.server
import socketserver
import subprocess
import threading
import os
import sys
import shutil

PORT = 8000
DIRECTORIO = os.path.dirname(os.path.abspath(__file__))
os.chdir(DIRECTORIO)
URL_POS = f"http://localhost:{PORT}/index.html"
PERFIL_NAVEGADOR = os.path.join(DIRECTORIO, ".provsoft_chrome_profile")
ARCHIVO_IMPRESORA = os.path.join(DIRECTORIO, "IMPRESORA_WINDOWS.txt")
IMPRESORA_DEFAULT = "MINIPRINTEREXCEL"


class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def guess_type(self, path):
        if path.endswith(".js"):
            return "application/javascript"
        return super().guess_type(path)


def leer_impresora_objetivo():
    try:
        if os.path.isfile(ARCHIVO_IMPRESORA):
            with open(ARCHIVO_IMPRESORA, "r", encoding="utf-8-sig") as f:
                nombre = f.read().strip()
                if nombre:
                    return nombre
    except Exception as err:
        print(f" AVISO: no se pudo leer IMPRESORA_WINDOWS.txt: {err}")
    return IMPRESORA_DEFAULT


def establecer_impresora_predeterminada(nombre):
    """Selecciona por nombre la cola de Windows antes de abrir Chrome/Edge."""
    if os.name != "nt" or not nombre:
        return False

    try:
        # PrintUIEntry /y establece la impresora predeterminada para el usuario actual.
        proceso = subprocess.run(
            [
                "rundll32.exe",
                "printui.dll,PrintUIEntry",
                "/y",
                "/n",
                nombre,
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if proceso.returncode == 0:
            print(f" Impresora Windows seleccionada: {nombre}")
            return True

        detalle = (proceso.stderr or proceso.stdout or "").strip()
        print(f" AVISO: Windows no pudo establecer '{nombre}' como predeterminada. {detalle}")
        return False
    except Exception as err:
        print(f" AVISO: no se pudo establecer la impresora predeterminada: {err}")
        return False


def buscar_navegador_windows():
    """Busca Chrome y luego Edge. Ambos soportan --kiosk-printing."""
    candidatos = []

    if os.name == "nt":
        pf = os.environ.get("ProgramFiles", r"C:\Program Files")
        pfx86 = os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")
        local = os.environ.get("LOCALAPPDATA", "")

        candidatos.extend([
            os.path.join(pf, "Google", "Chrome", "Application", "chrome.exe"),
            os.path.join(pfx86, "Google", "Chrome", "Application", "chrome.exe"),
            os.path.join(local, "Google", "Chrome", "Application", "chrome.exe"),
            os.path.join(pf, "Microsoft", "Edge", "Application", "msedge.exe"),
            os.path.join(pfx86, "Microsoft", "Edge", "Application", "msedge.exe"),
        ])

    for nombre in ("chrome", "chrome.exe", "msedge", "msedge.exe"):
        ruta = shutil.which(nombre)
        if ruta:
            candidatos.append(ruta)

    for ruta in candidatos:
        if ruta and os.path.isfile(ruta):
            return ruta
    return None


def abrir_navegador():
    impresora = leer_impresora_objetivo()
    establecer_impresora_predeterminada(impresora)

    navegador = buscar_navegador_windows()

    if navegador:
        try:
            os.makedirs(PERFIL_NAVEGADOR, exist_ok=True)

            # PERFIL AISLADO: evita que un Chrome normal ya abierto absorba el lanzamiento
            # y pierda --kiosk-printing. Esta instancia queda dedicada al POS.
            argumentos = [
                navegador,
                "--kiosk-printing",
                "--user-data-dir=" + PERFIL_NAVEGADOR,
                "--no-first-run",
                "--no-default-browser-check",
                "--app=" + URL_POS,
            ]

            subprocess.Popen(argumentos)
            print(f" Navegador POS: {navegador}")
            print(f" Perfil aislado POS: {PERFIL_NAVEGADOR}")
            print(" Impresion silenciosa: ACTIVADA (--kiosk-printing)")
            print(f" Destino Windows: {impresora}")
            return
        except Exception as err:
            print(f" No se pudo iniciar Chrome/Edge en modo directo: {err}")

    # Fallback: solo si no existe Chrome/Edge.
    import webbrowser
    print(" AVISO: no se encontro Chrome/Edge para --kiosk-printing.")
    print(" Se abrira el navegador predeterminado y puede aparecer el dialogo de impresion.")
    webbrowser.open(URL_POS)


class ServidorLocal(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


try:
    with ServidorLocal(("127.0.0.1", PORT), CustomHandler) as httpd:
        impresora = leer_impresora_objetivo()
        print("=" * 70)
        print(" PROVSOFT POS 2026 - V18 IMPRESION DIRECTA WINDOWS")
        print(f" {URL_POS}")
        print(f" Impresora objetivo: {impresora}")
        print(" Chrome/Edge: perfil aislado + --kiosk-printing")
        print(" Compatible con Generic / Text Only y drivers Windows/EPSON")
        print(" Para cerrar el servidor presiona CTRL + C")
        print("=" * 70)
        threading.Timer(1, abrir_navegador).start()
        httpd.serve_forever()
except OSError as err:
    print(f"No se pudo iniciar el puerto {PORT}: {err}")
    print("Cierra otra ventana del POS/servidor que siga abierta e intenta nuevamente.")
    sys.exit(1)
except KeyboardInterrupt:
    print("\nServidor PROVSOFT cerrado.")
