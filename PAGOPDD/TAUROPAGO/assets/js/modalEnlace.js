import { sb } from './supabaseClient.js';
import { state } from './state.js';
import { money, normalizarBusqueda } from './helpers.js';
import { recalcular } from './revisionEnlaces.js';

function scoreLista(row,busqueda){
  const q=normalizarBusqueda(busqueda); if(!q)return 1;
  const tokens=q.split(' ').filter(Boolean);
  const texto=normalizarBusqueda([row.descripcion,row.descripcion_cfdi].join(' '));
  if(!tokens.every(t=>texto.includes(t))) return 0;
  return tokens.reduce((s,t)=>s+(texto.includes(t)?100:0)+(texto.split(' ').includes(t)?50:0),0);
}

function renderMatchOptions(filterText){
  const sel=document.getElementById('matchSelect'); const summary=document.getElementById('matchSummary'); const q=String(filterText||'').trim();
  const filtered=!q?state.lista.map(r=>({...r,_score:1})):state.lista.map(r=>({...r,_score:scoreLista(r,q)})).filter(r=>r._score>0).sort((a,b)=>b._score-a._score);
  let min=null,max=null,sum=0; filtered.forEach(r=>{const c=Number(r.costo_neto||0); if(min===null||c<min)min=c; if(max===null||c>max)max=c; sum+=c});
  summary.textContent=`Mostrando ${filtered.length} de ${state.lista.length}. `+(filtered.length?`Min ${money(min)} · Max ${money(max)} · Prom ${money(sum/filtered.length)}`:'');
  sel.innerHTML=''; filtered.slice(0,500).forEach(r=>{sel.innerHTML+=`<option value="${r.id}">${r.descripcion} — ${money(r.costo_neto)}${r.descripcion_cfdi?' (ya enlazado)':''}</option>`});
  sel.dispatchEvent(new Event('change'));
}

export function abrirModal(idx){
  if(!state.listaFechaActual){alert('Selecciona la fecha de lista primero.');return}
  const a=state.articulosSeleccionados[idx]; if(!a)return;
  state.modalConceptoIdx=idx; state.modalConceptoTxt=a.concepto_cfdi;
  document.getElementById('conceptoTxt').textContent=state.modalConceptoTxt;
  document.getElementById('modalMsg').textContent='';
  const inp=document.getElementById('matchSearch'); inp.value=''; inp.oninput=()=>renderMatchOptions(inp.value);
  const sel=document.getElementById('matchSelect'); sel.onchange=()=>{const chosen=state.lista.find(x=>String(x.id)===String(sel.value)); document.getElementById('matchCosto').value=chosen?money(chosen.costo_neto):''};
  renderMatchOptions('');
  const actual=state.lista.find(l=>l.descripcion_cfdi===state.modalConceptoTxt);
  if(actual){const inFirst=Array.from(sel.options).some(o=>String(o.value)===String(actual.id)); if(!inFirst){inp.value=String(actual.descripcion||''); renderMatchOptions(inp.value)} sel.value=actual.id; sel.dispatchEvent(new Event('change'))}
  document.getElementById('modal').style.display='block'; setTimeout(()=>{inp.focus();inp.select()},50);
}

export function cerrarModal(){document.getElementById('modal').style.display='none'; state.modalConceptoIdx=-1; state.modalConceptoTxt=''}

export async function quitarEnlaceActual(){
  const modalMsg=document.getElementById('modalMsg'); const old=state.lista.find(l=>l.descripcion_cfdi===state.modalConceptoTxt);
  if(!old){modalMsg.textContent='No existe enlace que quitar.';return}
  if(!confirm('¿Quitar el enlace actual de este concepto?'))return;
  modalMsg.textContent='Quitando enlace...'; const {error}=await sb.from('lista_precios_proveedor').update({descripcion_cfdi:null}).eq('id',old.id);
  if(error){alert(error.message);modalMsg.textContent='';return}
  cerrarModal(); await recalcular();
}

export async function confirmarMatch(){
  const sel=document.getElementById('matchSelect'); const newId=sel.value; const modalMsg=document.getElementById('modalMsg');
  if(!newId||!state.modalConceptoTxt){alert('Selecciona artículo.');return}
  const chosen=state.lista.find(x=>String(x.id)===String(newId));
  if(chosen&&chosen.descripcion_cfdi&&chosen.descripcion_cfdi!==state.modalConceptoTxt){
    if(!confirm(`Ese renglón ya está enlazado a otro CFDI.\n\nActual: ${chosen.descripcion_cfdi}\n\n¿Reemplazarlo?`))return;
  }
  modalMsg.textContent='Guardando enlace...';
  const old=state.lista.find(l=>l.descripcion_cfdi===state.modalConceptoTxt);
  if(old&&String(old.id)!==String(newId)){
    const {error:eOld}=await sb.from('lista_precios_proveedor').update({descripcion_cfdi:null}).eq('id',old.id);
    if(eOld){alert(eOld.message);modalMsg.textContent='';return}
  }
  const {error}=await sb.from('lista_precios_proveedor').update({descripcion_cfdi:state.modalConceptoTxt}).eq('id',newId);
  if(error){alert('No se pudo guardar el enlace.\n\n'+error.message);modalMsg.textContent='';return}
  cerrarModal(); await recalcular();
}

export function initModal(){
  document.getElementById('modal').addEventListener('click',e=>{if(e.target.id==='modal')cerrarModal()});
  document.getElementById('btnCerrarModal').addEventListener('click',cerrarModal);
  document.getElementById('btnQuitarEnlace').addEventListener('click',quitarEnlaceActual);
  document.getElementById('btnConfirmarMatch').addEventListener('click',confirmarMatch);
}
