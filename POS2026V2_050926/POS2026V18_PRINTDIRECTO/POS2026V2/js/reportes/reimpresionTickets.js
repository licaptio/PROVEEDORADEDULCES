import { imprimirTicketConfigurado } from "../ticket/ticket.js";

import {
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "../firebase/config.js";
import { getUsuarioLogueado } from "../auth/login.js";
import { money } from "../util/money.js";
import { obtenerRutaVentaPorUsuario, obtenerSegmentosVentas } from "../config/usuariosVentas.js";

let TIENDA = "RUTA1";
let RUTA_VENTA_ACTUAL = null;

let ticketsNoCortados = [];

export function iniciarReimpresionTickets() {
  const btn = document.getElementById("btnReimpresionTickets");

  if (!btn) {
    console.warn("No existe #btnReimpresionTickets");
    return;
  }

  btn.addEventListener("click", async (event) => {
    event.stopPropagation();

    const panel = document.getElementById("panelConfig");
    if (panel) panel.classList.add("oculto");

    await abrirReimpresionTickets();
  });
}

async function abrirReimpresionTickets() {
  const contexto = obtenerRutaVentaPorUsuario(getUsuarioLogueado());
  RUTA_VENTA_ACTUAL = contexto;
  TIENDA = contexto.tienda;
  asegurarVistaReimpresion();

  const posContainer = document.querySelector(".pos-container");
  const vista = document.getElementById("vistaReimpresionTickets");

  if (posContainer) posContainer.style.display = "none";
  if (vista) vista.classList.remove("oculto");

  await cargarTicketsNoCortados();
}

function regresarAlPOS() {
  const posContainer = document.querySelector(".pos-container");
  const vista = document.getElementById("vistaReimpresionTickets");

  if (vista) vista.classList.add("oculto");
  if (posContainer) posContainer.style.display = "";
}

function asegurarVistaReimpresion() {
  if (document.getElementById("vistaReimpresionTickets")) return;

  const vista = document.createElement("section");
  vista.id = "vistaReimpresionTickets";
  vista.className = "corte-operativo-view oculto";

  vista.innerHTML = `
    <div class="corte-header">
      <div>
        <h2>🧾 Reimpresión de Tickets</h2>
        <small>Tickets no cortados</small>
      </div>

      <button id="btnRegresarReimpresion" class="corte-btn gris" type="button">
        Regresar al POS
      </button>
    </div>

    <div id="resumenReimpresion" class="corte-panel-admin"></div>

    <div class="corte-actions">
      <button id="btnActualizarReimpresion" class="corte-btn gris" type="button">
        Actualizar
      </button>
    </div>

    <div class="corte-section">
      <h3>Tickets pendientes de corte</h3>

      <div class="corte-table-wrap">
        <table class="corte-table">
          <thead>
            <tr>
              <th>Folio</th>
              <th>Fecha</th>
              <th>Total</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody id="tbodyReimpresionTickets">
            <tr>
              <td colspan="4">Cargando...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.body.appendChild(vista);

  document
    .getElementById("btnRegresarReimpresion")
    .addEventListener("click", regresarAlPOS);

  document
    .getElementById("btnActualizarReimpresion")
    .addEventListener("click", cargarTicketsNoCortados);
}

async function cargarTicketsNoCortados() {
  const usuario = getUsuarioLogueado();
  const resumen = document.getElementById("resumenReimpresion");
  const tbody = document.getElementById("tbodyReimpresionTickets");

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4">Buscando tickets...</td>
      </tr>
    `;
  }

  const ref = collection(db, ...obtenerSegmentosVentas(RUTA_VENTA_ACTUAL));

  const qv = query(
    ref,
    where("cortado", "==", false),
    where("estado_venta", "==", "ACTIVA"),
    where("usuarioLogin", "==", usuario?.usuario || "")
  );

  const snap = await getDocs(qv);

  ticketsNoCortados = snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  const total = ticketsNoCortados.reduce((s, v) => {
    return s + Number(v.resumen_financiero?.total || v.total || 0);
  }, 0);

  if (resumen) {
    resumen.innerHTML = `
      <div class="corte-admin-box">
        <div class="corte-admin-title">Resumen</div>

        <table class="corte-admin-table">
          <tbody>
            <tr>
              <td>Usuario</td>
              <td>${usuario?.nombre || usuario?.usuario || "—"}</td>
            </tr>
            <tr>
              <td>Sucursal</td>
              <td>${TIENDA}</td>
            </tr>
            <tr class="total">
              <td>Tickets no cortados</td>
              <td>${ticketsNoCortados.length}</td>
            </tr>
            <tr class="total">
              <td>Total acumulado</td>
              <td>${money(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  pintarTickets();
}

function pintarTickets() {
  const tbody = document.getElementById("tbodyReimpresionTickets");
  if (!tbody) return;

  if (!ticketsNoCortados.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4">No hay tickets no cortados.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = ticketsNoCortados.map(v => {
    const total = Number(v.resumen_financiero?.total || v.total || 0);

    return `
      <tr>
        <td>${v.folio || v.id}</td>
        <td>${v.fecha_txt || "—"}</td>
        <td class="num">${money(total)}</td>
        <td>
          <button class="corte-btn gris" type="button" data-reimprimir="${v.id}">
            Reimprimir
          </button>
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll("[data-reimprimir]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-reimprimir");
      const venta = ticketsNoCortados.find(v => v.id === id);
      reimprimirTicket(venta);
    });
  });
}

function reimprimirTicket(venta) {
  if (!venta) return;
  imprimirTicketConfigurado(venta);
}
