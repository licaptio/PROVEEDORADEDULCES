function filasFacturasExcel(pagos){
  const filas=[];

  pagos.filter(p=>!esPagoManual(p)).forEach(p=>{
    const facturas=asegurarArray(p.facturas_info);
    const ajustes=asegurarArray(p.ajustes);

    filas.push({
      Banco:p.banco,
      'Fecha pago':p.fecha_pago,
      Proveedor:p.proveedor_nombre,
      RFC:p.rfc_emisor,
      'Fecha factura':'',
      'UUID / UDI':'',
      Serie:'',
      Folio:'',
      Total:'',
      'Desc. factura':'',
      'Neto factura':'',
      'Concepto':'ENCABEZADO PAGO',
      Importe:Number(p.importe_pagado||0)
    });

    facturas.forEach(f=>{
      const total=Number(f.importe_original||0);
      const desc=Number(f?.descuento?.monto||0);
      const neto=Number(f.importe_final||(total-desc));

      filas.push({
        Banco:'',
        'Fecha pago':'',
        Proveedor:'',
        RFC:'',
        'Fecha factura':f.fecha||'',
        'UUID / UDI':f.uuid_cfdi||'',
        Serie:f.serie||'',
        Folio:f.folio||'',
        Total:total,
        'Desc. factura':desc,
        'Neto factura':neto,
        'Concepto':'FACTURA',
        Importe:''
      });
    });

    const subtotalFacturas=facturas.reduce((s,f)=>s+Number(f.importe_original||0),0);
    const descuentosFactura=facturas.reduce((s,f)=>s+Number(f?.descuento?.monto||0),0);
    const netoFacturas=facturas.reduce((s,f)=>s+Number(f.importe_final||0),0);
    const ajusteGlobal=Number(p.total_ajustes||0);

    filas.push({
      Banco:'',
      'Fecha pago':'',
      Proveedor:'',
      RFC:'',
      'Fecha factura':'',
      'UUID / UDI':'',
      Serie:'',
      Folio:'',
      Total:subtotalFacturas,
      'Desc. factura':descuentosFactura,
      'Neto factura':netoFacturas,
      'Concepto':'SUBTOTAL FACTURAS',
      Importe:''
    });

    filas.push({
      Banco:'',
      'Fecha pago':'',
      Proveedor:'',
      RFC:'',
      'Fecha factura':'',
      'UUID / UDI':'',
      Serie:'',
      Folio:'',
      Total:'',
      'Desc. factura':'',
      'Neto factura':'',
      'Concepto':'DESCUENTO / AJUSTE GLOBAL',
      Importe:ajusteGlobal
    });

    if(ajustes.length){
      ajustes.forEach(a=>{
        filas.push({
          Banco:'',
          'Fecha pago':'',
          Proveedor:'',
          RFC:'',
          'Fecha factura':'',
          'UUID / UDI':'',
          Serie:'',
          Folio:'',
          Total:'',
          'Desc. factura':'',
          'Neto factura':'',
          'Concepto':a.tipo||'AJUSTE GLOBAL',
          Importe:Number(a.monto||0)
        });
      });
    }

    filas.push({
      Banco:'',
      'Fecha pago':'',
      Proveedor:'',
      RFC:'',
      'Fecha factura':'',
      'UUID / UDI':'',
      Serie:'',
      Folio:'',
      Total:'',
      'Desc. factura':'',
      'Neto factura':'',
      'Concepto':'TOTAL PAGADO',
      Importe:Number(p.importe_pagado||0)
    });

    filas.push({});
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

  const wb=XLSX.utils.book_new();

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
