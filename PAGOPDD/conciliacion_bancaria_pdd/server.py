from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import webbrowser
import threading

HOST = "127.0.0.1"
PORT = 8000

def abrir():
    webbrowser.open(f"http://{HOST}:{PORT}")

if __name__ == "__main__":
    threading.Timer(0.7, abrir).start()
    print(f"PROVSOFT Conciliación: http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), SimpleHTTPRequestHandler).serve_forever()
