
import { imprimirTextoConfigurado, previsualizarTexto } from "./impresionUniversal.js";
const TICKET_CONFIG_DEFAULT = {
  ancho: 42,
  negocio: "PROVEEDORA MATRIZ",
  direccion1: "MADERO 690 SUR, CENTRO",
  direccion2: "LINARES, NUEVO LEON, 67700",
  rfc: "PDD-031204-KL5",
  telefono: "TEL. (821) 2121805",
  regimen1: "REGIMEN GENERAL DE LEY",
  regimen2: "PERSONAS MORALES",
  mensajeFinal: "GRACIAS POR SU COMPRA"
};

function cfg() {
  const local = window.POS_TICKET_CONFIG || {};
  return { ...TICKET_CONFIG_DEFAULT, ...local };
}

function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .toUpperCase();
}

function dinero(valor) {
  const n = Number(valor || 0);
  return n.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function fechaTicket(venta) {
  if (venta?.fecha_txt) return venta.fecha_txt;
  if (venta?.fecha_local_iso) return new Date(venta.fecha_local_iso).toLocaleString("es-MX");
  return new Date().toLocaleString("es-MX");
}

function linea(char = "=") {
  return char.repeat(cfg().ancho);
}

function centro(texto) {
  const c = cfg();
  const t = normalizarTexto(texto).slice(0, c.ancho);
  const pad = Math.max(0, Math.floor((c.ancho - t.length) / 2));
  return " ".repeat(pad) + t;
}

function derecha(texto, ancho) {
  const t = String(texto ?? "").slice(0, ancho);
  return t.padStart(ancho, " ");
}

function izquierda(texto, ancho) {
  const t = normalizarTexto(texto).slice(0, ancho);
  return t.padEnd(ancho, " ");
}

function partirNombre(nombre, ancho = 31) {
  const txt = normalizarTexto(nombre).trim();
  if (txt.length <= ancho) return [txt];

  const partes = [];
  let resto = txt;

  while (resto.length > ancho) {
    let corte = resto.lastIndexOf(" ", ancho);
    if (corte < 8) corte = ancho;
    partes.push(resto.slice(0, corte).trim());
    resto = resto.slice(corte).trim();
  }

  if (resto) partes.push(resto);
  return partes;
}

function obtenerTotal(venta) {
  return Number(venta?.resumen_financiero?.total ?? venta?.total ?? 0);
}

function obtenerSubtotal(venta) {
  return Number(venta?.resumen_financiero?.subtotal ?? venta?.subtotal ?? 0);
}

function obtenerImpuestos(venta) {
  return Number(venta?.resumen_financiero?.impuestos ?? venta?.impuestos ?? 0);
}

function obtenerDescuento(venta) {
  return Number(
    venta?.resumen_financiero?.descuento ??
    venta?.descuento_monto ??
    venta?.descuento ??
    0
  );
}

function obtenerCantidadTotal(venta) {
  if (venta?.resumen_financiero?.cantidad_articulos != null) {
    return Number(venta.resumen_financiero.cantidad_articulos || 0);
  }
  return (venta?.detalle || []).reduce((s, x) => s + Number(x.cantidad || 0), 0);
}

function renglonProducto(item) {
  const cantidad = Number(item.cantidad || 0);
  const precio = Number(item.precio_unit ?? item.precioUnit ?? 0);
  const importe = Number(item.importe || cantidad * precio || 0);
  const lineasNombre = partirNombre(item.nombre || item.concepto || item.codigo || "PRODUCTO", 31);
  const salida = [];

  salida.push(lineasNombre[0]);

  for (let i = 1; i < lineasNombre.length; i++) {
    salida.push(lineasNombre[i]);
  }

  salida.push(
    izquierda("  " + cantidad.toFixed(3).replace(/\.000$/, ""), 10) +
    derecha(dinero(precio), 12) +
    derecha(dinero(importe), 12)
  );

  return salida.join("\n");
}

export function generarTextoTicket(venta = {}) {
  const c = cfg();
  const detalle = Array.isArray(venta.detalle) ? venta.detalle : [];
  const total = obtenerTotal(venta);
  const subtotal = obtenerSubtotal(venta);
  const impuestos = obtenerImpuestos(venta);
  const descuento = obtenerDescuento(venta);
  const recibido = Number(venta.recibido || 0);
  const cambio = Number(venta.cambio || 0);
  const folio = venta.folio || venta.documento_id || venta.id || "SIN-FOLIO";
  const cajero = venta.usuarioNombre || venta.usuarioLogin || venta.usuario_cobro_nombre || "SIN CAJERO";

  const lineas = [];

  lineas.push(centro(c.negocio));
  lineas.push(centro(c.direccion1));
  lineas.push(centro(c.direccion2));
  lineas.push(centro("R.F.C. " + c.rfc));
  lineas.push(centro(c.telefono));
  lineas.push(centro(c.regimen1));
  lineas.push(centro(c.regimen2));
  lineas.push(linea("="));
  lineas.push(`# Venta: ${folio}`);
  lineas.push(`Fecha: ${fechaTicket(venta)}`);
  lineas.push(linea("="));

  detalle.forEach(item => {
    lineas.push(renglonProducto(item));
  });

  lineas.push(linea("="));
  lineas.push(izquierda("Subtotal:", 24) + derecha(dinero(subtotal), 14));
  if (descuento > 0) {
    lineas.push(izquierda("Descuento:", 24) + derecha("-" + dinero(descuento), 14));
  }
  lineas.push(izquierda("Impuestos:", 24) + derecha(dinero(impuestos), 14));
  lineas.push(izquierda("Total:", 24) + derecha(dinero(total), 14));
  lineas.push(izquierda("Su Pago:", 24) + derecha(dinero(recibido), 14));
  lineas.push(izquierda("Cambio:", 24) + derecha(dinero(cambio), 14));
  (venta.pagos || []).forEach(p => {
    lineas.push(izquierda(String(p.tipo || "PAGO").replaceAll("_", " ") + ":", 24) + derecha(dinero(p.importe), 14));
  });
  lineas.push(izquierda("Articulos:", 24) + derecha(String(obtenerCantidadTotal(venta)), 14));
  lineas.push("");
  lineas.push(centro("Cajero: " + cajero));
  lineas.push(centro(c.mensajeFinal));
  lineas.push("\n\n\n");

  return lineas.join("\n");
}

export function imprimirTicketRawBT(venta) {
  const texto = generarTextoTicket(venta);
  window.__ULTIMO_TICKET_TXT = texto;
  return imprimirTextoConfigurado(texto, `Ticket ${venta?.folio || venta?.documento_id || venta?.id || ""}`, { copias: 1 });
}

export function rellenarTicket(venta) {
  window.__VENTA_ACTUAL = venta;
  window.__ULTIMO_TICKET_TXT = generarTextoTicket(venta);
  console.log("Ticket preparado:", venta?.folio || venta?.documento_id);
  return window.__ULTIMO_TICKET_TXT;
}

export function previsualizarTicket(venta) {
  const texto = generarTextoTicket(venta);
  return previsualizarTexto(texto, `Ticket ${venta?.folio || venta?.documento_id || venta?.id || ""}`);
}

export function imprimirTicketConfigurado(venta) {
  const texto = generarTextoTicket(venta);
  window.__ULTIMO_TICKET_TXT = texto;
  return imprimirTextoConfigurado(texto, `Ticket ${venta?.folio || venta?.documento_id || venta?.id || ""}`);
}
