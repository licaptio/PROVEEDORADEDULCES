// app.js
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

  // 🔢 TOMAR FOLIO REAL
  const folio = await tomarFolio(CONFIG.serieFiscal);

  // 📄 TXT REAL
  const txt = `
SERIE=${CONFIG.serieFiscal}
FOLIO=${folio}
RFC_EMISOR=${CONFIG.rfcEmisor}
RFC_RECEPTOR=XAXX010101000
USO_CFDI=S01
FECHA=${venta.fecha.toDate().toISOString()}
SUBTOTAL=${venta.resumen_financiero.subtotal}
IMPUESTOS=${venta.resumen_financiero.impuestos}
TOTAL=${venta.resumen_financiero.total}
`.trim();

  document.getElementById("txt").style.display = "block";
  document.getElementById("txt").textContent = txt;

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


