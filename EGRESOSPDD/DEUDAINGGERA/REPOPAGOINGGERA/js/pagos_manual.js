function abrirPagoManual(){
  document.getElementById('manualFechaPago').value = hoyISO();
  abrirModal('modalPagoManual');
}
async function guardarPagoManual(e){
  e.preventDefault();
  const importe=Number(document.getElementById('manualImporte').value||0);
  const notas=document.getElementById('manualNotas').value.trim();
  const payload={
    rfc_emisor: document.getElementById('manualRfc').value.trim() || 'SIN_RFC',
    proveedor_nombre: document.getElementById('manualProveedor').value.trim(),
    banco: document.getElementById('manualBanco').value.trim(),
    fecha_pago: document.getElementById('manualFechaPago').value,
    importe_pagado: importe,
    total_facturas: importe,
    total_ajustes: 0,
    facturas_info: [],
    ajustes: [],
    comprobante_raw: document.getElementById('manualComprobante').value.trim() || 'PAGO MANUAL',
    notas
  };
  mostrarCarga('Guardando pago manual...');
  try{
    await insertarPagoManual(payload);
    cerrarModal('modalPagoManual');
    document.getElementById('formPagoManual').reset();
    toast('Pago manual guardado');
    await cargarPagosSemana();
  }catch(err){
    console.error(err);
    toast('No se pudo guardar el pago manual. Revisa Supabase.');
  }finally{ ocultarCargaConMinimo(); }
}
