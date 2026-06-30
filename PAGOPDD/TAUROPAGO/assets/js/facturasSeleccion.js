import { sb } from './supabaseClient.js';
import { RFC_TAURO } from './config.js';
import { state } from './state.js';
import { money } from './helpers.js';
import { recalcular } from './revisionEnlaces.js';

export async function diagnostico(){
  const diag=document.getElementById('diag'); diag.textContent='Diagnóstico RLS...';
  const res=await Promise.all([
    sb.from('deuda_limpia_pdd').select('id').limit(1),
    sb.from('lista_precios_proveedor').select('id').limit(1),
    sb.from('pagos_proveedor').select('id').limit(1),
  ]);
  const ok=res.map(r=>!r.error);
  diag.innerHTML=ok.every(Boolean)
    ? `<span class="pill pill-ok">RLS OK</span> <span class="small">Si falla UPDATE/INSERT avisará al guardar.</span>`
    : `<span class="pill pill-no">RLS BLOQUEA</span> <span class="small">${res.map((r,i)=>r.error?`T${i+1}: ${r.error.message}`:null).filter(Boolean).join(' | ')}</span>`;
}

export async function cargarListas(){
  const sel=document.getElementById('listaFecha'); sel.innerHTML='<option value="">Seleccione</option>';
  const {data,error}=await sb.from('lista_precios_proveedor').select('fecha_lista').eq('rfc_proveedor',RFC_TAURO).eq('activa',true).order('fecha_lista',{ascending:false});
  if(error){alert(error.message);return}
  [...new Set((data||[]).map(x=>x.fecha_lista))].forEach(f=>sel.innerHTML+=`<option value="${f}">${f}</option>`);
  sel.onchange=async()=>{state.listaFechaActual=sel.value||'';await recalcular()};
}

function renderFotos(fotos){
  if(!Array.isArray(fotos)||!fotos.length) return '<span class="no">Sin fotos</span>';
  return fotos.map((url,i)=>`<a class="foto-link" href="${url}" target="_blank">Foto ${i+1}</a>`).join('<br>');
}

export async function cargarFacturas(){
  const {data,error}=await sb
    .from('deuda_limpia_pdd')
    .select('id,uuid_cfdi,fecha,total,serie,folio,conceptos_detalle,factura_fisicamente,fotos')
    .eq('rfc_emisor',RFC_TAURO)
    .eq('factura_pagada','NO')
    .order('fecha',{ascending:true});
  if(error){alert(error.message);return}
  state.facturas=data||[];
  const body=document.getElementById('facturasBody'); body.innerHTML='';
  state.facturas.forEach(f=>{
    const uuid=String(f.uuid_cfdi||'');
    const fisico=String(f.factura_fisicamente||'NO').toUpperCase();
    body.innerHTML+=`
      <tr>
        <td><input type="checkbox" data-id="${f.id}"></td>
        <td>${String(f.fecha||'').substring(0,10)}</td>
        <td>${(f.serie||'')+' '+(f.folio||'')}</td>
        <td style="font-size:12px">${uuid.slice(0,8)}…</td>
        <td class="monto">${money(f.total)}</td>
        <td>${renderFotos(f.fotos)}</td>
        <td class="${fisico==='SI'?'fisico-si':'fisico-no'}">${fisico}</td>
      </tr>`;
  });
  body.querySelectorAll('input[type=checkbox]').forEach(cb=>cb.addEventListener('change',recalcular));
}
