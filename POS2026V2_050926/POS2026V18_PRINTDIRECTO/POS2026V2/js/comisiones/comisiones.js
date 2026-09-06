export function calcularComisionLinea(item) {
  const cantidad = Number(item.cantidad || 0);
  const importe = Number(item.importe || 0);
  const tipo = item.comision_tipo || null;
  const valor = Number(item.comision_valor || 0);

  if (!tipo || !valor) return 0;

  if (tipo === "porcentaje") {
    return +((importe * valor) / 100).toFixed(2);
  }

  if (tipo === "pieza") {
    return +(cantidad * valor).toFixed(2);
  }

  if (tipo === "por_10") {
    return +((cantidad / 10) * valor).toFixed(2);
  }

  return 0;
}

export function calcularComisionTotal(detalle = []) {
  return +detalle.reduce(
    (s, x) => s + Number(x.comision_monto || 0),
    0
  ).toFixed(2);
}