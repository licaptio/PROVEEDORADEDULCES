import {supabase} from './supabaseClient.js';
import {formatoFecha,formatoMoneda,limpiarHtml} from './utils.js';
export function iniciarBuscadorConceptos({onSeleccionarFactura}){
const i=document.getElementById('inputBuscarConcepto');
const e=document.getElementById('estadoBusqueda');
const r=document.getElementById('resultadosBusqueda');
let t=null;
i.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(async()=>{
const txt=i.value.trim();r.innerHTML='';
if(txt.length<3){e.textContent='Escribe mínimo 3 letras';return;}
e.textContent='Buscando...';
const {data,error}=await supabase.rpc('buscar_facturas_por_concepto',{texto_busqueda:txt});
if(error){e.textContent='Error';console.error(error);return;}
e.textContent=`${data.length} resultado(s)`;
r.innerHTML=data.map(x=>`<div class="resultado" data-id="${x.id}">
<strong>${limpiarHtml(x.descripcion)}</strong><br>
${limpiarHtml(x.razon_social_emisor)}<br>
${x.serie}-${x.folio}<br>
${formatoFecha(x.fecha)} - ${formatoMoneda(x.total)}
</div>`).join('');
r.querySelectorAll('.resultado').forEach(b=>b.onclick=()=>onSeleccionarFactura(b.dataset.id));
},350);});
}
