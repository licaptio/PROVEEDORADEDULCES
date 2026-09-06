import { toast } from "../ui/toast.js";
import {
  carrito,
  limpiarCarrito,
  limpiarBitacoraCancelacionesPartidas,
  limpiarBitacoraCambiosCantidad
} from "../carrito/carrito.js";
import { limpiarFotoProducto } from "../fotos/fotoProductoVista.js";
import { guardarVentaCanceladaCaptura, cancelarVentaFirestore } from "./guardarVenta.js";
import { pintarProximoFolio } from "../ui/folioVisible.js";
import { obtenerDatoLocal, eliminarDatoLocal } from "../catalogo/indexeddb.js";
import { limpiarVentaLocalInterrumpida } from "./ventaInterrumpidaLocal.js";
import { seleccionarMotivoCancelacion } from "./motivosCancelacion.js";

const PASSWORD_SUPERVISOR = "MADERO690*";

let clicksCancelar = 0;
let timerCancelar = null;

export function iniciarBotonCancelarVenta() {
  const btn = document.getElementById("btnCancelarVenta");
  if (!btn) return;

  btn.addEventListener("click", manejarClickCancelarVenta);
}

function resetBotonCancelar(btn) {
  clicksCancelar = 0;

  if (btn) {
    btn.textContent = "Cancelar";
  }
}

async function manejarClickCancelarVenta() {
  const btn = document.getElementById("btnCancelarVenta");

  clicksCancelar++;

  if (btn) {
    btn.textContent = `Cancelar (${clicksCancelar}/3)`;
  }

  clearTimeout(timerCancelar);

  timerCancelar = setTimeout(() => {
    resetBotonCancelar(btn);
  }, 2500);

  if (clicksCancelar < 3) {
    toast(`Cancelación bloqueada ${clicksCancelar}/3`);
    return;
  }

  clearTimeout(timerCancelar);
  resetBotonCancelar(btn);

  if (carrito.length === 0) {
    toast("No hay artículos para cancelar");
    return;
  }

  const pass = prompt("Contraseña supervisor para cancelar venta actual:");

  if (pass !== PASSWORD_SUPERVISOR) {
    toast("Contraseña incorrecta");
    return;
  }

  const motivoSeleccionado = await seleccionarMotivoCancelacion();
  if (!motivoSeleccionado) return;

  const motivo = motivoSeleccionado.texto;

  const confirmar = confirm(
    `¿Cancelar venta actual?\n\nMotivo: ${motivo}`
  );

  if (!confirmar) {
    toast("Cancelación abortada");
    return;
  }

  try {
    toast("Guardando cancelación...");

    const carritoSnapshot = carrito.map(x => ({ ...x }));

    const ventaRecuperada = await obtenerDatoLocal("ventaEnEsperaRecuperadaPOS", null);
    let cancelada;

    if (ventaRecuperada?.documento_id) {
      await cancelarVentaFirestore(
        ventaRecuperada.documento_id,
        motivo,
        motivoSeleccionado.codigo
      );
      cancelada = {
        documento_id: ventaRecuperada.documento_id,
        folio: ventaRecuperada.folio || null,
        estado_venta: "CANCELADA"
      };
    } else {
      cancelada = await guardarVentaCanceladaCaptura(
        motivo,
        carritoSnapshot,
        motivoSeleccionado.codigo
      );
    }

    console.log("VENTA CANCELADA EN CAPTURA:", cancelada);

    limpiarCarrito();
    limpiarBitacoraCancelacionesPartidas();
    limpiarBitacoraCambiosCantidad();
    limpiarFotoProducto();
    await eliminarDatoLocal("ventaEnEsperaRecuperadaPOS");
    await limpiarVentaLocalInterrumpida();
    pintarProximoFolio();

    toast("Venta cancelada y guardada");

  } catch (err) {
    console.error("Error guardando cancelación:", err);
    toast("Error guardando cancelación");
  }
}
