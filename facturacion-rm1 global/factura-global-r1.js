import {
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { db } from "./firebase.js";

// 🔒 CONFIG GLOBAL FIJA
const CONFIG = {
  rutaId: "R1",
  serieFiscal: "FG1"
};

const tbody = document.getElementById("ventas");
const cnt = document.getElementById("cnt");
const totalEl = document.getElementById("total");
const btn = document.getElementById("btnGenerar");
const chk = document.getElementById("confirmo");

chk.addEventListener("change", () => {
  btn.disabled = !chk.checked;
});

function rangoDia(fecha) {
  const [y,m,d] = fecha.split("-").map(Number);
  return {
    inicio: new Date(y, m-1, d, 0,0,0),
    fin: new Date(y, m-1, d, 23,59,59)
  };
}

window.cargarVentas = async function () {

  tbody.innerHTML = "";
  cnt.textContent = "0";
  totalEl.textContent = "0.00";

  const fecha = document.getElementById("fecha").value;
  if (!fecha) {
    alert("Selecciona fecha");
    return;
  }

  const { inicio, fin } = rangoDia(fecha);

  const q = query(
    collection(db, "ventas_rutav2"),
    where("rutaId", "==", CONFIG.rutaId),
    where("fecha", ">=", inicio),
    where("fecha", "<=", fin)
  );

  const snap = await getDocs(q);

  let total = 0;
  let contador = 0;

  snap.forEach(d => {
    const v = d.data();

    // 🔒 FILTRO FISCAL
    if (v.estado === "FACTURADA") return;
    if (v.facturada_global === true) return;

    contador++;
    total += v.resumen_financiero.total;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${v.fecha.toDate().toLocaleTimeString()}</td>
      <td>${v.cliente || "PÚBLICO EN GENERAL"}</td>
      <td>$${v.resumen_financiero.total.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });

  cnt.textContent = contador;
  totalEl.textContent = total.toFixed(2);

  if (contador === 0) {
    btn.disabled = true;
    chk.checked = false;
  }
};

window.generarFacturaGlobal = async function () {
  alert("👉 Aquí va el siguiente paso:\narmar CFDI global + TXT SIFEI + marcar facturada_global");
};
