function filasFacturasExcel(pagos){
  const filas=[];
  pagos.filter(p=>!esPagoManual(p)).forEach(p=>{
    const facturas=asegurarArray(p.facturas_info);
    const ajustes=asegurarArray(p.ajustes);
    facturas.forEach(f=>{
      const uuid=f.uuid_cfdi||f.uuid||f.udi||f.UUID||'';
      const total=Number(f.total||f.importe_total||f.monto||0);
      const desc=buscarDescuentoFactura(uuid,f,ajustes);
      filas.push({
        Banco:p.banco,
        'Fecha pago':p.fecha_pago,
        Proveedor:p.proveedor_nombre,
        RFC:p.rfc_emisor,
        'Fecha factura':f.fecha||f.fecha_factura||f.fecha_emision||'',
        'UUID / UDI':uuid,
        Serie:f.serie||'',
        Folio:f.folio||'',
        'Importe total factura':total,
        'Descuento aplicado':desc,
        'Neto pagado':total-desc,
        'Notas pago':p.notas||''
      });
    });
  });
  return filas;
}
function filasManualesExcel(pagos){
  return pagos.filter(esPagoManual).map(p=>({
    Banco:p.banco,
    'Fecha pago':p.fecha_pago,
    Proveedor:p.proveedor_nombre,
    RFC:p.rfc_emisor,
    Concepto:p.concepto_manual||p.notas||'',
    'Importe pagado':Number(p.importe_pagado||0),
    Comprobante:p.comprobante_raw||'',
    Notas:p.notas||''
  }));
}
function exportarExcel(){
  const {inicio,fin}=obtenerSemanaSeleccionada();
  const resumen=[{
    Reporte: localStorage.getItem('provsoft_nombre_reporte') || window.PROVSOFT_CONFIG.NOMBRE_REPORTE,
    'Fecha inicio':inicio,
    'Fecha fin':fin,
    'Total pagado':PAGOS_SEMANA.reduce((s,p)=>s+Number(p.importe_pagado||0),0),
    'Total facturas':PAGOS_SEMANA.reduce((s,p)=>s+Number(p.total_facturas||0),0),
    'Total descuentos/ajustes':PAGOS_SEMANA.reduce((s,p)=>s+Number(p.total_ajustes||0),0),
    'Número de pagos':PAGOS_SEMANA.length
  }];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), 'Resumen');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasFacturasExcel(PAGOS_SEMANA)), 'Facturas pagadas');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasManualesExcel(PAGOS_SEMANA)), 'Pagos manuales');
  XLSX.writeFile(wb, `reporte_pagos_${inicio}_a_${fin}.xlsx`);
}
