import {
  convertirCFDIGlobalASifei
} from "./sifei/generarTxt.js";

import { db, obtenerVentasRuta, tomarFolio } from "./firebase.js";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🔒 CONFIG ÚNICA DE ESTA APP
const CONFIG = {
  rutaId: "Almacen_Ruta_1",
  serieFiscal: "RM1",
  rfcEmisor: "PDD031204KL5"
};

// ===============================
// PINTAR TABLA DE VENTAS
// ===============================
function pintarVentas(ventas) {
  const tbody = document.getElementById("ventas");
  tbody.innerHTML = "";

  ventas.forEach(v => {
    const estado = v.estado === "FACTURADA";
    const iconoEstado = estado
      ? "🟢 FACTURADA"
      : "🔴 PENDIENTE";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${v.fecha.toDate().toLocaleString()}</td>
      <td>${v.cliente}</td>
      <td>$${v.resumen_financiero.total.toFixed(2)}</td>
    `;

    tbody.appendChild(tr);
  });
}

// ===============================
// GENERAR CFDI (BASE + SIFEI)
// ===============================
window.generarTXTSifeiGlobal = async function () {

  const rango = rangoDiaDesdeInput();
  if (!rango) {
    alert("Selecciona fecha");
    return;
  }
  const { inicio, fin } = rango;

  // 1️⃣ Traer ventas
  const ventas = await obtenerVentasRuta(CONFIG.rutaId, inicio, fin);

  const ventasGlobal = ventas.filter(v =>
    v.estado !== "FACTURADA" &&
    !v.facturada_global
  );

  if (!ventasGlobal.length) {
    alert("No hay ventas para factura global");
    return;
  }

  // 2️⃣ Folio
  const folioRaw = await tomarFolio(CONFIG.serieFiscal);
  const folio = String(folioRaw).padStart(6, "0");

  // 3️⃣ Fecha CFDI
  const ahora = new Date();
  const fechaCFDI = ahora.toISOString().slice(0,19);

  // 4️⃣ Conceptos por TICKET
  const conceptos = generarConceptosGlobales(ventasGlobal);

  // 5️⃣ CFDI GLOBAL (PG)
const cfdiObj = {
  Serie: CONFIG.serieFiscal,
  Folio: folio,
  Fecha: fechaCFDI,
  FormaPago: "01",
  MetodoPago: "PUE",
  Moneda: "MXN",

  Conceptos: conceptos.map(c => {
    const tieneIVA = c.iva > 0;
    const tieneIEPS = c.ieps > 0;
    const tieneImpuestos = tieneIVA || tieneIEPS;

    return {
      Cantidad: 1,
      ClaveUnidad: "ACT",
      ClaveProdServ: "01010101",
      Descripcion: c.descripcion,
      ValorUnitario: c.base,
      Importe: c.base,
      Base: c.base,
      objetoImp: tieneImpuestos ? "02" : "01",

      ...(tieneIVA ? {
        BaseIVA16: c.base,
        TasaIVA16: 0.16,
        IVA16Importe: c.iva
      } : {}),

      ...(tieneIEPS ? {
        BaseIEPS: c.base,
        IEPSTasa: c.iepsTasa,
        IEPSImporte: c.ieps
      } : {})
    };
  }),

  Subtotal: conceptos.reduce((s, c) => s + c.base, 0),
  Total: conceptos.reduce((s, c) => s + c.total, 0)
};

  // 6️⃣ TXT SIFEI
  const txtSifei = convertirCFDIGlobalASifei(cfdiObj);

  console.log("TXT GLOBAL:\n", txtSifei);

  descargarTXT(txtSifei, `GLOBAL_${CONFIG.serieFiscal}_${folio}.txt`);
};

// ===============================
// DESCARGA DE TXT
// ===============================
function descargarTXT(contenido, nombreArchivo) {
  const blob = new Blob([contenido], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = nombreArchivo;
  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
async function cargarVentas() {
  const rango = rangoDiaDesdeInput();
  if (!rango) {
    alert("Selecciona fecha");
    return;
  }

  const { inicio, fin } = rango;

  const ventas = await obtenerVentasRuta(CONFIG.rutaId, inicio, fin);
  pintarVentas(ventas);
  let total = 0;

ventas.forEach(v => {
  if (v.estado === "FACTURADA" || v.facturada_global) return;
  total += v.resumen_financiero.total;
});
document.getElementById("total").textContent = total.toFixed(2);
document.getElementById("cnt").textContent = ventas.length;

}

// ===============================
// ARRANQUE
// ===============================
document
  .getElementById("btnCargar")
  .addEventListener("click", cargarVentas);

function rangoDiaDesdeInput() {
  const input = document.getElementById("fecha");
  if (!input || !input.value) return null;

  const [y, m, d] = input.value.split("-").map(Number);

  const inicio = new Date(y, m - 1, d, 0, 0, 0);
  const fin = new Date(y, m - 1, d, 23, 59, 59, 999);

  return { inicio, fin };
}

function resumirTicketParaGlobal(venta) {

  const subtotal = Number(venta.resumen_financiero.subtotal || 0);
  const impuestos = Number(venta.resumen_financiero.impuestos || 0);
  const total = Number(venta.resumen_financiero.total || 0);

  // 🔎 Detectar IEPS desde el detalle (una sola pasada)
  let ieps = 0;
  let iepsTasa = 0;

  if (Array.isArray(venta.detalle)) {
    venta.detalle.forEach(item => {
      if (Number(item.ieps_calculado) > 0) {
        ieps += Number(item.ieps_calculado);
        iepsTasa = Number(item.iepsTasa || 0) / 100;
      }
    });
  }

  const iva = impuestos - ieps;

  return {
    base: subtotal,
    baseIVA: iva > 0 ? subtotal : 0,
    iva: iva,

    baseIEPS: ieps > 0 ? subtotal : 0,
    ieps: ieps,
    iepsTasa: iepsTasa,

    total: total,
    folioVenta: venta.folio,
    fecha: venta.fecha
  };
}


function generarConceptosGlobales(ventas) {

  return ventas.map((venta, idx) => {
    const t = resumirTicketParaGlobal(venta);

    return {
      idx: idx + 1,
      descripcion: `Venta ${venta.folio}`,
      base: t.base,

      baseIVA: t.baseIVA,
      iva: t.iva,

      baseIEPS: t.baseIEPS,
      ieps: t.ieps,
      iepsTasa: t.iepsTasa,

      total: t.total
    };
  });
}



