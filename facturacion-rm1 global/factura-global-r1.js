// factura-global-r1.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🔥 TU CONFIG REAL AQUÍ
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_AUTH",
  projectId: "TU_PROJECT_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 🔒 CONFIG GLOBAL
const CONFIG = { rutaId: "R1" };

const tbody = document.getElementById("ventas");
const cnt = document.getElementById("cnt");
const totalEl = document.getElementById("total");
const btnGenerar = document.getElementById("btnGenerar");
const chk = document.getElementById("confirmo");

document.getElementById("btnCargar")
  .addEventListener("click", cargarVentas);

chk.addEventListener("change", () => {
  btnGenerar.disabled = !chk.checked;
});

function rangoDia(fecha) {
  const [y, m, d] = fecha.split("-").map(Number);
  return {
    inicio: new Date(y, m - 1, d, 0, 0, 0),
    fin: new Date(y, m - 1, d, 23, 59, 59)
  };
}

async function cargarVentas() {
  tbody.innerHTML = "";
  cnt.textContent = "0";
  totalEl.textContent = "0.00";

  const fecha = document.getElementById("fecha").value;
  if (!fecha) return alert("Selecciona fecha");

  const { inicio, fin } = rangoDia(fecha);

  const q = query(
    collection(db, "ventas_rutav2"),
    where("rutaId", "==", CONFIG.rutaId),
    where("fecha", ">=", inicio),
    where("fecha", "<=", fin)
  );

  const snap = await getDocs(q);

  let total = 0;
  let c = 0;

  snap.forEach(doc => {
    const v = doc.data();
    if (v.estado === "FACTURADA") return;
    if (v.facturada_global) return;

    c++;
    total += v.resumen_financiero.total;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${v.fecha.toDate().toLocaleTimeString()}</td>
      <td>${v.cliente || "PÚBLICO EN GENERAL"}</td>
      <td>$${v.resumen_financiero.total.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });

  cnt.textContent = c;
  totalEl.textContent = total.toFixed(2);
}
