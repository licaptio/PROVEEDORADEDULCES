import { sb } from './supabaseClient.js';
import { estado } from './estado.js';
import { $, toast, mostrarPantalla } from './ui.js';
import { getFacturaById, recalcularPago } from './calculos.js';
import { cargarFacturasProveedor } from './facturas.js';

export function irADatosPago(){
  recalcularPago();
  if(!estado.facturasSeleccionadas.length){ toast('Selecciona al menos una factura.'); return; }
  $('importePago').value = estado.totales.totalFinal.toFixed(2);
  mostrarPantalla('pantallaPago');
}

export function irAResumenPago(){
  recalcularPago();
  if(!estado.facturasSeleccionadas.length){ toast('Selecciona al menos una factura.'); return; }

  const importe = Number($('importePago').value || 0);
  if(!$('fechaPago').value){ toast('Captura la fecha de pago.'); return; }
  if(!importe || importe <= 0){ toast('El importe no es válido.'); return; }

  pintarDatosResumenBanco();
  mostrarPantalla('pantallaResumen');
}

function pintarDatosResumenBanco(){
  const banco = $('banco')?.value || '—';
  const fecha = $('fechaPago')?.value || '—';
  const importe = Number($('importePago')?.value || 0);

  const lblBancoResumen = $('lblBancoResumen');
  if(lblBancoResumen) lblBancoResumen.textContent = banco;

  const lblFechaResumen = $('lblFechaResumen');
  if(lblFechaResumen) lblFechaResumen.textContent = fecha;

  const lblImporteResumen = $('lblImporteResumen');
  if(lblImporteResumen){
    lblImporteResumen.textContent = new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN' }).format(importe);
  }
}

export function confirmarNotasAntesDeGuardar(){
  recalcularPago();
  if(!estado.facturasSeleccionadas.length){ toast('Selecciona al menos una factura.'); return; }
  const importe = Number($('importePago').value || 0);
  if(!$('fechaPago').value){ toast('Captura la fecha de pago.'); return; }
  if(!importe || importe <= 0){ toast('El importe no es válido.'); return; }
  pintarDatosResumenBanco();
  $('notasPago').value = '';
  $('modalNotas').style.display = 'block';
  setTimeout(()=> $('notasPago').focus(), 80);
}

export function cerrarModalNotas(){
  $('modalNotas').style.display = 'none';
}

export async function guardarPagoDesdeModal(){
  estado.notas = $('notasPago').value || '';
  cerrarModalNotas();
  await guardarPago();
}

export async function guardarPago(){
  if(!estado.rfcProveedor){ alert('Seleccione proveedor'); return; }
  recalcularPago();
  if(!estado.facturasSeleccionadas.length){ alert('Seleccione al menos una factura'); return; }

  const banco = $('banco').value;
  const fechaPago = $('fechaPago').value;
  const importe = Number($('importePago').value || estado.totales.totalFinal);
  if(!fechaPago){ alert('Fecha de pago obligatoria'); return; }

  const facturasInfo = estado.facturasSeleccionadas.map(id => {
    const f = getFacturaById(id);
    const base = Number(f?.total || 0);
    const desc = Number(f?.descuento?.monto || 0);
    return {
      deuda_id: f.id,
      uuid_cfdi: f.uuid_cfdi,
      fecha: f.fecha,
      proveedor: f.razon_social_emisor,
      serie: f.serie,
      folio: f.folio,
      importe_original: base,
      descuento: f.descuento ? { monto: desc, nota: String(f.descuento?.nota || '') } : null,
      importe_final: base - desc
    };
  });

  const ajustesInfo = [];
  if(Number(estado.ajusteGlobal.monto || 0) > 0){
    ajustesInfo.push({
      tipo: 'DESCUENTO_GLOBAL',
      monto: Number(estado.totales.ajusteGlobalMonto.toFixed(2)),
      nota: String(estado.ajusteGlobal.nota || '')
    });
  }

  const btn = $('btnGuardar');
  btn.disabled = true;
  toast('Guardando pago...', 1500);

  const { error: e1 } = await sb.from('pagos_proveedor').insert({
    rfc_emisor: estado.rfcProveedor,
    proveedor_nombre: estado.proveedorNombre,
    banco,
    fecha_pago: fechaPago,
    total_facturas: Number(estado.totales.subtotalNeto.toFixed(2)),
    total_ajustes: Number(estado.totales.ajusteGlobalMonto.toFixed(2)),
    importe_pagado: Number(importe.toFixed(2)),
    facturas_info: facturasInfo,
    ajustes: ajustesInfo,
    comprobante_raw: '',
    notas: estado.notas
  });

  if(e1){
    btn.disabled = false;
    alert(JSON.stringify(e1, null, 2));
    return;
  }

  const ids = facturasInfo.map(f => f.deuda_id);
  const { error: e2 } = await sb.from('deuda_limpia_pdd').update({ factura_pagada: 'SI' }).in('id', ids);

  btn.disabled = false;
  if(e2){
    alert('Pago guardado, pero NO se pudieron marcar las facturas como pagadas:\n\n' + JSON.stringify(e2, null, 2));
    return;
  }

  toast('Pago guardado correctamente');
  estado.facturasSeleccionadas = [];
  estado.ajusteGlobal = { monto: 0, nota: '' };
  await cargarFacturasProveedor(estado.rfcProveedor);
  mostrarPantalla('pantallaInicio');
}

window.irADatosPago = irADatosPago;
window.irAResumenPago = irAResumenPago;
window.confirmarNotasAntesDeGuardar = confirmarNotasAntesDeGuardar;
window.cerrarModalNotas = cerrarModalNotas;
window.guardarPagoDesdeModal = guardarPagoDesdeModal;
