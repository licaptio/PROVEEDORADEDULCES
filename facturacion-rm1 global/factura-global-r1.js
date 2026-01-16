import {
  convertirCFDIBaseASifei
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

    Conceptos: conceptos.map(c => ({
      Cantidad: 1,
      ClaveUnidad: "ACT",
      ClaveProdServ: "01010101",
      Descripcion: "Venta",
      ValorUnitario: c.base,
      Importe: c.base,
      Base: c.base,

      TasaIVA: c.baseIVA > 0 ? 0.16 : 0,
      IVAImporte: c.iva,

      IEPSTasa: c.iepsTasa || 0,
      IEPSImporte: c.ieps || 0
    })),

    BaseIVA16: conceptos.reduce((s,c)=>s+c.baseIVA,0),
    IVA16Importe: conceptos.reduce((s,c)=>s+c.iva,0),

    BaseIEPS: conceptos.reduce((s,c)=>s+c.baseIEPS,0),
    IEPSImporte: conceptos.reduce((s,c)=>s+c.ieps,0),
    IEPSTasa: conceptos.find(c=>c.iepsTasa)?.iepsTasa || 0,

    Subtotal: conceptos.reduce((s,c)=>s+c.base,0),
    Total: conceptos.reduce((s,c)=>s+c.total,0)
  };

  // 6️⃣ TXT SIFEI
  const txtSifei = convertirCFDIBaseASifei(cfdiObj);

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
  return {
    baseIVA: Number(venta.resumen_financiero.baseIVA || 0),
    iva: Number(venta.resumen_financiero.iva || 0),

    baseIEPS: Number(venta.resumen_financiero.baseIEPS || 0),
    ieps: Number(venta.resumen_financiero.ieps || 0),
    iepsTasa: Number(venta.resumen_financiero.iepsTasa || 0),

    total: Number(venta.resumen_financiero.total),
    folioVenta: venta.folio || "",
    fecha: venta.fecha
  };
}
function generarConceptosGlobales(ventas) {
  return ventas.map((venta, idx) => {
    const t = resumirTicketParaGlobal(venta);

    return {
      idx: idx + 1,
      descripcion: "Venta",
      base: t.baseIVA + t.baseIEPS,
      baseIVA: t.baseIVA,
      iva: t.iva,
      baseIEPS: t.baseIEPS,
      ieps: t.ieps,
      iepsTasa: t.iepsTasa,
      total: t.total
    };
  });
}


