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

function normalizarAnchoMm(valor) {
  const n = Number(valor);
  return n === 80 ? 80 : 58;
}

/**
 * Impresión Windows basada en window.print().
 *
 * WINDOWS_DIRECTO: el navegador debe haberse iniciado con --kiosk-printing.
 *                   Chrome/Edge envía a la impresora PREDETERMINADA de Windows.
 * WINDOWS_DIALOGO:  abre el selector normal del navegador.
 *
 * Esto funciona tanto con un driver EPSON/Windows como con Generic / Text Only,
 * porque la selección física de la impresora la resuelve Windows.
 */
function imprimirTextoWindows(texto, titulo = "Impresion POS", anchoMm = 58) {
  const ancho = normalizarAnchoMm(anchoMm);
  const w = window.open("", "_blank", "width=420,height=700");

  if (!w) {
    alert("No se pudo abrir la ventana de impresión. Revisa el bloqueo de ventanas emergentes.");
    return false;
  }

  w.document.write(`
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${escaparHtml(titulo)}</title>
        <style>
          @page {
            size: ${ancho}mm auto;
            margin: 0;
          }

          html, body {
            width: ${ancho}mm;
            margin: 0;
            padding: 0;
            font-family: "Courier New", Consolas, monospace;
            white-space: pre-wrap;
            font-size: 11px;
            line-height: 1.15;
          }

          pre {
            width: ${ancho}mm;
            box-sizing: border-box;
            margin: 0;
            padding: 1.5mm;
            white-space: pre-wrap;
            overflow: hidden;
          }
        </style>
      </head>
      <body>
        <pre>${escaparHtml(texto)}</pre>
      </body>
    </html>
  `);

  w.document.close();

  const ejecutarPrint = () => {
    try {
      w.focus();
      w.onafterprint = () => {
        try { w.close(); } catch (_) {}
      };
      w.print();

      // En --kiosk-printing el evento afterprint puede variar según versión.
      setTimeout(() => {
        try {
          if (!w.closed) w.close();
        } catch (_) {}
      }, 2500);
    } catch (err) {
      console.error("Error imprimiendo en Windows:", err);
      try { w.close(); } catch (_) {}
    }
  };

  if (w.document.readyState === "complete") {
    setTimeout(ejecutarPrint, 120);
  } else {
    w.onload = () => setTimeout(ejecutarPrint, 120);
  }

  return true;
}

export function imprimirTextoConfigurado(texto, titulo = "Impresion POS", opciones = {}) {
  const config = obtenerConfigImpresion();
  const copias = Math.min(3, Math.max(1, Number(opciones.copias ?? config.copias ?? 1)));
  const modo = String(config.modo || "").toUpperCase();
  const anchoMm = normalizarAnchoMm(opciones.anchoMm ?? config.anchoMm ?? 58);
  let ok = true;

  window.__ULTIMA_IMPRESION_TXT = texto;
  window.__ULTIMA_CONFIG_IMPRESION = config;

  for (let i = 0; i < copias; i++) {
    if (modo === "RAWBT") {
      ok = imprimirTextoRawBT(texto) && ok;
    } else {
      // WINDOWS, WINDOWS_DIRECTO y WINDOWS_DIALOGO comparten window.print().
      // La diferencia entre directo/diálogo la determina --kiosk-printing.
      ok = imprimirTextoWindows(texto, titulo, anchoMm) && ok;
    }
  }

  return ok;
}

export function previsualizarTexto(texto, titulo = "Vista previa") {
  const config = obtenerConfigImpresion();
  const ancho = normalizarAnchoMm(config.anchoMm ?? 58);
  const w = window.open("", "_blank", "width=420,height=700");
  if (!w) return false;

  w.document.write(`
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${escaparHtml(titulo)}</title>
        <style>
          @page{size:${ancho}mm auto;margin:0;}
          body{width:${ancho}mm;box-sizing:border-box;font-family:monospace;white-space:pre-wrap;font-size:12px;padding:3mm;margin:0;}
          button{position:fixed;right:10px;top:10px;padding:10px 14px;font-weight:bold;}
          pre{margin-top:55px;white-space:pre-wrap;}
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
