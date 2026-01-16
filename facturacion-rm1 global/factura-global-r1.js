// app.js
import {
  armarObjetoCFDIDesdeVenta,
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


  const ventas = await obtenerVentasRuta(CONFIG.rutaId, inicio, fin);

  const ventasGlobal = ventas.filter(v =>
    v.estado !== "FACTURADA" &&
    !v.facturada_global
  );

  if (!ventasGlobal.length) {
    alert("No hay ventas para factura global");
    return;
  }

  // 🔢 Folio
  const folioRaw = await tomarFolio(CONFIG.serieFiscal);
  const folio = String(folioRaw).padStart(6, "0");

  // 📅 Fecha CFDI
  const ahora = new Date();
  const fechaCFDI = ahora.toISOString().slice(0,19);

  // 🧾 CFDI BASE GLOBAL
// 🔥 1) Aplanar conceptos de todas las ventas
const ventaGlobalFake = {
  detalle: ventasGlobal.flatMap(v => v.detalle)
};

// 🔥 2) Reusar el generador BASE (el que ya funciona)
const cfdiObj = armarObjetoCFDIDesdeVenta(
  ventaGlobalFake,
  folio,
  fechaCFDI
);


  // 🔄 TXT SIFEI
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

