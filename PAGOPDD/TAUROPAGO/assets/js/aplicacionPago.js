import { sb } from './supabaseClient.js';
import { RFC_TAURO, NOMBRE_TAURO } from './config.js';
import { state } from './state.js';
import { getIvaRate, hoyISO, safeJson } from './helpers.js';
import { recalcular } from './revisionEnlaces.js';

const redondear = n => Number((Number(n) || 0).toFixed(2));
const limitarRatio = n => Math.max(0, Math.min(1, Number(n) || 0));

export function setFechaHoy(){document.getElementById('fechaPago').value=hoyISO()}

function nombreImpuesto(codigo){
  const c=String(codigo||'');
  if(c==='001')return 'ISR';
  if(c==='002')return 'IVA';
  if(c==='003')return 'IEPS';
  return `IMPUESTO_${c||'SIN_CODIGO'}`;
}

function calcularFiscalFactura(factura){
  const conceptos=safeJson(factura.conceptos_detalle);
  let subtotal=0, iva=0, ieps=0, retenciones=0;
  const grupos=new Map();

  const agregar=(tipo,imp)=>{
    const codigo=String(imp?.impuesto||'');
    const tasa=Number(imp?.tasa??imp?.tasaOCuota??0)||0;
    const importe=Number(imp?.importe||0)||0;
    const clave=`${tipo}|${codigo}|${tasa}`;
    if(!grupos.has(clave))grupos.set(clave,{tipo,codigo,nombre:nombreImpuesto(codigo),tasa,importe:0});
    grupos.get(clave).importe+=importe;
    return {codigo,importe};
  };

  conceptos.forEach(con=>{
    subtotal+=(Number(con?.importe||0)||0)-(Number(con?.descuento||0)||0);
    safeJson(con?.traslados).forEach(t=>{
      const {codigo,importe}=agregar('TRASLADO',t);
      if(codigo==='002')iva+=importe;
      else if(codigo==='003')ieps+=importe;
    });
    safeJson(con?.retenciones).forEach(r=>{
      const {importe}=agregar('RETENCION',r);
      retenciones+=importe;
    });
  });

  return {
    deuda_id:factura.id,
    uuid_cfdi:factura.uuid_cfdi,
    serie:factura.serie,
    folio:factura.folio,
    total_factura:Number(factura.total||0),
    subtotal:redondear(subtotal),
    iva:redondear(iva),
    ieps:redondear(ieps),
    retenciones:redondear(retenciones),
    impuestos:[...grupos.values()].map(x=>({...x,importe:redondear(x.importe)}))
  };
}

function calcularDesgloseFiscal(facturas,totalAjustes,importePagado){
  const porFactura=facturas.map(calcularFiscalFactura);
  const original=porFactura.reduce((a,f)=>({
    subtotal:a.subtotal+f.subtotal,
    iva:a.iva+f.iva,
    ieps:a.ieps+f.ieps,
    retenciones:a.retenciones+f.retenciones,
    total:a.total+Number(f.total_factura||0)
  }),{subtotal:0,iva:0,ieps:0,retenciones:0,total:0});

  Object.keys(original).forEach(k=>original[k]=redondear(original[k]));
  const ratioAjuste=limitarRatio(original.total ? Number(totalAjustes||0)/original.total : 0);
  const ajustado={
    subtotal:redondear(original.subtotal*ratioAjuste),
    iva:redondear(original.iva*ratioAjuste),
    ieps:redondear(original.ieps*ratioAjuste),
    retenciones:redondear(original.retenciones*ratioAjuste)
  };
  const despuesAjuste={
    subtotal:redondear(original.subtotal-ajustado.subtotal),
    iva:redondear(original.iva-ajustado.iva),
    ieps:redondear(original.ieps-ajustado.ieps),
    retenciones:redondear(original.retenciones-ajustado.retenciones)
  };
  const netoEsperado=redondear(original.total-Number(totalAjustes||0));
  const ratioPago=limitarRatio(netoEsperado ? Number(importePagado||0)/netoEsperado : 0);
  const pagado={
    subtotal:redondear(despuesAjuste.subtotal*ratioPago),
    iva:redondear(despuesAjuste.iva*ratioPago),
    ieps:redondear(despuesAjuste.ieps*ratioPago),
    retenciones:redondear(despuesAjuste.retenciones*ratioPago)
  };

  return {
    original,ajustado,pagado,
    detalle:{
      version:1,
      metodo:'CONCEPTOS_DETALLE_Y_PRORRATEO_PROPORCIONAL',
      ratio_ajuste:Number(ratioAjuste.toFixed(10)),
      ratio_pago:Number(ratioPago.toFixed(10)),
      total_original:redondear(original.total),
      total_ajustes:redondear(totalAjustes),
      neto_esperado:netoEsperado,
      importe_pagado:redondear(importePagado),
      facturas:porFactura
    }
  };
}

