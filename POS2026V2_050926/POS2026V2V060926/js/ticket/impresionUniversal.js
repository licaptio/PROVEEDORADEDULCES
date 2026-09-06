import { obtenerConfigImpresion } from "./impresionConfig.js";

function escaparHtml(texto) {
  return String(texto ?? "").replace(/[&<>]/g, s => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;"
  }[s]));
}

function imprimirTextoRawBT(texto) {
  try {
    window.location.href = "rawbt:" + encodeURIComponent(texto);
    return true;
  } catch (err) {
    console.error("No se pudo imprimir en RawBT:", err);
    return false;
  }
}

function imprimirTextoWindows(texto, titulo = "Impresion POS") {
  const w = window.open("", "_blank", "width=420,height=700");

  if (!w) {
    alert("No se pudo abrir la ventana de impresión. Revisa bloqueo de ventanas emergentes.");
    return false;
  }

  w.document.write(`
    <html>
      <head>
        <title>${escaparHtml(titulo)}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }

          html, body {
            width: 80mm;
            margin: 0;
            padding: 0;
            font-family: monospace;
            white-space: pre-wrap;
            font-size: 12px;
          }

          pre {
            margin: 0;
            padding: 0;
          }
        </style>
      </head>
      <body>
        <pre>${escaparHtml(texto)}</pre>
      </body>
    </html>
  `);

  w.document.close();

  w.onload = () => {
    w.focus();

    w.onafterprint = () => {
      w.close();
    };

    setTimeout(() => {
      w.print();
    }, 300);

    setTimeout(() => {
      if (!w.closed) {
        w.close();
      }
    }, 2000);
  };

  return true;
}

export function imprimirTextoConfigurado(texto, titulo = "Impresion POS", opciones = {}) {
  const config = obtenerConfigImpresion();
  const copias = Math.min(3, Math.max(1, Number(opciones.copias ?? config.copias ?? 1)));
  let ok = true;

  window.__ULTIMA_IMPRESION_TXT = texto;

  for (let i = 0; i < copias; i++) {
    if (config.modo === "WINDOWS") {
      ok = imprimirTextoWindows(texto, titulo) && ok;
    } else {
      ok = imprimirTextoRawBT(texto) && ok;
    }
  }

  return ok;
}

export function previsualizarTexto(texto, titulo = "Vista previa") {
  const w = window.open("", "_blank", "width=420,height=700");
  if (!w) return false;

  w.document.write(`
    <html>
      <head>
        <title>${escaparHtml(titulo)}</title>
        <style>
          body{font-family:monospace;white-space:pre-wrap;font-size:13px;padding:12px;}
          button{position:fixed;right:10px;top:10px;padding:10px 14px;font-weight:bold;}
          pre{margin-top:55px;}
        </style>
      </head>
      <body>
        <button onclick="window.print()">Imprimir</button>
        <pre>${escaparHtml(texto)}</pre>
      </body>
    </html>
  `);
  w.document.close();
  return true;
}
