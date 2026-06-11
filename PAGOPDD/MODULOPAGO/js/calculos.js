import { estado } from './estado.js';
import { $, money, escapeHtml, formatearFechaCorta, diasTranscurridos } from './ui.js';

export function getFacturaById(id){
  return estado.facturas.find(x => String(x.id) === String(id));
}

export function getSeleccionadas(){
  return [...document.querySelectorAll('#tbodyFacturas input[type=checkbox]:checked')]
    .map(cb => String(cb.dataset.id));
}

export function actualizarGlobal(){
  const val = $('gl_monto')?.value ?? '';
  const m = val === '' ? 0 : Number(val);
  const n = $('gl_nota')?.value || '';
  estado.ajusteGlobal = { monto: (isFinite(m) && m > 0) ? m : 0, nota: n };
  recalcularPago();
}

export function recalcularPago(){
  estado.facturasSeleccionadas = getSeleccionadas();
  let subtotalOriginal = 0;
  let descIndividualTotal = 0;
  let subtotalNeto = 0;

  estado.facturasSeleccionadas.forEach(id => {
    const f = getFacturaById(id);
    if(!f) return;
    const base = Number(f.total || 0);
    const desc = Number(f.descuento?.monto || 0);
    subtotalOriginal += base;
    descIndividualTotal += desc;
    subtotalNeto += base - desc;
  });

  const descGlobal = Number(estado.ajusteGlobal.monto || 0);
  const ajusteGlobalMonto = descGlobal > 0 ? -Math.abs(descGlobal) : 0;
  const totalFinal = subtotalNeto + ajusteGlobalMonto;

  estado.totales = { subtotalOriginal, descIndividualTotal, subtotalNeto, ajusteGlobalMonto, totalFinal };

  pintarDetalleCalculo();
  $('totalSeleccionadoFacturas').textContent = money(subtotalOriginal);
  $('metricSeleccionadas').textContent = estado.facturasSeleccionadas.length;
  $('metricTotal').textContent = money(totalFinal);
  $('totalFinalPago').textContent = money(totalFinal);
  $('resumenFinalPago').textContent = `${estado.facturasSeleccionadas.length} factura(s), ajustes por factura ${money(descIndividualTotal)}, global ${money(ajusteGlobalMonto)}.`;
  if($('importePago')) $('importePago').value = totalFinal.toFixed(2);
}

function pintarDetalleCalculo(){
  const tbody = $('tbodyCalculo');
  if(!tbody) return;
  tbody.innerHTML = '';

  estado.facturasSeleccionadas.forEach(id => {
    const f = getFacturaById(id);
    if(!f) return;
    const base = Number(f.total || 0);
    const desc = Number(f.descuento?.monto || 0);
    const nota = String(f.descuento?.nota || '').trim();
    const neto = base - desc;

    tbody.innerHTML += `
      <tr>
        <td>${formatearFechaCorta(f.fecha)}<div class="muted">${diasTranscurridos(f.fecha)}</div></td>
        <td style="font-size:12px"><a class="link-detalle" href="detalle.html?uuid=${encodeURIComponent(f.uuid_cfdi || '')}" target="_blank">${escapeHtml(f.uuid_cfdi || '')}</a></td>
        <td>${escapeHtml(f.razon_social_emisor || '')}</td>
        <td>${escapeHtml((f.serie || '') + ' ' + (f.folio || ''))}</td>
        <td class="monto" style="text-align:right">
          ${money(neto)}
          <div class="muted ${desc>0?'monto-negativo':''}" style="text-align:right">Ajuste: ${desc>0 ? '-' + money(desc) : money(0)}</div>
          ${nota ? `<div class="muted" style="text-align:right;max-width:320px;margin-left:auto">${escapeHtml(nota)}</div>` : ''}
          <div class="muted" style="text-align:right">Orig: ${money(base)}</div>
        </td>
        <td><button class="btn-outline btn-mini" type="button" onclick="abrirDescuentoFactura('${f.id}')">💸 Ajuste</button></td>
      </tr>`;
  });

  const t = estado.totales;
  const descGlobal = Number(estado.ajusteGlobal.monto || 0);
  tbody.innerHTML += `
    <tr class="resumen-row"><td colspan="4"><b>Subtotal facturas (original)</b></td><td class="monto monto-subtotal" style="text-align:right">${money(t.subtotalOriginal)}</td><td></td></tr>
    <tr class="resumen-row"><td colspan="4"><b>Ajustes por factura (total)</b></td><td class="monto ${t.descIndividualTotal>0?'monto-negativo':''}" style="text-align:right">${t.descIndividualTotal>0 ? '-' + money(t.descIndividualTotal) : money(0)}</td><td></td></tr>
    <tr class="resumen-row"><td colspan="4"><b>Total facturas (neto)</b></td><td class="monto monto-subtotal" style="text-align:right">${money(t.subtotalNeto)}</td><td></td></tr>
    <tr>
      <td colspan="4"><b>Descuento global</b><div class="muted">Monto positivo = descuento.</div>
        <div class="global-box">
          <input id="gl_monto" type="number" step="0.01" placeholder="0.00" value="${descGlobal ? Number(descGlobal).toFixed(2) : ''}" onchange="actualizarGlobal()" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}">
          <input id="gl_nota" placeholder="Nota opcional" value="${escapeHtml(estado.ajusteGlobal.nota || '')}" onchange="actualizarGlobal()" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}">
        </div>
      </td>
      <td class="monto ${t.ajusteGlobalMonto<0?'monto-negativo':''}" style="text-align:right">${descGlobal>0 ? money(t.ajusteGlobalMonto) : money(0)}<div class="muted">${descGlobal>0?'Aplicado al neto':'Sin global'}</div></td><td></td>
    </tr>
    <tr class="total-row"><td colspan="4"><b>Total a pagar</b></td><td class="monto" style="text-align:right;font-size:22px">${money(t.totalFinal)}</td><td></td></tr>`;
}

window.actualizarGlobal = actualizarGlobal;
window.recalcularPago = recalcularPago;
