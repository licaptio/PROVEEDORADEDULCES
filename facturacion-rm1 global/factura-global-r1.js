// app.js
import {
  armarObjetoCFDIDesdeVenta,
  convertirCFDIBaseASifei
} from "./sifei/generarTxt.js";

import { db, obtenerVentasRuta, tomarFolio } from "../firebase.js";
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
      <td style="font-weight:bold">${iconoEstado}</td>
      <td>
        <button onclick="generarTXTSifei('${v.id}')">
          Generar TXT
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

// ===============================
// GENERAR CFDI (BASE + SIFEI)
// ===============================
window.generarTXTSifeiGlobal = async function () {

  const { inicio, fin } = rangoDesdeInputs();

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
  const cfdiObj = armarObjetoCFDIDesdeVentasGlobales(
    ventasGlobal,
    folio,
    fechaCFDI
  );

  // 🔄 TXT SIFEI
  const txtSifei = convertirCFDIBaseASifei(cfdiObj);

  console.log("TXT GLOBAL:\n", txtSifei);

  descargarTXT(txtSifei, `GLOBAL_${CONFIG.serieFiscal}_${folio}.txt`);
};

  // ===============================

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

// ===============================
// FECHAS / FILTROS
// ===============================
function dateLocalFromInput(value, endOfDay = false) {
  const [year, month, day] = value.split("-").map(Number);

  if (!endOfDay) {
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  } else {
    return new Date(year, month - 1, day, 23, 59, 59, 999);
  }
}

function rangoDesdeInputs() {
  const desdeInput = document.getElementById("fechaDesde").value;
  const hastaInput = document.getElementById("fechaHasta").value;

  if (!desdeInput || !hastaInput) {
    const inicio = new Date();
    inicio.setHours(0,0,0,0);

    const fin = new Date();
    fin.setHours(23,59,59,999);

    return { inicio, fin };
  }

  return {
    inicio: dateLocalFromInput(desdeInput, false),
    fin: dateLocalFromInput(hastaInput, true)
  };
}

async function cargarVentas() {
  const { inicio, fin } = rangoDesdeInputs();
  const ventas = await obtenerVentasRuta(CONFIG.rutaId, inicio, fin);
  pintarVentas(ventas);
}

function setFechasHoy() {
  const hoy = new Date().toISOString().split("T")[0];
  document.getElementById("fechaDesde").value = hoy;
  document.getElementById("fechaHasta").value = hoy;
}

// ===============================
// ARRANQUE
// ===============================
setFechasHoy();
cargarVentas();
document.getElementById("btnBuscar").addEventListener("click", cargarVentas);

function armarObjetoCFDIDesdeVentasGlobales(ventas, folio, fechaCFDI) {

  return {
    tipo: "GLOBAL",
    rfc_receptor: "XAXX010101000",
    nombre_receptor: "PUBLICO EN GENERAL",
    uso_cfdi: "S01",
    info_global: {
      periodicidad: "01",
      meses: String(new Date(fechaCFDI).getMonth() + 1).padStart(2, "0"),
      año: String(new Date(fechaCFDI).getFullYear())
    },
    ventas_origen: ventas,
    folio,
    fechaCFDI
  };
}


