function filasFacturasExcel(pagos){
  const filas=[];

  pagos.filter(p=>!esPagoManual(p)).forEach(p=>{
    const facturas=asegurarArray(p.facturas_info);
    const ajustes=asegurarArray(p.ajustes);

    facturas.forEach(f=>{
      const uuid=f.uuid_cfdi||f.uuid||f.udi||f.UUID||'';

      const total=Number(f.importe_original||0);
      const descuentoFactura=Number(f?.descuento?.monto||0);
      const netoFactura=Number(f.importe_final||(total-descuentoFactura));

      filas.push({
        Banco:p.banco,
        'Fecha pago':p.fecha_pago,
        Proveedor:p.proveedor_nombre,
        RFC:p.rfc_emisor,
        'Fecha factura':f.fecha||'',
        'UUID / UDI':uuid,
        Serie:f.serie||'',
        Folio:f.folio||'',
        'Importe original factura':total,
        'Descuento por factura':descuentoFactura,
        'Neto factura':netoFactura,
        'Descuento global del pago':Number(p.total_ajustes||0),
        'Total pagado del pago':Number(p.importe_pagado||0),
        'Comprobante':p.comprobante_raw||'',
        'Notas pago':p.notas||''
      });
    });

    if(ajustes.length){
      ajustes.forEach(a=>{
        filas.push({
          Banco:p.banco,
          'Fecha pago':p.fecha_pago,
          Proveedor:p.proveedor_nombre,
          RFC:p.rfc_emisor,
          'Fecha factura':'',
          'UUID / UDI':'AJUSTE GLOBAL',
          Serie:'',
          Folio:'',
          'Importe original factura':0,
          'Descuento por factura':0,
          'Neto factura':0,
          'Descuento global del pago':Number(a.monto||0),
          'Total pagado del pago':Number(p.importe_pagado||0),
          'Comprobante':p.comprobante_raw||'',
          'Notas pago':a.nota||p.notas||''
        });
      });
    }
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

  const totalPagado=PAGOS_SEMANA.reduce((s,p)=>s+Number(p.importe_pagado||0),0);
  const totalFacturas=PAGOS_SEMANA.reduce((s,p)=>s+Number(p.total_facturas||0),0);
  const totalAjustes=PAGOS_SEMANA.reduce((s,p)=>s+Number(p.total_ajustes||0),0);

  const resumen=[{
    Reporte: localStorage.getItem('provsoft_nombre_reporte') || window.PROVSOFT_CONFIG.NOMBRE_REPORTE,
    'Fecha inicio':inicio,
    'Fecha fin':fin,
    'Total pagado':totalPagado,
    'Total facturas':totalFacturas,
    'Total descuentos/ajustes':totalAjustes,
    'Número de pagos':PAGOS_SEMANA.length
  }];

  const wb=XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(resumen),
    'Resumen'
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(filasFacturasExcel(PAGOS_SEMANA)),
    'Facturas pagadas'
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(filasManualesExcel(PAGOS_SEMANA)),
    'Pagos manuales'
  );

  XLSX.writeFile(wb, `reporte_pagos_${inicio}_a_${fin}.xlsx`);
}
