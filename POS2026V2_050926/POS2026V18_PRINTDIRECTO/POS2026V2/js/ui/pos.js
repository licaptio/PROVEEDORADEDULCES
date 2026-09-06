import { getUsuarioLogueado } from "../auth/login.js";
import { iniciarScanner } from "../scanner/scanner.js";
import {
  renderCarrito,
  limpiarCarrito
} from "../carrito/carrito.js";
import { iniciarCobro } from "../cobro/cobro.js";
import { limpiarFotoProducto } from "../fotos/fotoProductoVista.js";
import { pintarProximoFolio } from "./folioVisible.js";
import { iniciarBotonCancelarVenta } from "../ventas/cancelarVenta.js";
import { iniciarCorteOperativo } from "../reportes/corte.js";
import { iniciarReimpresionTickets } from "../reportes/reimpresionTickets.js";
import { iniciarVentaEnEspera, iniciarRecuperarVentasEnEspera } from "../ventas/ventaEspera.js";
import { iniciarRespaldoLocalVentaActual, procesarVentaLocalInterrumpidaAlIniciar } from "../ventas/ventaInterrumpidaLocal.js";
import { iniciarConfiguracionImpresoras } from "../ticket/impresionConfig.js";
import { iniciarPanelVentasPendientes } from "../offline/ventasPendientesUI.js";
import { iniciarIndicadorConexion } from "./estadoConexion.js";

export function renderPOS() {

  const usuario = getUsuarioLogueado();
  const posApp = document.getElementById("posApp");

  if (!posApp) {
    console.error("No existe #posApp");
    return;
  }

  posApp.innerHTML = `
    <div class="pos-container">

      <header class="pos-header">

        <div class="header-right">
          <span class="dato-header dato-usuario">
            <small>USUARIO</small>
            <strong>${usuario?.nombre || usuario?.usuario || "-"}</strong>
          </span>
          <span class="dato-header dato-folio">
            <small>FOLIO</small>
            <strong id="folioVenta">Cargando...</strong>
          </span>

          <button id="btnMenuConfig" title="Menú de operaciones" aria-label="Abrir menú de operaciones">
            ⋮
          </button>
        </div>

      </header>

      <div id="panelConfig" class="panel-config oculto">
        <div class="panel-config-titulo">CONFIGURACIÓN</div>

<button id="btnCorteOperativo" type="button">
  📊 Corte Operativo
</button>

<button type="button">
  📜 Historial Ventas
</button>

<button id="btnReimpresionTickets" type="button">
  🧾 Reimpresión de Tickets
</button>

<button id="btnVentasPendientes" type="button">
  ⏳ Ventas Pendientes
</button>

<button id="btnSincronizarVentas" type="button">
  🔄 Sincronización
</button>

        <hr>

        <div class="panel-config-subtitulo">💰 Operaciones de Venta</div>

        <button id="btnVentaEspera" type="button" title="Mandar venta a espera con autorización de supervisor">
          ⏳ Mandar a Espera
        </button>

        <button id="btnRecuperarVentaEspera" type="button" title="Recuperar venta en espera">
          🔍 Recuperar Venta
        </button>

        <button id="btnCancelarVenta" type="button" title="Cancelar venta actual con autorización de supervisor">
          ❌ Cancelar Venta
        </button>

        <hr>

        <button id="btnConfigImpresoras" type="button">🖨 Impresoras</button>
        <button type="button">📱 RawBT</button>
        <button type="button">🎫 Configuración Ticket</button>

        <hr>

        <button id="btnLogout" type="button">🚪 Cerrar Sesión</button>
      </div>

<section class="zona-scanner">

  <input
    id="buscador"
    type="text"
    placeholder="Escanea un código o escribe el producto"
    autocomplete="off"
  >

  <button id="btnCobrar">
    COBRAR (F9)
  </button>

</section>

      <section class="contenido-pos">

        <div class="panel-carrito">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Cant.</th>
                <th>Concepto</th>
                <th>Precio</th>
                <th>Importe</th>
                <th></th>
              </tr>
            </thead>

            <tbody id="tbody"></tbody>
          </table>
        </div>

        <aside class="panel-derecho">

          <div class="foto-producto-box">
            <img
              id="fotoProductoActual"
              src="./assets/logo_proveedora.webp"
              alt="Foto Producto"
            >

            <div
              id="contadorFotosProducto"
              class="contador-fotos oculto"
            >
              1/1
            </div>
          </div>

          <div class="totales-box">

            <div>
              <span>Subtotal:</span>
              <span id="lblSubtotal">$0.00</span>
            </div>

            <div>
              <span>Descuento:</span>
              <span id="lblDescuento">$0.00</span>
            </div>

            <div>
              <span>Impuestos:</span>
              <span id="lblImpuestos">$0.00</span>
            </div>

            <div>
              <span>Cantidad:</span>
              <span id="lblCantidad">0</span>
            </div>

            <div class="total-final">
              <span>Total:</span>
              <span id="lblTotal">$0.00</span>
            </div>

          </div>

          <div id="estadoConexionPOS" class="estado-conexion-pos verificando" title="Verificando conexión">
            <span class="estado-conexion-punto"></span>
            <span id="estadoConexionTexto">VERIFICANDO</span>
          </div>

        </aside>

      </section>

    </div>
  `;

  renderCarrito();
  limpiarFotoProducto();
  pintarProximoFolio();
  iniciarScanner();
  iniciarCobro();
  iniciarBotonCancelarVenta();
  iniciarVentaEnEspera();
  iniciarRecuperarVentasEnEspera();
  iniciarCorteOperativo();
  iniciarReimpresionTickets();
  iniciarConfiguracionImpresoras();
  iniciarPanelVentasPendientes();
  iniciarIndicadorConexion();
  procesarVentaLocalInterrumpidaAlIniciar();
  iniciarRespaldoLocalVentaActual();


  const btnMenuConfig = document.getElementById("btnMenuConfig");
  const panelConfig = document.getElementById("panelConfig");

  if (btnMenuConfig && panelConfig) {
    btnMenuConfig.addEventListener("click", (event) => {
      event.stopPropagation();
      panelConfig.classList.toggle("oculto");
    });

    panelConfig.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    document.addEventListener("click", () => {
      panelConfig.classList.add("oculto");
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        panelConfig.classList.add("oculto");
      }
    });
  }
document.addEventListener("keydown", (e) => {

  if (e.key === "F7") {
    e.preventDefault();
    const btnRecuperar = document.getElementById("btnRecuperarVentaEspera");
    if (btnRecuperar) btnRecuperar.click();
  }

  if (e.key === "F8") {
    e.preventDefault();

    const btnVentaEspera =
      document.getElementById("btnVentaEspera");

    if (btnVentaEspera) {
      btnVentaEspera.click();
    }
  }

  if (e.key === "F9") {
    e.preventDefault();

    const btnCobrar =
      document.getElementById("btnCobrar");

    if (btnCobrar) {
      btnCobrar.click();
    }
  }

});
  console.log("POS renderizado correctamente");
}
