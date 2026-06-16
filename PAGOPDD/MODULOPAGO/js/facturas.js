import { sb } from './supabaseClient.js';
import { estado } from './estado.js';
import { $, money, escapeHtml, formatearFechaCorta, diasTranscurridos, toast, mostrarPantalla } from './ui.js';
import { recalcularPago } from './calculos.js';

export async function cargarFacturasProveedor(rfc){
  $('tbodyFacturas').innerHTML = '<tr><td colspan="8" class="muted">Cargando facturas...</td></tr>';
  estado.facturas = [];
  estado.facturasSeleccionadas = [];
  estado.ajusteGlobal = { monto: 0, nota: '' };
  recalcularPago();

  const { data, error } = await sb
    .from('deuda_limpia_pdd')
    .select('id,uuid_cfdi,serie,folio,fecha,total,razon_social_emisor,fotos,factura_fisicamente,descuentos')
    .eq('rfc_emisor', rfc)
    .eq('factura_pagada','NO')
    .order('fecha',{ascending:true});

  if(error){
    $('tbodyFacturas').innerHTML = `<tr><td colspan="8">Error: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }
  estado.facturas = (data || []).map(f => ({ ...f, descuento: null }));
  pintarFacturas();
}

export function pintarFacturas(){
  const tbody = $('tbodyFacturas');
  if(!estado.facturas.length){
    tbody.innerHTML = '<tr><td colspan="8" class="muted">Este proveedor no tiene facturas pendientes.</td></tr>';
    recalcularPago();
    return;
  }

  tbody.innerHTML = estado.facturas.map(f => {
    const totalNum = Number(f.total || 0);
    const fotos = Array.isArray(f.fotos) ? f.fotos : [];
    const pdfUrl = String(f.descuentos || '').trim();
    const esFisica = (f.factura_fisicamente || 'NO') === 'SI';
    const fisicaHtml = esFisica ? '<span class="badge badge-ok">SI</span>' : '<span class="badge badge-no">NO</span>';
    const fotosHtml = fotos.length
      ? `<div class="foto-links">${fotos.map((url,i)=>`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="link-chip">📎 ${i+1}</a>`).join('')}</div><div class="muted">${fotos.length} archivo(s)</div>`
      : '<span class="muted">—</span>';
    const descHtml = pdfUrl.startsWith('http') ? `<a href="${escapeHtml(pdfUrl)}" target="_blank" rel="noopener noreferrer" class="pdf-chip">📄 Nota</a>` : '<span class="muted">—</span>';
    return `
      <tr>
        <td><input type="checkbox" data-id="${escapeHtml(f.id)}" onchange="recalcularPago()"></td>
        <td>${formatearFechaCorta(f.fecha)} <span class="muted">(${diasTranscurridos(f.fecha)})</span></td>
        <td>${escapeHtml((f.serie||'') + ' ' + (f.folio||''))}</td>
        <td style="text-align:center">${fisicaHtml}</td>
        <td>${fotosHtml}</td>
        <td style="text-align:right">${descHtml}</td>
        <td style="text-align:right" class="monto">${money(totalNum)}</td>
        <td><a class="link-detalle" href="detalle.html?uuid=${encodeURIComponent(f.uuid_cfdi || '')}" target="_blank" title="Abrir detalle CFDI">${escapeHtml(f.uuid_cfdi || 'Ver detalle')}</a></td>
      </tr>`;
  }).join('');
  recalcularPago();
}

export function seleccionarTodasFacturas(valor){
  document.querySelectorAll('#tbodyFacturas input[type=checkbox]').forEach(cb => cb.checked = valor);
  recalcularPago();
}

export function irADescuentos(){
  recalcularPago();
  if(!estado.facturasSeleccionadas.length){ toast('Selecciona al menos una factura.'); return; }
  mostrarPantalla('pantallaAjustes');
}

export function volverInicioDesdeFacturas(){
  estado.rfcProveedor = '';
  estado.proveedorNombre = '';
  estado.facturas = [];
  estado.facturasSeleccionadas = [];
  estado.ajusteGlobal = { monto: 0, nota: '' };
  $('headerStatus').textContent = 'Listo';
  mostrarPantalla('pantallaInicio');
  recalcularPago();
}

window.seleccionarTodasFacturas = seleccionarTodasFacturas;
window.irADescuentos = irADescuentos;
window.volverInicioDesdeFacturas = volverInicioDesdeFacturas;
