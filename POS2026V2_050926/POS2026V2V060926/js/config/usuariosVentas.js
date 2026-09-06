// js/config/usuariosVentas.js
// Aquí modificas qué usuarios graban en ventas reales y cuál es la ruta de prueba.

export const RUTA_VENTAS_REALES = {
  tienda: "RUTA1",
  coleccion: "VENTASV20261",
  segmentos: ["CLIENTES", "PDD031204KL5", "VENTASV20261"]
};

export const RUTA_VENTAS_PRUEBAS = {
  tienda: "VENTASPRUEBAS",
  coleccion: "VENTAS"
};

export const USUARIOS_RUTA1 = [
  "GERARDO",
  "JUAN"
];

export function obtenerRutaVentaPorUsuario(usuarioActual) {
  const usuario = String(usuarioActual?.usuario || "")
    .toUpperCase()
    .trim();

  const rutaAsignada = String(
    usuarioActual?.rutaId || usuarioActual?.ruta_id || usuarioActual?.sucursal || ""
  ).trim().toUpperCase();
  if (usuarioActual?.venta_prueba === true) {
    return { ...RUTA_VENTAS_PRUEBAS, esPrueba: true };
  }

  return {
    ...RUTA_VENTAS_REALES,
    tienda: rutaAsignada || "RUTA1",
    esPrueba: false
  };
}

export function obtenerSegmentosVentas(rutaVenta) {
  if (Array.isArray(rutaVenta?.segmentos) && rutaVenta.segmentos.length) {
    return rutaVenta.segmentos;
  }
  if (rutaVenta?.esPrueba === true) {
    return ["TIENDAS", rutaVenta.tienda, rutaVenta.coleccion];
  }
  return RUTA_VENTAS_REALES.segmentos;
}