export async function guardarPago(){
  const msg=document.getElementById('msg'); msg.textContent='';
  const fechaLista=document.getElementById('listaFecha').value; if(!fechaLista){alert('Seleccione lista de precios');return}
  const seleccionadas=[...document.querySelectorAll('#facturasBody input[type=checkbox]:checked')].map(x=>String(x.dataset.id)); if(!seleccionadas.length){alert('Seleccione al menos una factura');return}
  const banco=document.getElementById('banco').value; const fechaPago=document.getElementById('fechaPago').value;
  if(!fechaPago){alert('La fecha de pago es obligatoria.');return}
  await recalcular();
  const byFactura=new Map();
  state.articulosSeleccionados.forEach(a=>{
    const k=String(a.deuda_id); if(!byFactura.has(k))byFactura.set(k,{deuda_id:a.deuda_id,uuid_cfdi:a.uuid_cfdi,serie:a.serie,folio:a.folio,fecha:a.fecha,total_factura:a.total_factura,items:[],descuento_factura:0});
    const pack=byFactura.get(k); pack.items.push({concepto_cfdi:a.concepto_cfdi,cantidad:a.cantidad,lista:a._match,calc:a._calc}); pack.descuento_factura+=Number(a._calc?.descuento_aplicado||0);
  });
  const facturasInfo=[...byFactura.values()];
  const facturasCompletas=seleccionadas.map(id=>state.facturas.find(f=>String(f.id)===id)).filter(Boolean);
  const subtotalFacturas=facturasInfo.reduce((s,f)=>s+Number(f.total_factura||0),0);
  const totalDescuentos=facturasInfo.reduce((s,f)=>s+Number(f.descuento_factura||0),0);
  const totalPagar=subtotalFacturas-totalDescuentos;
  const importePagado=Number(document.getElementById('importePago').value||totalPagar);
  if(!Number.isFinite(importePagado)||importePagado<0){alert('El importe pagado no es válido.');return}

  const fiscal=calcularDesgloseFiscal(facturasCompletas,totalDescuentos,importePagado);
  const ajustes=[{tipo:'LISTA_TAURO_USADA',fecha_lista:fechaLista},{tipo:'IVA_RATE_REFERENCIA',iva_rate:getIvaRate()},{tipo:'DIFERENCIAS',total_descuentos:redondear(totalDescuentos)}];
  const registro={
    rfc_emisor:RFC_TAURO,
    proveedor_nombre:NOMBRE_TAURO,
    banco,
    fecha_pago:fechaPago,
    total_facturas:redondear(subtotalFacturas),
    total_ajustes:redondear(totalDescuentos),
    importe_pagado:redondear(importePagado),
    facturas_info:facturasInfo,
    ajustes,
    comprobante_raw:'',
    notas:'',
    tipo_pago:'FACTURAS',
    subtotal_original:fiscal.original.subtotal,
    subtotal_pagado:fiscal.pagado.subtotal,
    subtotal_ajustado:fiscal.ajustado.subtotal,
    iva_original:fiscal.original.iva,
    iva_pagado:fiscal.pagado.iva,
    iva_ajustado:fiscal.ajustado.iva,
    ieps_original:fiscal.original.ieps,
    ieps_pagado:fiscal.pagado.ieps,
    ieps_ajustado:fiscal.ajustado.ieps,
    retenciones_originales:fiscal.original.retenciones,
    retenciones_pagadas:fiscal.pagado.retenciones,
    retenciones_ajustadas:fiscal.ajustado.retenciones,
    impuestos_detalle:fiscal.detalle
  };

  msg.textContent='Guardando pago con desglose de impuestos...';
  const {error:e1}=await sb.from('pagos_proveedor').insert(registro);
  if(e1){alert('Error al guardar pago:\n'+e1.message);msg.textContent='';return}
  msg.textContent='Pago guardado. Marcando facturas como pagadas...';
  const {error:e2}=await sb.from('deuda_limpia_pdd').update({factura_pagada:'SI'}).in('id',seleccionadas);
  if(e2){alert('Pago guardado, pero no se pudieron marcar facturas como pagadas:\n'+e2.message);msg.textContent='⚠ Pago guardado, faltó marcar facturas pagadas.';return}
  msg.textContent='✅ Pago guardado con desglose fiscal y facturas marcadas como pagadas.'; setTimeout(()=>location.reload(),900);
}

export function initPago(){
  document.getElementById('btnGuardarPago').addEventListener('click',guardarPago);
  const btnCopiar=document.getElementById('btnCopiarResumen');
  if(btnCopiar) btnCopiar.addEventListener('click',async()=>{
    const txt=document.getElementById('resumenBanco')?.value||'';
    if(!txt){alert('No hay facturas seleccionadas para copiar.');return}
    try{await navigator.clipboard.writeText(txt); btnCopiar.textContent='✅ Resumen copiado'; setTimeout(()=>btnCopiar.textContent='📋 Copiar resumen',1200)}
    catch{document.getElementById('resumenBanco')?.select(); alert('Selecciona y copia el resumen.')}
  });
}
