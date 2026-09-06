export function obtenerImpuestosDepartamento(dep) {
  return {
    iva: dep?.iva || 0,
    ieps: dep?.ieps || 0
  };
}
