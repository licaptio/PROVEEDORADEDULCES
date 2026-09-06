// js/cobro/cobro_descuento_patch.js
// INTEGRACIÓN PARA PEGAR/ADAPTAR EN js/cobro/cobro.js

import {
  solicitarDescuentoAutorizado,
  obtenerDescuentoAutorizado,
  limpiarDescuentoAutorizado
} from "../descuentos/descuentos.js";

// Deben existir en tu cobro.js:
// usuarioActual o getUsuarioLogueado()
// calcularTotales()
// renderTotales()
// abrir/cerrar modal de cobro

export function configurarBotonDescuento({
  btnDescuento,
  usuarioActual,
  recalcularCobro
}) {
  if (!btnDescuento) return;

  btnDescuento.addEventListener("click", () => {
    const descuento = solicitarDescuentoAutorizado(usuarioActual);

    if (!descuento) return;

    if (typeof recalcularCobro === "function") {
      recalcularCobro();
    }
  });
}

export function obtenerDatosDescuentoParaVenta(subtotal = 0) {
  const descuento = obtenerDescuentoAutorizado();
  const porcentaje = Number(descuento.porcentaje || 0);
  const monto = +((Number(subtotal || 0) * porcentaje) / 100).toFixed(2);

  return {
    descuento_porcentaje: porcentaje,
    descuento_monto: monto,
    autorizado_por: porcentaje > 0 ? descuento.autorizado_por : null,
    fecha_autorizacion_descuento: descuento.fecha_autorizacion || null
  };
}

export function limpiarDescuentoDespuesDeVenta() {
  limpiarDescuentoAutorizado();
}
