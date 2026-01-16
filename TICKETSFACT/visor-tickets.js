import { db, obtenerVentasRuta } from "./firebase.js";
import {
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.getElementById("btnCargar").addEventListener("click", cargar);

function rangoDia(fecha) {
  const [y,m,d] = fecha.split("-").map(Number);
  return {
    inicio: new Date(y, m-1, d, 0,0,0),
    fin: new Date(y, m-1, d, 23,59,59)
  };
}

async function cargar() {
  const fecha = document.getElementById("fecha").value;
  const rutaId = document.getElementById("ruta").value;

  if (!fecha) return alert("Selecciona fecha");

  const { inicio, fin } = rangoDia(fecha);

  const ventas = await obtenerVentasRuta(rutaId, inicio, fin);
  pintar(ventas);
}


function pintar(ventas) {
  const tbody = document.getElementById("tabla");
  tbody.innerHTML = "";

  ventas.forEach(v => {

    let estado = "🟢 LIBRE";
    if (v.estado === "FACTURADA") estado = "🔵 FACTURADA";
    if (v.facturada_global) estado = "🟠 GLOBAL";

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${new Date(v.fecha?.seconds ? v.fecha.seconds * 1000 : v.fecha).toLocaleTimeString()}</td>
      <td>${v.folio}</td>
      <td>$${v.resumen_financiero.total.toFixed(2)}</td>
      <td>${estado}</td>
      <td>
        ${estado !== "🟢 LIBRE"
          ? `<button data-id="${v.id}">DESMARCAR</button>`
          : ""
        }
      </td>
    `;

    const btn = tr.querySelector("button");
    if (btn) {
      btn.onclick = () => desmarcar(v.id);
    }

    tbody.appendChild(tr);
  });
}

async function desmarcar(id) {
  if (!confirm("¿Revertir estado fiscal del ticket?")) return;

  await updateDoc(doc(db, "ventas_rutav2", id), {
    facturada_global: false,
    estado: "ABIERTA",
    folio_fiscal: null,
    serie_fiscal: null
  });

  alert("✔ Ticket liberado");
document.getElementById("btnCargar").click();
}

