// app.js
import {
  generarTXTSifeiCompleto,
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
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${v.fecha.toDate().toLocaleString()}</td>
      <td>${v.cliente}</td>
      <td>$${v.resumen_financiero.total.toFixed(2)}</td>
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
window.generarTXTSifei = async function (idVenta) {

  const ref = doc(db, "ventas_rutav2", idVenta);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    alert("Venta no existe");
    return;
  }

  const venta = snap.data();

  // 🛑 Validación
  if (!venta.detalle || !venta.detalle.length) {
    alert("La venta no tiene conceptos");
    return;
  }

  // 🔢 Folio fiscal
  const folioRaw = await tomarFolio(CONFIG.serieFiscal);
  const folio = String(folioRaw).padStart(6, "0");

  // 📅 Fecha CFDI (LOCAL)
  const fechaLocal = venta.fecha.toDate();
  const fechaCFDI =
    fechaLocal.getFullYear() + "-" +
    String(fechaLocal.getMonth() + 1).padStart(2, "0") + "-" +
    String(fechaLocal.getDate()).padStart(2, "0") + "T" +
    String(fechaLocal.getHours()).padStart(2, "0") + ":" +
    String(fechaLocal.getMinutes()).padStart(2, "0") + ":" +
    String(fechaLocal.getSeconds()).padStart(2, "0");

  // ===============================
  // 1️⃣ CFDI BASE (LEGIBLE)
  // ===============================
  const txtBase = generarTXTSifeiCompleto(venta, folio, fechaCFDI);

  // ===============================
  // 2️⃣ CFDI SIFEI PREMIUM
  // ===============================
  const cfdiObj = armarObjetoCFDIDesdeVenta(venta, folio, fechaCFDI);
  const txtSifei = convertirCFDIBaseASifei(cfdiObj);

  console.log("CFDI BASE:\n", txtBase);
  console.log("CFDI SIFEI:\n", txtSifei);

  // Mostrar en pantalla (BASE)
  const visor = document.getElementById("txt");
  if (visor) {
    visor.style.display = "block";
    visor.textContent = txtBase;
  }

  // ===============================
  // DESCARGAR AMBOS ARCHIVOS
  // ===============================
  descargarTXT(txtBase,  `BASE_${CONFIG.serieFiscal}_${folio}.txt`);
  descargarTXT(txtSifei, `SIFEI_${CONFIG.serieFiscal}_${folio}.txt`);

  // ===============================
  // MARCAR COMO FACTURADA
  // ===============================
  await updateDoc(ref, {
    estado: "FACTURADA",
    serie_fiscal: CONFIG.serieFiscal,
    folio_fiscal: folio,
    facturada_at: serverTimestamp()
  });
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
