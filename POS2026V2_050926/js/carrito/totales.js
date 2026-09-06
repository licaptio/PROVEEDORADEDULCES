export function calcularTotales(carrito = []) {

  let subtotal = 0;

  carrito.forEach(item => {
    subtotal += item.importe || 0;
  });

  return {
    subtotal,
    impuestos:0,
    total:subtotal
  };
}
