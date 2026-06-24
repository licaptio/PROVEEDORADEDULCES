export const estado = {
  proveedores: [],
  proveedoresFiltrados: [],
  proveedoresMap: new Map(),
  rfcProveedor: '',
  proveedorNombre: '',
  facturas: [],
  facturasSeleccionadas: [],
  facturaDescId: null,
  ajusteGlobal: { monto: 0, nota: '' },
  banco: 'BBVA',
  fechaPago: '',
  importePago: 0,
  notas: '',
  totales: {
    subtotalOriginal: 0,
    descIndividualTotal: 0,
    subtotalNeto: 0,
    ajusteGlobalMonto: 0,
    totalFinal: 0
  }
};
