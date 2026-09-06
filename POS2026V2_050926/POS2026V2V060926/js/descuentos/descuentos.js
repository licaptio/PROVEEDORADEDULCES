// js/descuentos/descuentos.js
// Descuentos autorizados POSPDD26

export const DESCUENTO_MAXIMO = 3;
export const PASSWORD_DESCUENTO = "MADERO690*";

let descuentoAutorizado = {
  porcentaje: 0,
  autorizado_por: null,
  fecha_autorizacion: null
};

export function obtenerDescuentoAutorizado() {
  return { ...descuentoAutorizado };
}

export function limpiarDescuentoAutorizado() {
  descuentoAutorizado = {
    porcentaje: 0,
    autorizado_por: null,
    fecha_autorizacion: null
  };
}

export function solicitarDescuentoAutorizado(usuarioActual = null) {
  const porcentaje = Number(
    prompt(`Introduce el descuento (%) máximo ${DESCUENTO_MAXIMO}%`) || 0
  );

  if (!porcentaje || isNaN(porcentaje) || porcentaje <= 0) {
    alert("Porcentaje inválido.");
    return null;
  }

  if (porcentaje > DESCUENTO_MAXIMO) {
    alert(`El descuento máximo permitido es ${DESCUENTO_MAXIMO}%`);
    return null;
  }

  const password = prompt("Introduce la contraseña de autorización");

  if (password !== PASSWORD_DESCUENTO) {
    alert("Contraseña incorrecta.");
    return null;
  }

  descuentoAutorizado = {
    porcentaje,
    autorizado_por:
      usuarioActual?.usuario ||
      usuarioActual?.nombre ||
      "AUTORIZADO",
    fecha_autorizacion: new Date().toISOString()
  };

  alert(`Descuento del ${porcentaje}% aplicado correctamente.`);

  return { ...descuentoAutorizado };
}

export function calcularDescuentoSobreSubtotal(subtotal = 0) {
  const porcentaje = Number(descuentoAutorizado.porcentaje || 0);
  const base = Number(subtotal || 0);

  if (!porcentaje || !base) return 0;

  return +((base * porcentaje) / 100).toFixed(2);
}
