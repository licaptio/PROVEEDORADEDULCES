let descuentoAutorizado = 0;

export function setDescuento(valor) {

  descuentoAutorizado =
    Number(valor || 0);

}

export function getDescuento() {

  return descuentoAutorizado;

}

export function limpiarDescuento() {

  descuentoAutorizado = 0;

}
