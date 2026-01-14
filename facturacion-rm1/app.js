// app.js
import { generarTXTSifeiCompleto } from "./sifei/generarTxt.js";
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

window.generarTXTSifei = async function (idVenta) {

  const ref = doc(db, "ventas_rutav2", idVenta);
  const snap = await getDoc(ref);
  if (!snap.exists()) return alert("Venta no existe");

  const venta = snap.data();

  // 🛑 VALIDACIÓN CORRECTA
  if (!venta.detalle || !venta.detalle.length) {
    return alert("La venta no tiene conceptos");
  }

  // 🔢 TOMAR FOLIO REAL
  const folioRaw = await tomarFolio(CONFIG.serieFiscal);
  const folio = String(folioRaw).padStart(6, "0");

  // 📅 FECHA LOCAL CFDI
  const fechaLocal = venta.fecha.toDate();
  const fechaCFDI =
    fechaLocal.getFullYear() + "-" +
    String(fechaLocal.getMonth() + 1).padStart(2, "0") + "-" +
    String(fechaLocal.getDate()).padStart(2, "0") + "T" +
    String(fechaLocal.getHours()).padStart(2, "0") + ":" +
    String(fechaLocal.getMinutes()).padStart(2, "0") + ":" +
    String(fechaLocal.getSeconds()).padStart(2, "0");

  // 📄 TXT SIFEI COMPLETO
  const txt = generarTXTSifeiCompleto(venta, folio, fechaCFDI);

  console.log("TXT SIFEI GENERADO:\n", txt);

  document.getElementById("txt").style.display = "block";
  document.getElementById("txt").textContent = txt;

  // 💾 DESCARGAR
  const nombreArchivo = `${CONFIG.serieFiscal}_${folio}.txt`;
  const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = nombreArchivo;
  link.click();

  URL.revokeObjectURL(url);

  // ✅ MARCAR COMO FACTURADA
  await updateDoc(ref, {
    estado: "FACTURADA",
    serie_fiscal: CONFIG.serieFiscal,
    folio_fiscal: folio,
    facturada_at: serverTimestamp()
  });
};

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

  // Default HOY (local)
  if (!desdeInput || !hastaInput) {
    const inicio = new Date();
    inicio.setHours(0,0,0,0);

    const fin = new Date();
    fin.setHours(23,59,59,999);

    return { inicio, fin };
  }

  const inicio = dateLocalFromInput(desdeInput, false);
  const fin = dateLocalFromInput(hastaInput, true);

  return { inicio, fin };
}
async function cargarVentas() {
  const { inicio, fin } = rangoDesdeInputs();

  const ventas = await obtenerVentasRuta(
    CONFIG.rutaId,
    inicio,
    fin
  );

  pintarVentas(ventas);
}
function setFechasHoy() {
  const hoy = new Date().toISOString().split("T")[0];
  document.getElementById("fechaDesde").value = hoy;
  document.getElementById("fechaHasta").value = hoy;
}

setFechasHoy();

// ARRANQUE
cargarVentas();
document.getElementById("btnBuscar").addEventListener("click", () => {
  cargarVentas();
});

