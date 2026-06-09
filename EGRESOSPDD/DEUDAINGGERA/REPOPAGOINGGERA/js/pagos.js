let PAGOS_SEMANA=[];
async function cargarPagosSemana(){
  const {inicio,fin}=obtenerSemanaSeleccionada();
  document.getElementById('rangoSemanaTexto').textContent=`Semana del ${fechaMx(inicio)} al ${fechaMx(fin)}`;
  mostrarCarga('Consultando pagos de la semana...');
  try{
    PAGOS_SEMANA = await consultarPagos(inicio, fin);
    renderResumen(PAGOS_SEMANA);
    renderPagos(PAGOS_SEMANA);
  }catch(err){
    console.error(err);
    toast('Error al consultar pagos. Revisa config.js y permisos Supabase.');
  }finally{ ocultarCargaConMinimo(); }
}
function abrirDetallePago(id){
  const p=PAGOS_SEMANA.find(x=>x.id===id);
  if(!p) return;
  const manual=esPagoManual(p);
  const facturas=asegurarArray(p.facturas_info);
  const ajustes=asegurarArray(p.ajustes);
  let html=`
    <div class="detalle-grid">
      <div class="detalle-item"><small>Banco</small><strong>${escapeHtml(p.banco)}</strong></div>
      <div class="detalle-item"><small>Fecha pago</small><strong>${fechaMx(p.fecha_pago)}</strong></div>
      <div class="detalle-item"><small>Proveedor</small><strong>${escapeHtml(p.proveedor_nombre)}</strong></div>
      <div class="detalle-item"><small>Importe pagado</small><strong>${dinero(p.importe_pagado)}</strong></div>
      <div class="detalle-item"><small>RFC</small><strong>${escapeHtml(p.rfc_emisor)}</strong></div>
      <div class="detalle-item"><small>Tipo</small><strong>${manual?'PAGO MANUAL / SIN UUID':'PAGO CON FACTURAS'}</strong></div>
      <div class="detalle-item"><small>Total facturas</small><strong>${dinero(p.total_facturas)}</strong></div>
      <div class="detalle-item"><small>Total ajustes</small><strong>${dinero(p.total_ajustes)}</strong></div>
    </div>`;
  if(manual){
    html+=`<h3>Concepto / notas</h3><div class="bloque-notas">${escapeHtml(p.concepto_manual || p.notas || '')}</div>`;
  }else{
    html+=`<h3>Facturas pagadas</h3><div class="tabla-wrap"><table class="tabla"><thead><tr><th>Fecha factura</th><th>UUID / UDI</th><th>Serie</th><th>Folio</th><th>Total</th><th>Descuento</th><th>Neto</th></tr></thead><tbody>`;
    html+=facturas.map(f=>{
      const uuid=f.uuid_cfdi||f.uuid||f.udi||f.UUID||'';
      const total=Number(f.total||f.importe_total||f.monto||0);
      const desc=buscarDescuentoFactura(uuid,f,ajustes);
      return `<tr><td>${fechaMx(f.fecha||f.fecha_factura||f.fecha_emision)}</td><td>${escapeHtml(uuid)}</td><td>${escapeHtml(f.serie||'')}</td><td>${escapeHtml(f.folio||'')}</td><td class="texto-derecha">${dinero(total)}</td><td class="texto-derecha">${dinero(desc)}</td><td class="texto-derecha">${dinero(total-desc)}</td></tr>`;
    }).join('');
    html+=`</tbody></table></div>`;
  }
  html+=`<h3>Comprobante / referencia</h3><div class="bloque-notas">${escapeHtml(p.comprobante_raw||'')}</div>`;
  if(p.notas && !manual) html+=`<h3>Notas</h3><div class="bloque-notas">${escapeHtml(p.notas)}</div>`;
  document.getElementById('detallePagoContenido').innerHTML=html;
  abrirModal('modalDetalle');
}
function buscarDescuentoFactura(uuid, factura, ajustes){
  const folio=factura.folio||'';
  const serie=factura.serie||'';
  return ajustes.filter(a=>{
    const au=a.uuid_cfdi||a.uuid||a.udi||a.UUID||'';
    return (uuid && au===uuid) || (folio && String(a.folio||'')===String(folio) && String(a.serie||'')===String(serie));
  }).reduce((s,a)=>s+Number(a.importe||a.monto||a.descuento||0),0);
}
