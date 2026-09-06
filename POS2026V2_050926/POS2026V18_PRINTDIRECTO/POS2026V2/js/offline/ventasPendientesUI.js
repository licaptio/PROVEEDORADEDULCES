import { obtenerVentasPendientes, reenviarVentasPendientes } from "./ventasPendientes.js";
import { money } from "../util/money.js";
import { toast } from "../ui/toast.js";

async function abrirPanel() {
  document.getElementById("modalVentasPendientesLocal")?.remove();
  const ventas = await obtenerVentasPendientes();
  const modal = document.createElement("div");
  modal.id = "modalVentasPendientesLocal";
  modal.className = "modal visible";
  modal.innerHTML = `
    <div class="modal-contenido" style="max-width:850px;">
      <h2>Ventas pendientes de sincronizar (${ventas.length})</h2>
      <div style="max-height:55vh;overflow:auto;">
        <table class="corte-table"><thead><tr><th>Folio</th><th>Fecha</th><th>Usuario</th><th>Total</th><th>Intentos</th></tr></thead>
        <tbody>${ventas.length ? ventas.map(x => `<tr><td>${x.venta?.folio || x.id_local}</td><td>${x.venta?.fecha_txt || "—"}</td><td>${x.venta?.usuarioLogin || "—"}</td><td>${money(x.venta?.resumen_financiero?.total || x.venta?.total || 0)}</td><td>${x.intentos || 0}</td></tr>`).join("") : `<tr><td colspan="5">No hay ventas pendientes.</td></tr>`}</tbody></table>
      </div>
      <div class="modal-acciones"><button id="btnReintentarPendientes">Reintentar todas</button><button id="btnCerrarPendientes">Cerrar</button></div>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById("btnCerrarPendientes")?.addEventListener("click", () => modal.remove());
  document.getElementById("btnReintentarPendientes")?.addEventListener("click", async () => {
    const r = await reenviarVentasPendientes();
    modal.remove();
    toast(`Sincronizadas: ${r.reenviadas}. Pendientes: ${r.pendientes}`);
    abrirPanel();
  });
}

export function iniciarPanelVentasPendientes() {
  document.getElementById("btnVentasPendientes")?.addEventListener("click", abrirPanel);
  document.getElementById("btnSincronizarVentas")?.addEventListener("click", async () => {
    const r = await reenviarVentasPendientes();
    toast(`Sincronizadas: ${r.reenviadas}. Pendientes: ${r.pendientes}`);
  });
}
