import { sb } from './supabaseClient.js';
import { RFC_TAURO, NOMBRE_TAURO } from './config.js';
import { state } from './state.js';
import { getIvaRate, hoyISO } from './helpers.js';
import { recalcular } from './revisionEnlaces.js';

export function setFechaHoy(){document.getElementById('fechaPago').value=hoyISO()}

export async function guardarPago(){
  const msg=document.getElementById('msg'); msg.textContent='';
  const fechaLista=document.getElementById('listaFecha').value; if(!fechaLista){alert('Seleccione lista de precios');return}
  const seleccionadas=[...document.querySelectorAll('#facturasBody input[type=checkbox]:checked')].map(x=>String(x.dataset.id)); if(!seleccionadas.length){alert('Seleccione al menos una factura');return}
  const banco=document.getElementById('banco').value; const fechaPago=document.getElementById('fechaPago').value; const comprobante=(document.getElementById('comprobante').value||'').trim(); const notas=document.getElementById('notas').value||'';
  if(!fechaPago||!comprobante){alert('Fecha de pago y comprobante son obligatorios.');return}
  await recalcular();
  const byFactura=new Map();
  state.articulosSeleccionados.forEach(a=>{
    const k=String(a.deuda_id); if(!byFactura.has(k))byFactura.set(k,{deuda_id:a.deuda_id,uuid_cfdi:a.uuid_cfdi,serie:a.serie,folio:a.folio,fecha:a.fecha,total_factura:a.total_factura,items:[],descuento_factura:0});
    const pack=byFactura.get(k); pack.items.push({concepto_cfdi:a.concepto_cfdi,cantidad:a.cantidad,lista:a._match,calc:a._calc}); pack.descuento_factura+=Number(a._calc?.descuento_aplicado||0);
  });
  const facturasInfo=[...byFactura.values()];
  const subtotalFacturas=facturasInfo.reduce((s,f)=>s+Number(f.total_factura||0),0);
  const totalDescuentos=facturasInfo.reduce((s,f)=>s+Number(f.descuento_factura||0),0);
  const totalPagar=subtotalFacturas-totalDescuentos;
  const importePagado=Number(document.getElementById('importePago').value||totalPagar);
  const ajustes=[{tipo:'LISTA_TAURO_USADA',fecha_lista:fechaLista},{tipo:'IVA_RATE',iva_rate:getIvaRate()},{tipo:'DIFERENCIAS',total_descuentos:Number(totalDescuentos.toFixed(2))}];
  msg.textContent='Guardando pago...';
  const {error:e1}=await sb.from('pagos_proveedor').insert({rfc_emisor:RFC_TAURO,proveedor_nombre:NOMBRE_TAURO,banco,fecha_pago:fechaPago,total_facturas:Number(subtotalFacturas.toFixed(2)),total_ajustes:Number(totalDescuentos.toFixed(2)),importe_pagado:Number(importePagado.toFixed(2)),facturas_info:facturasInfo,ajustes,comprobante_raw:comprobante,notas});
  if(e1){alert('Error al guardar pago:\n'+e1.message);msg.textContent='';return}
  msg.textContent='Pago guardado. Marcando facturas como pagadas...';
  const {error:e2}=await sb.from('deuda_limpia_pdd').update({factura_pagada:'SI'}).in('id',seleccionadas);
  if(e2){alert('Pago guardado, pero no se pudieron marcar facturas como pagadas:\n'+e2.message);msg.textContent='⚠ Pago guardado, faltó marcar facturas pagadas.';return}
  msg.textContent='✅ Pago guardado y facturas marcadas como pagadas.'; setTimeout(()=>location.reload(),900);
}

export function initPago(){document.getElementById('btnGuardarPago').addEventListener('click',guardarPago)}
