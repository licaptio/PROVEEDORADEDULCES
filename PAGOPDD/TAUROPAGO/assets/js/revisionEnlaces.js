import { sb } from './supabaseClient.js';
import { RFC_TAURO } from './config.js';
import { state, buildListaMaps, findMatch } from './state.js';
import { money, safeJson, getIvaRate, getValorUnitario } from './helpers.js';
import { abrirModal } from './modalEnlace.js';

export async function cargarListaSeleccionada(){
  const fecha=document.getElementById('listaFecha').value;
  state.listaFechaActual=fecha||'';
  if(!fecha){state.lista=[];buildListaMaps([]);return}
  const {data,error}=await sb.from('lista_precios_proveedor').select('id,descripcion,descripcion_cfdi,costo_neto').eq('rfc_proveedor',RFC_TAURO).eq('fecha_lista',fecha).eq('activa',true);
  if(error){alert(error.message);return}
  state.lista=data||[]; buildListaMaps(state.lista);
}

export function construirArticulosSeleccionados(){
  const checks=[...document.querySelectorAll('#facturasBody input[type=checkbox]:checked')];
  state.articulosSeleccionados=[]; let subTotal=0;
  checks.forEach(cb=>{
    const f=state.facturas.find(x=>String(x.id)===String(cb.dataset.id)); if(!f)return;
    subTotal+=Number(f.total||0);
    safeJson(f.conceptos_detalle).forEach(con=>{
      const descripcion=String(con.descripcion??con.Descripcion??'').trim();
      const cantidad=Number(con.cantidad??con.Cantidad??0); const qty=isFinite(cantidad)?cantidad:0;
      state.articulosSeleccionados.push({
        deuda_id:f.id, uuid_cfdi:f.uuid_cfdi, serie:f.serie, folio:f.folio, fecha:f.fecha,
        total_factura:Number(f.total||0), concepto_cfdi:descripcion, cantidad:qty,
        valor_unitario_sin_iva:getValorUnitario(con,qty)
      });
    });
  });
  return subTotal;
}

export async function recalcular(){
  await cargarListaSeleccionada();
  const body=document.getElementById('articulosBody'); body.innerHTML='';
  document.getElementById('msg').textContent='';
  const fechaLista=document.getElementById('listaFecha').value;
  const iva=getIvaRate();
  const haySeleccion=document.querySelectorAll('#facturasBody input[type=checkbox]:checked').length>0;
  if(!haySeleccion){setTotales(0,0);return}
  if(haySeleccion&&!fechaLista){
    body.innerHTML='<tr><td colspan="11"><span class="pill pill-no">Selecciona la fecha de lista primero</span></td></tr>'; setTotales(0,0); return;
  }
  const subTotal=construirArticulosSeleccionados(); let totalDescuentos=0;
  state.articulosSeleccionados.forEach((a,idx)=>{
    const match=findMatch(a.concepto_cfdi); const factSin=Number(a.valor_unitario_sin_iva||0); const factCon=factSin*(1+iva);
    let estado='no',listaUnit=0,difUnit=0,difTotal=0,descAplicado=0;
    if(match){listaUnit=Number(match.costo_neto||0); difUnit=factCon-listaUnit; difTotal=difUnit*Number(a.cantidad||0); if(difTotal>0) descAplicado=difTotal; totalDescuentos+=descAplicado; estado=(difUnit===0)?'ok':(difUnit>0?'diff':'ok')}
    const estadoTxt=estado==='ok'?'OK':estado==='diff'?'Diferencia':'Sin enlace';
    body.innerHTML+=`
      <tr>
        <td style="font-size:12px">${String(a.uuid_cfdi||'').slice(0,8)}…</td><td>${a.concepto_cfdi}</td><td>${a.cantidad}</td>
        <td class="monto">${money(factSin)}</td><td class="monto">${money(factCon)}</td><td class="monto">${match?money(listaUnit):'-'}</td>
        <td class="monto">${match?money(difUnit):'-'}</td><td class="monto">${match?money(difTotal):'-'}</td><td class="monto">${match?money(descAplicado):'-'}</td>
        <td class="${estado}">${estadoTxt}</td><td><button class="btn-outline" data-match-idx="${idx}">${match?'✏️':'🔗'}</button></td>
      </tr>`;
    a._match=match?{lista_id:match.id,lista_descripcion:match.descripcion,lista_descripcion_cfdi:match.descripcion_cfdi||null,lista_unit_neto:listaUnit}:null;
    a._calc={iva_rate:iva,fact_unit_sin_iva:factSin,fact_unit_con_iva:factCon,dif_unit:difUnit,dif_total:difTotal,descuento_aplicado:descAplicado};
  });
  body.querySelectorAll('[data-match-idx]').forEach(btn=>btn.addEventListener('click',()=>abrirModal(Number(btn.dataset.matchIdx))));
  setTotales(subTotal,totalDescuentos);
}

function setTotales(subTotal,totalDescuentos){
  const totalFinal=subTotal-totalDescuentos;
  document.getElementById('subTotal').innerText=money(subTotal);
  document.getElementById('totalDesc').innerText=money(totalDescuentos);
  document.getElementById('totalFinal').innerText=money(totalFinal);
  document.getElementById('importePago').value=(isFinite(totalFinal)?totalFinal:0).toFixed(2);
}
