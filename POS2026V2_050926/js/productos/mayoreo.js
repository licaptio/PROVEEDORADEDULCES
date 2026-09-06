export const productosMayoreo = [];

export function esMayoreo(codigo) {
  return productosMayoreo.includes(String(codigo));
}
