import { estado } from './estado.js';
import { $, money } from './ui.js';
import { getFacturaById, recalcularPago } from './calculos.js';

export function abrirDescuentoFactura(id){
  const f = getFacturaById(id);
  if(!f) return;
  estado.facturaDescId = String(id);
  $('descFacturaPill').textContent = `${(f.serie||'')} ${(f.folio||'')} • ${String(f.uuid_cfdi||'').slice(0,8)}…`;
  const base = Number(f.total || 0);
  const descActual = Number(f.descuento?.monto || 0);
  $('descImporteOriginal').value = money(base);
  $('descMonto').value = descActual ? descActual.toFixed(2) : '';
  $('descNota').value = f.descuento?.nota || '';
  $('descHint').textContent = `Máximo ajuste: ${money(base)}. Si pones 0 se quita.`;
  $('modalDescOverlay').style.display = 'block';
  setTimeout(()=> $('descMonto').focus(), 80);
}

export function cerrarDesc(){
  $('modalDescOverlay').style.display = 'none';
  estado.facturaDescId = null;
}

export function quitarDescuentoFactura(){
  if(!estado.facturaDescId) return;
  const f = getFacturaById(estado.facturaDescId);
  if(!f) return;
  f.descuento = null;
  cerrarDesc();
  recalcularPago();
}

export function aplicarDescuento(){
  if(!estado.facturaDescId) return;
  const f = getFacturaById(estado.facturaDescId);
  if(!f) return;
  const base = Number(f.total || 0);
  const monto = Number($('descMonto').value || 0);
  const nota = $('descNota').value;
  if(monto < 0){ alert('El ajuste debe ser positivo.'); return; }
  if(monto > base){ alert('El ajuste no puede ser mayor al importe original.'); return; }
  f.descuento = monto === 0 ? null : { monto, nota: String(nota || '') };
  cerrarDesc();
  recalcularPago();
}

window.abrirDescuentoFactura = abrirDescuentoFactura;
window.cerrarDesc = cerrarDesc;
window.quitarDescuentoFactura = quitarDescuentoFactura;
window.aplicarDescuento = aplicarDescuento;
