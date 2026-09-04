import {supabase} from './supabaseClient.js';
import {formatoFecha,formatoMoneda,limpiarHtml} from './utils.js';

const RESULTADOS_POR_PAGINA = 40;
const MAX_CACHE = 30;

export function iniciarBuscadorConceptos({onSeleccionarFactura}){
  const input=document.getElementById('inputBuscarConcepto');
  const estado=document.getElementById('estadoBusqueda');
  const resultados=document.getElementById('resultadosBusqueda');
  let timer=null;
  let secuencia=0;
  let busquedaActual='';
  let paginaActual=1;
  let totalResultados=0;
  const cache=new Map();

  input.addEventListener('input',()=>{
    clearTimeout(timer);
    timer=setTimeout(()=>iniciarNuevaBusqueda(input.value),500);
  });

  input.addEventListener('keydown',(ev)=>{
    if(ev.key==='Enter'){
      clearTimeout(timer);
      iniciarNuevaBusqueda(input.value);
    }
  });

  function iniciarNuevaBusqueda(valor){
    const txt=valor.trim();
    busquedaActual=txt;
    paginaActual=1;
    consultarPagina(txt,1);
  }

  async function consultarPagina(valor,pagina){
    const txt=valor.trim();
    const claveTexto=normalizarTexto(txt);
    const claveCache=`${claveTexto}::${pagina}`;
    const miSecuencia=++secuencia;

    if(txt.length<3){
      totalResultados=0;
      resultados.innerHTML='';
      estado.textContent='Escribe mínimo 3 letras o números';
      return;
    }

    if(cache.has(claveCache)){
      const guardado=cache.get(claveCache);
      paginaActual=pagina;
      totalResultados=guardado.total;
      estado.textContent=`${totalResultados} resultado(s) · página ${paginaActual} · caché local`;
      pintarPagina(resultados,guardado.data,onSeleccionarFactura);
      return;
    }

    estado.textContent=`Buscando página ${pagina}...`;
    resultados.innerHTML='<div class="cargando">Consultando Supabase...</div>';

    // Paginación REAL: PostgreSQL devuelve únicamente 40 registros por llamada.
    const {data,error}=await supabase.rpc('buscar_facturas_por_concepto',{
      texto_busqueda:txt,
      pagina,
      limite:RESULTADOS_POR_PAGINA
    });

    // Si otra búsqueda terminó después, descartamos esta respuesta vieja.
    if(miSecuencia!==secuencia) return;

    if(error){
      console.error('Error RPC buscar_facturas_por_concepto:',error);
      estado.textContent='Error de Supabase al buscar. Revisa la consola.';
      resultados.innerHTML='<div class="sin-resultados">No fue posible consultar los artículos.</div>';
      return;
    }

    const normalizados=normalizarResultadosRpc(data || []);
    const total=normalizados.length
      ? Number(normalizados[0].total_resultados || 0)
      : 0;

    paginaActual=pagina;
    totalResultados=total;
    guardarCache(cache,claveCache,{data:normalizados,total});

    estado.textContent=total
      ? `${total} resultado(s) · mostrando ${rangoInicio(total,pagina)}-${rangoFin(total,pagina)}`
      : '0 resultados';

    pintarPagina(resultados,normalizados,onSeleccionarFactura);
  }

  function pintarPagina(contenedor,data,onSeleccionarFactura){
    if(!data.length){
      contenedor.innerHTML='<div class="sin-resultados">No se encontraron coincidencias.</div>';
      return;
    }

    const totalPaginas=Math.max(1,Math.ceil(totalResultados/RESULTADOS_POR_PAGINA));

    contenedor.innerHTML=`
      <div class="resultados-lista">
        ${data.map(x=>`<div class="resultado" data-id="${limpiarHtml(x.id)}">
          ${x.codigo ? `<span class="resultado-codigo">Código: ${limpiarHtml(x.codigo)}</span><br>` : ''}
          <strong>${limpiarHtml(x.descripcion || 'Sin descripción')}</strong><br>
          ${limpiarHtml(x.razon_social_emisor || '')}<br>
          ${limpiarHtml(x.serie || '')}${x.serie && x.folio ? '-' : ''}${limpiarHtml(x.folio || '')}<br>
          ${formatoFecha(x.fecha)} - ${formatoMoneda(x.total)}
        </div>`).join('')}
      </div>
      <div class="paginacion">
        <button type="button" class="btn-pagina" data-accion="anterior" ${paginaActual===1?'disabled':''}>← Anterior</button>
        <span>Página ${paginaActual} de ${totalPaginas} · ${totalResultados} resultados · 40 por página</span>
        <button type="button" class="btn-pagina" data-accion="siguiente" ${paginaActual>=totalPaginas?'disabled':''}>Siguiente →</button>
      </div>
    `;

    contenedor.querySelectorAll('.resultado').forEach(b=>{
      b.onclick=()=>onSeleccionarFactura(b.dataset.id);
    });

    contenedor.querySelector('[data-accion="anterior"]')?.addEventListener('click',()=>{
      if(paginaActual>1){
        consultarPagina(busquedaActual,paginaActual-1);
        contenedor.scrollIntoView({behavior:'smooth',block:'start'});
      }
    });

    contenedor.querySelector('[data-accion="siguiente"]')?.addEventListener('click',()=>{
      if(paginaActual<totalPaginas){
        consultarPagina(busquedaActual,paginaActual+1);
        contenedor.scrollIntoView({behavior:'smooth',block:'start'});
      }
    });
  }
}

function normalizarResultadosRpc(data){
  return data.map(x=>({
    ...x,
    codigo:x.noIdentificacion || x.no_identificacion || x.codigo || x.cod_articulo || '',
    descripcion:x.descripcion || x.concepto || ''
  }));
}

function guardarCache(cache,clave,data){
  if(cache.has(clave)) cache.delete(clave);
  cache.set(clave,data);
  if(cache.size>MAX_CACHE){
    cache.delete(cache.keys().next().value);
  }
}

function rangoInicio(total,pagina){
  if(!total) return 0;
  return ((pagina-1)*RESULTADOS_POR_PAGINA)+1;
}

function rangoFin(total,pagina){
  return Math.min(pagina*RESULTADOS_POR_PAGINA,total);
}

function normalizarTexto(valor){
  return String(valor ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}
