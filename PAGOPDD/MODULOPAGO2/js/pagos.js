import { sb } from './supabaseClient.js';
import { estado } from './estado.js';
import { $, toast, mostrarPantalla } from './ui.js';
import { getFacturaById, recalcularPago } from './calculos.js';
import { cargarFacturasProveedor } from './facturas.js';

const TOLERANCIA = 0.03;

function numero(valor){
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function redondear(valor, decimales = 2){
  const factor = 10 ** decimales;
  return Math.round((numero(valor) + Number.EPSILON) * factor) / factor;
}

function limitar(valor, minimo, maximo){
  return Math.min(Math.max(numero(valor), minimo), maximo);
}

function codigoImpuesto(valor){
  const v = String(valor ?? '').trim().toUpperCase();
  if(v === 'IVA' || v === '002') return '002';
  if(v === 'IEPS' || v === '003') return '003';
  if(v === 'ISR' || v === '001') return '001';
  return v || 'OTRO';
}

function nombreImpuesto(codigo){
  if(codigo === '001') return 'ISR';
  if(codigo === '002') return 'IVA';
  if(codigo === '003') return 'IEPS';
  return codigo || 'OTRO';
}

function tasaImpuesto(obj){
  const tasa = obj?.tasa ?? obj?.tasaOCuota ?? obj?.tasa_cuota ?? obj?.tasaCuota ?? null;
  return tasa === null || tasa === undefined || tasa === '' ? null : numero(tasa);
}

function normalizarMovimiento(obj, tipo){
  if(!obj || typeof obj !== 'object') return null;
  const importe = Math.abs(numero(obj.importe ?? obj.Importe ?? obj.monto ?? obj.total));
  if(importe <= 0) return null;

  const codigo = codigoImpuesto(obj.impuesto ?? obj.Impuesto ?? obj.codigo ?? obj.nombre);
  return {
    tipo,
    impuesto: codigo,
    nombre: nombreImpuesto(codigo),
    base: redondear(Math.abs(numero(obj.base ?? obj.Base)), 6),
    factor: String(obj.tipoFactor ?? obj.TipoFactor ?? obj.factor ?? '').trim() || null,
    tasa: tasaImpuesto(obj),
    importe_original: redondear(importe, 6)
  };
}

function obtenerArreglo(obj, nombres){
  if(!obj || typeof obj !== 'object') return [];
  for(const nombre of nombres){
    if(Array.isArray(obj[nombre])) return obj[nombre];
  }
  return [];
}

function extraerDesdeConceptos(conceptos){
  const movimientos = [];
  if(!Array.isArray(conceptos)) return movimientos;

  conceptos.forEach(concepto => {
    obtenerArreglo(concepto, ['traslados', 'Traslados']).forEach(x => {
      const mov = normalizarMovimiento(x, 'TRASLADO');
      if(mov) movimientos.push(mov);
    });
    obtenerArreglo(concepto, ['retenciones', 'Retenciones']).forEach(x => {
      const mov = normalizarMovimiento(x, 'RETENCION');
      if(mov) movimientos.push(mov);
    });
  });

  return movimientos;
}

function extraerDesdeGlobales(globales){
  const movimientos = [];
  if(!globales || typeof globales !== 'object') return movimientos;

  const visitar = (nodo, pista = '') => {
    if(Array.isArray(nodo)){
      nodo.forEach(item => visitar(item, pista));
      return;
    }
    if(!nodo || typeof nodo !== 'object') return;

    const pistaMayus = pista.toUpperCase();
    const pareceMovimiento =
      nodo.importe !== undefined || nodo.Importe !== undefined ||
      nodo.monto !== undefined || nodo.total !== undefined;

    if(pareceMovimiento && (nodo.impuesto !== undefined || nodo.Impuesto !== undefined || nodo.codigo !== undefined || nodo.nombre !== undefined)){
      const tipo = pistaMayus.includes('RETENC') ? 'RETENCION' : 'TRASLADO';
      const mov = normalizarMovimiento(nodo, tipo);
      if(mov) movimientos.push(mov);
      return;
    }

    Object.entries(nodo).forEach(([clave, valor]) => visitar(valor, `${pista}.${clave}`));
  };

  visitar(globales, 'impuestos_globales');

  // Respaldo para estructuras resumidas sin arreglos de movimientos.
  if(!movimientos.length){
    const posibles = [
      ['002', globales.iva ?? globales.total_iva ?? globales.totalIVA, 'TRASLADO'],
      ['003', globales.ieps ?? globales.total_ieps ?? globales.totalIEPS, 'TRASLADO'],
      ['002', globales.iva_retenido ?? globales.ivaRetenido, 'RETENCION'],
      ['001', globales.isr_retenido ?? globales.isrRetenido, 'RETENCION']
    ];
    posibles.forEach(([impuesto, importe, tipo]) => {
      if(Math.abs(numero(importe)) > 0){
        movimientos.push({
          tipo,
          impuesto,
          nombre: nombreImpuesto(impuesto),
          base: 0,
          factor: null,
          tasa: null,
          importe_original: redondear(Math.abs(numero(importe)), 6)
        });
      }
    });
  }

  return movimientos;
}

function agruparMovimientos(movimientos){
  const mapa = new Map();

  movimientos.forEach(m => {
    const tasa = m.tasa === null ? '' : String(redondear(m.tasa, 8));
    const clave = [m.tipo, m.impuesto, m.factor || '', tasa].join('|');
    const actual = mapa.get(clave) || { ...m, base: 0, importe_original: 0 };
    actual.base += numero(m.base);
    actual.importe_original += numero(m.importe_original);
    mapa.set(clave, actual);
  });

  return [...mapa.values()].map(m => ({
    ...m,
    base: redondear(m.base, 6),
    importe_original: redondear(m.importe_original, 6)
  }));
}

function extraerImpuestosFactura(factura){
  const desdeConceptos = extraerDesdeConceptos(factura?.conceptos_detalle);
  const movimientos = desdeConceptos.length
    ? desdeConceptos
    : extraerDesdeGlobales(factura?.impuestos_globales);
  return agruparMovimientos(movimientos);
}

function distribuirAjusteGlobal(facturas, ajusteGlobal){
  const totalGlobal = redondear(Math.max(0, numero(ajusteGlobal)));
  const resultado = new Map();
  if(totalGlobal <= 0 || !facturas.length) return resultado;

  const bases = facturas.map(f => {
    const total = Math.max(0, numero(f.total));
    const individual = limitar(numero(f.descuento?.monto), 0, total);
    return { id: String(f.id), disponible: redondear(Math.max(0, total - individual)) };
  });

  const disponibleTotal = redondear(bases.reduce((s, x) => s + x.disponible, 0));
  if(totalGlobal - disponibleTotal > TOLERANCIA){
    throw new Error('El descuento global es mayor al importe disponible después de los ajustes individuales.');
  }

  let asignado = 0;
  bases.forEach((x, indice) => {
    let parte = 0;
    if(indice === bases.length - 1){
      parte = redondear(totalGlobal - asignado);
    }else if(disponibleTotal > 0){
      parte = redondear(totalGlobal * (x.disponible / disponibleTotal));
      parte = Math.min(parte, x.disponible);
    }
    asignado = redondear(asignado + parte);
    resultado.set(x.id, parte);
  });

  return resultado;
}

function prorratearComponente(original, proporcionAjuste){
  const orig = redondear(original);
  const ajustado = redondear(orig * proporcionAjuste);
  const pagado = redondear(orig - ajustado);
  return { original: orig, pagado, ajustado };
}

function construirInformacionFiscal(){
  const facturas = estado.facturasSeleccionadas
    .map(id => getFacturaById(id))
    .filter(Boolean);

  const ajusteGlobalPositivo = Math.abs(numero(estado.totales.ajusteGlobalMonto));
  const globalPorFactura = distribuirAjusteGlobal(facturas, ajusteGlobalPositivo);

  const totales = {
    subtotal_original: 0,
    subtotal_pagado: 0,
    subtotal_ajustado: 0,
    iva_original: 0,
    iva_pagado: 0,
    iva_ajustado: 0,
    ieps_original: 0,
    ieps_pagado: 0,
    ieps_ajustado: 0,
    retenciones_originales: 0,
    retenciones_pagadas: 0,
    retenciones_ajustadas: 0
  };

  const detalleAcumulado = new Map();

  const facturasInfo = facturas.map(f => {
    const totalFactura = redondear(f.total);
    const ajusteIndividual = redondear(limitar(numero(f.descuento?.monto), 0, totalFactura));
    const ajusteGlobal = redondear(globalPorFactura.get(String(f.id)) || 0);
    const ajusteTotal = redondear(ajusteIndividual + ajusteGlobal);
    const importePagado = redondear(totalFactura - ajusteTotal);
    const proporcionAjuste = totalFactura > 0 ? limitar(ajusteTotal / totalFactura, 0, 1) : 0;
    const proporcionPagada = redondear(1 - proporcionAjuste, 10);

    const subtotal = prorratearComponente(numero(f.subtotal), proporcionAjuste);
    totales.subtotal_original += subtotal.original;
    totales.subtotal_pagado += subtotal.pagado;
    totales.subtotal_ajustado += subtotal.ajustado;

    const impuestos = extraerImpuestosFactura(f).map(m => {
      const p = prorratearComponente(m.importe_original, proporcionAjuste);
      const detalle = {
        tipo: m.tipo,
        impuesto: m.impuesto,
        nombre: m.nombre,
        base_original: redondear(m.base),
        factor: m.factor,
        tasa: m.tasa,
        importe_original: p.original,
        importe_pagado: p.pagado,
        importe_ajustado: p.ajustado
      };

      if(m.tipo === 'RETENCION'){
        totales.retenciones_originales += p.original;
        totales.retenciones_pagadas += p.pagado;
        totales.retenciones_ajustadas += p.ajustado;
      }else if(m.impuesto === '002'){
        totales.iva_original += p.original;
        totales.iva_pagado += p.pagado;
        totales.iva_ajustado += p.ajustado;
      }else if(m.impuesto === '003'){
        totales.ieps_original += p.original;
        totales.ieps_pagado += p.pagado;
        totales.ieps_ajustado += p.ajustado;
      }

      const tasaClave = detalle.tasa === null ? '' : String(redondear(detalle.tasa, 8));
      const clave = [detalle.tipo, detalle.impuesto, detalle.factor || '', tasaClave].join('|');
      const ac = detalleAcumulado.get(clave) || {
        tipo: detalle.tipo,
        impuesto: detalle.impuesto,
        nombre: detalle.nombre,
        factor: detalle.factor,
        tasa: detalle.tasa,
        importe_original: 0,
        importe_pagado: 0,
        importe_ajustado: 0
      };
      ac.importe_original += detalle.importe_original;
      ac.importe_pagado += detalle.importe_pagado;
      ac.importe_ajustado += detalle.importe_ajustado;
      detalleAcumulado.set(clave, ac);

      return detalle;
    });

    const suma = campo => redondear(impuestos
      .filter(x => campo.filtro(x))
      .reduce((s, x) => s + numero(x[campo.prop]), 0));

    return {
      deuda_id: f.id,
      uuid_cfdi: f.uuid_cfdi,
      fecha: f.fecha,
      proveedor: f.razon_social_emisor,
      serie: f.serie,
      folio: f.folio,
      importe_original: totalFactura,
      ajuste_individual: ajusteIndividual > 0 ? {
        monto: ajusteIndividual,
        nota: String(f.descuento?.nota || '')
      } : null,
      ajuste_global_asignado: ajusteGlobal,
      ajuste_total: ajusteTotal,
      importe_pagado: importePagado,
      importe_final: importePagado,
      proporcion_pagada: proporcionPagada,
      proporcion_ajustada: redondear(proporcionAjuste, 10),
      subtotal_original: subtotal.original,
      subtotal_pagado: subtotal.pagado,
      subtotal_ajustado: subtotal.ajustado,
      iva_original: suma({ filtro: x => x.tipo === 'TRASLADO' && x.impuesto === '002', prop: 'importe_original' }),
      iva_pagado: suma({ filtro: x => x.tipo === 'TRASLADO' && x.impuesto === '002', prop: 'importe_pagado' }),
      iva_ajustado: suma({ filtro: x => x.tipo === 'TRASLADO' && x.impuesto === '002', prop: 'importe_ajustado' }),
      ieps_original: suma({ filtro: x => x.tipo === 'TRASLADO' && x.impuesto === '003', prop: 'importe_original' }),
      ieps_pagado: suma({ filtro: x => x.tipo === 'TRASLADO' && x.impuesto === '003', prop: 'importe_pagado' }),
      ieps_ajustado: suma({ filtro: x => x.tipo === 'TRASLADO' && x.impuesto === '003', prop: 'importe_ajustado' }),
      retenciones_originales: suma({ filtro: x => x.tipo === 'RETENCION', prop: 'importe_original' }),
      retenciones_pagadas: suma({ filtro: x => x.tipo === 'RETENCION', prop: 'importe_pagado' }),
      retenciones_ajustadas: suma({ filtro: x => x.tipo === 'RETENCION', prop: 'importe_ajustado' }),
      impuestos
    };
  });

  Object.keys(totales).forEach(k => { totales[k] = redondear(totales[k]); });

  const impuestosDetalle = [...detalleAcumulado.values()].map(x => ({
    ...x,
    importe_original: redondear(x.importe_original),
    importe_pagado: redondear(x.importe_pagado),
    importe_ajustado: redondear(x.importe_ajustado)
  }));

  return { facturasInfo, totales, impuestosDetalle };
}

function validarPago(importe){
  const esperado = redondear(estado.totales.totalFinal);
  if(Math.abs(redondear(importe) - esperado) > TOLERANCIA){
    throw new Error(`El importe bancario debe ser igual al total final: $${esperado.toFixed(2)}.`);
  }
  if(esperado <= 0){
    throw new Error('El total final debe ser mayor a cero.');
  }
}

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
  try{ validarPago(importe); }catch(error){ toast(error.message); return; }

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
  try{ validarPago(importe); }catch(error){ toast(error.message); return; }
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

  let fiscal;
  try{
    validarPago(importe);
    fiscal = construirInformacionFiscal();
  }catch(error){
    alert(error.message || String(error));
    return;
  }

  const totalAjustes = redondear(
    numero(estado.totales.descIndividualTotal) + Math.abs(numero(estado.totales.ajusteGlobalMonto))
  );

  const sumaAplicada = redondear(fiscal.facturasInfo.reduce((s, f) => s + numero(f.importe_pagado), 0));
  if(Math.abs(sumaAplicada - redondear(importe)) > TOLERANCIA){
    alert(`Error de distribución: las facturas suman $${sumaAplicada.toFixed(2)} y el pago es $${redondear(importe).toFixed(2)}.`);
    return;
  }

  const ajustesInfo = fiscal.facturasInfo
    .filter(f => f.ajuste_total > 0)
    .map(f => ({
      tipo: 'AJUSTE_FACTURA',
      deuda_id: f.deuda_id,
      uuid_cfdi: f.uuid_cfdi,
      serie: f.serie,
      folio: f.folio,
      ajuste_individual: f.ajuste_individual,
      ajuste_global_asignado: f.ajuste_global_asignado,
      monto_total: f.ajuste_total
    }));

  if(numero(estado.ajusteGlobal.monto) > 0){
    ajustesInfo.push({
      tipo: 'DESCUENTO_GLOBAL_RESUMEN',
      monto: redondear(Math.abs(estado.totales.ajusteGlobalMonto)),
      nota: String(estado.ajusteGlobal.nota || '')
    });
  }

  const btn = $('btnGuardar');
  btn.disabled = true;
  toast('Guardando pago...', 1500);

  const registro = {
    rfc_emisor: estado.rfcProveedor,
    proveedor_nombre: estado.proveedorNombre,
    banco,
    fecha_pago: fechaPago,
    total_facturas: redondear(estado.totales.subtotalOriginal),
    total_ajustes: totalAjustes,
    importe_pagado: redondear(importe),
    facturas_info: fiscal.facturasInfo,
    ajustes: ajustesInfo,
    comprobante_raw: '',
    notas: estado.notas,

    subtotal_original: fiscal.totales.subtotal_original,
    subtotal_pagado: fiscal.totales.subtotal_pagado,
    subtotal_ajustado: fiscal.totales.subtotal_ajustado,

    iva_original: fiscal.totales.iva_original,
    iva_pagado: fiscal.totales.iva_pagado,
    iva_ajustado: fiscal.totales.iva_ajustado,

    ieps_original: fiscal.totales.ieps_original,
    ieps_pagado: fiscal.totales.ieps_pagado,
    ieps_ajustado: fiscal.totales.ieps_ajustado,

    retenciones_originales: fiscal.totales.retenciones_originales,
    retenciones_pagadas: fiscal.totales.retenciones_pagadas,
    retenciones_ajustadas: fiscal.totales.retenciones_ajustadas,

    impuestos_detalle: fiscal.impuestosDetalle
  };

  const { error: e1 } = await sb.from('pagos_proveedor').insert(registro);

  if(e1){
    btn.disabled = false;
    alert(JSON.stringify(e1, null, 2));
    return;
  }

  const ids = fiscal.facturasInfo.map(f => f.deuda_id);
  const { error: e2 } = await sb
    .from('deuda_limpia_pdd')
    .update({ factura_pagada: 'SI' })
    .in('id', ids);

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
