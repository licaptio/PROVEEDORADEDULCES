const sb = supabase.createClient(
  'https://cvpbtjlupswbyxenugpz.supabase.co',
  'sb_publishable_SQ7Q5LFJqlxVzwNTxcIyzQ_8F1bqyiX'
);

const $ = id => document.getElementById(id);
const fmt = new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:2});
const inputProveedor = $('proveedor');
const suggestions = $('sugerencias');
let timer = null;
let pagoActual = null;
let fotosPorUuid = new Map();

function n(v){
  if(v === null || v === undefined || v === '') return 0;
  if(typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const x = Number(String(v).replace(/[$,\s]/g,''));
  return Number.isFinite(x) ? x : 0;
}
function money(v){ return fmt.format(n(v)); }
function negMoney(v){ return n(v) > 0 ? '-' + money(v) : money(0); }
function esc(v){
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
function dateMx(v){
  if(!v) return '—';
  const raw = String(v);
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? raw : d.toLocaleDateString('es-MX');
}
function parseJson(v, fallback=[]){
  if(Array.isArray(v)) return v;
  if(v && typeof v === 'object') return v;
  if(typeof v !== 'string' || !v.trim()) return fallback;
  try{
    let x = JSON.parse(v);
    if(typeof x === 'string') x = JSON.parse(x);
    return x ?? fallback;
  }catch(e){ console.warn('JSON no válido',e); return fallback; }
}
function asArray(v){
  const x = parseJson(v, []);
  if(Array.isArray(x)) return x;
  if(x && Array.isArray(x.facturas)) return x.facturas;
  if(x && Array.isArray(x.items)) return x.items;
  return [];
}
function noteFrom(x){
  if(!x || typeof x !== 'object') return '';
  return String(x.nota ?? x.notas ?? x.comentario ?? x.comentarios ?? x.observacion ?? x.observaciones ?? '').trim();
}

function facturaCalc(f){
  const original = n(f.importe_original ?? f.total_factura ?? f.total ?? f.importe);
  const individual = n(f.ajuste_individual?.monto ?? f.descuento_individual ?? f.descuento_factura ?? f.descuento_monto);
  const global = n(f.ajuste_global_asignado ?? f.descuento_global_asignado);
  const explicitTotal = n(f.ajuste_total ?? f.total_ajuste ?? f.total_descuento);
  const descuento = explicitTotal > 0 ? explicitTotal : individual + global;
  const finalRaw = f.importe_final ?? f.importe_pagado ?? f.total_neto ?? f.neto;
  const final = finalRaw !== undefined && finalRaw !== null && finalRaw !== '' ? n(finalRaw) : original - descuento;
  const comentarios = [
    noteFrom(f.ajuste_individual),
    noteFrom(f),
    noteFrom(f.ajuste_global)
  ].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(' · ');
  return {original,individual,global,descuento,final,comentarios};
}

inputProveedor.addEventListener('input',()=>{
  clearTimeout(timer);
  const q = inputProveedor.value.trim();
  if(q.length < 2){ suggestions.style.display='none'; suggestions.innerHTML=''; return; }
  timer = setTimeout(()=>loadSuggestions(q),220);
});
inputProveedor.addEventListener('keydown',e=>{ if(e.key==='Enter'){ buscar(); suggestions.style.display='none'; }});
document.addEventListener('click',e=>{ if(!e.target.closest('.search-field')) suggestions.style.display='none'; });
$('btnBuscar').addEventListener('click',buscar);
$('btnPrint').addEventListener('click',()=>{
  if(!pagoActual) return;
  $('printStamp').textContent = 'Impreso: ' + new Date().toLocaleString('es-MX');
  window.print();
});

$('btnVolver').addEventListener('click',()=>{
  document.body.classList.remove('report-mode');
  $('reporte').classList.add('hidden');
  $('btnPrint').disabled=true;
  pagoActual=null;
  window.scrollTo({top:0,behavior:'smooth'});
});

$('btnCerrarFotos').addEventListener('click',cerrarFotos);
$('fotosModal').addEventListener('click',e=>{ if(e.target === $('fotosModal')) cerrarFotos(); });
document.addEventListener('keydown',e=>{ if(e.key === 'Escape' && !$('fotosModal').classList.contains('hidden')) cerrarFotos(); });

async function loadSuggestions(q){
  const {data,error} = await sb.from('pagos_proveedor').select('proveedor_nombre').ilike('proveedor_nombre',`%${q}%`).not('proveedor_nombre','is',null).order('proveedor_nombre',{ascending:true}).limit(80);
  if(error){ console.error(error); return; }
  const names=[...new Set((data||[]).map(x=>x.proveedor_nombre).filter(Boolean))].slice(0,25);
  suggestions.innerHTML = names.length ? names.map(x=>`<div class="suggestion" data-name="${esc(x)}">${esc(x)}</div>`).join('') : '<div class="suggestion">Sin resultados</div>';
  suggestions.style.display='block';
  suggestions.querySelectorAll('[data-name]').forEach(el=>el.addEventListener('click',()=>{ inputProveedor.value=el.dataset.name; suggestions.style.display='none'; buscar(); }));
}

async function buscar(){
  const proveedor=inputProveedor.value.trim();
  if(!proveedor){ alert('Escribe el nombre del proveedor'); return; }
  $('mensaje').textContent='Consultando pagos...';
  $('tbodyPagos').innerHTML='<tr><td colspan="7" class="empty">Cargando...</td></tr>';
  const {data,error}=await sb.from('pagos_proveedor')
    .select('id,fecha_pago,banco,proveedor_nombre,importe_pagado,total_facturas,total_ajustes,tipo_pago')
    .ilike('proveedor_nombre',`%${proveedor}%`).order('fecha_pago',{ascending:false}).limit(30);
  if(error){ $('mensaje').textContent='Error: '+error.message; $('tbodyPagos').innerHTML='<tr><td colspan="7" class="empty">No se pudo consultar.</td></tr>'; return; }
  const rows=data||[];
  $('resultadosMeta').textContent=`${rows.length} pago(s) más reciente(s) de ${proveedor}`;
  $('mensaje').textContent=rows.length ? 'Selecciona un pago para abrir su reporte completo.' : 'No se encontraron pagos.';
  $('totalListado').textContent=money(rows.reduce((a,x)=>a+n(x.importe_pagado),0));
  if(!rows.length){ $('tbodyPagos').innerHTML='<tr><td colspan="7" class="empty">Sin pagos para este proveedor.</td></tr>'; return; }
  $('tbodyPagos').innerHTML=rows.map(p=>`
    <tr>
      <td>${dateMx(p.fecha_pago)}</td><td>${esc(p.banco)}</td><td>${esc(p.proveedor_nombre)}</td><td>${esc(p.tipo_pago||'FACTURAS')}</td>
      <td class="num ok">${money(p.importe_pagado)}</td><td class="num neg">${negMoney(p.total_ajustes)}</td>
      <td><button class="btn-open" data-id="${esc(p.id)}">Ver reporte</button></td>
    </tr>`).join('');
  document.querySelectorAll('.btn-open').forEach(b=>b.addEventListener('click',()=>cargarPago(b.dataset.id)));
}

async function cargarPago(id){
  $('mensaje').textContent='Cargando detalle del pago...';
  const {data,error}=await sb.from('pagos_proveedor').select('*').eq('id',id).single();
  if(error){
    $('mensaje').textContent='Error al cargar el pago: '+error.message;
    return;
  }
  pagoActual=data;
  renderReport(data);
  $('reporte').classList.remove('hidden');
  document.body.classList.add('report-mode');
  $('btnPrint').disabled=false;
  window.scrollTo({top:0,behavior:'smooth'});
  cargarFotosDeuda(asArray(data.facturas_info));
}

function renderReport(p){
  const facturas=asArray(p.facturas_info);
  const ajustes=asArray(p.ajustes);
  const calcs=facturas.map(f=>({f,c:facturaCalc(f||{})}));

  const dbOriginal=n(p.total_facturas || p.subtotal_original);
  const dbAjustes=n(p.total_ajustes);
  const dbPagado=n(p.importe_pagado);
  const calcOriginal=calcs.reduce((a,x)=>a+x.c.original,0);
  const calcDesc=calcs.reduce((a,x)=>a+x.c.descuento,0);
  const calcFinal=calcs.reduce((a,x)=>a+x.c.final,0);
  const original=dbOriginal || calcOriginal;
  const descuento=dbAjustes || calcDesc;
  const pagado=dbPagado || calcFinal || (original-descuento);

  $('rId').textContent=p.id||'—'; $('rFecha').textContent=dateMx(p.fecha_pago); $('rBanco').textContent=p.banco||'—'; $('rTipo').textContent=p.tipo_pago||'—';
  $('rProveedor').textContent=p.proveedor_nombre||'—'; $('rRfc').textContent=p.rfc_emisor||'—';
  $('rOriginal').textContent=money(original); $('rAjustes').textContent=negMoney(descuento); $('rPagado').textContent=money(pagado);
  $('rNotas').textContent=(p.notas||p.concepto_manual||'').trim() || 'Sin notas.';

  const esperado=Number((original-descuento).toFixed(2));
  const diferencia=Number((esperado-pagado).toFixed(2));
  $('rCuadre').textContent=`${money(original)} - ${money(descuento)} = ${money(esperado)} · Pagado ${money(pagado)}`;
  $('rCuadreEstado').textContent=Math.abs(diferencia)<=0.01?'CUADRA':'DIFERENCIA '+money(Math.abs(diferencia));
  $('cuadreBox').classList.toggle('bad',Math.abs(diferencia)>0.01);

  $('facturasCount').textContent=`${facturas.length} factura(s)`;
  let sOrig=0,sInd=0,sGlob=0,sDesc=0,sFinal=0;
  if(!facturas.length){
    $('facturasBody').innerHTML='<tr><td colspan="11" class="empty">Este pago no contiene detalle de facturas.</td></tr>';
  }else{
    $('facturasBody').innerHTML=calcs.map(({f,c})=>{
      sOrig+=c.original; sInd+=c.individual; sGlob+=c.global; sDesc+=c.descuento; sFinal+=c.final;
      return `<tr>
        <td>${dateMx(f.fecha??f.fecha_factura)}</td><td>${esc(f.serie||'—')}</td><td>${esc(f.folio||'—')}</td>
        <td class="uuid">${esc(f.uuid_cfdi||f.uuid||f.UUID||f.udi||'—')}</td>
        <td class="num">${money(c.original)}</td><td class="num ${c.individual?'neg':''}">${c.individual?negMoney(c.individual):money(0)}</td>
        <td class="num ${c.global?'neg':''}">${c.global?negMoney(c.global):money(0)}</td><td class="num ${c.descuento?'neg':''}">${c.descuento?negMoney(c.descuento):money(0)}</td>
        <td class="num ok">${money(c.final)}</td><td class="comment ${c.comentarios?'':'empty-comment'}">${esc(c.comentarios||'Sin comentarios')}</td>
        <td class="screen-only photo-cell" data-photo-uuid="${esc(String(f.uuid_cfdi||f.uuid||f.UUID||f.udi||'').toUpperCase())}"><span class="photo-checking">Consultando…</span></td>
      </tr>`;
    }).join('');
  }
  $('tfOriginal').textContent=money(sOrig||original); $('tfIndividual').textContent=negMoney(sInd); $('tfGlobal').textContent=negMoney(sGlob); $('tfDescuento').textContent=negMoney(sDesc||descuento); $('tfFinal').textContent=money(sFinal||pagado);

  renderGlobal(ajustes,calcs,p,descuento);
  renderFiscal(p);
}

function renderGlobal(ajustes,calcs,p,totalDescuento){
  const factGlobal=calcs.reduce((a,x)=>a+x.c.global,0);
  const globals=ajustes.filter(a=>String(a.tipo||'').toUpperCase().includes('GLOBAL'));
  const globalMontoFromArray=globals.reduce((a,x)=>a+n(x.monto_total??x.monto??x.importe??x.ajuste_global),0);
  const globalMonto=factGlobal || globalMontoFromArray;
  const comments=globals.map(noteFrom).filter(Boolean);
  if(globalMonto<=0 && !comments.length){ $('globalSection').classList.add('hidden'); return; }
  $('globalSection').classList.remove('hidden');
  $('globalDetail').innerHTML=`
    <div class="label">Monto global</div><div><strong class="neg">${negMoney(globalMonto)}</strong></div>
    <div class="label">Aplicación</div><div>${factGlobal>0?'Distribuido entre las facturas según asignación guardada.':'Ajuste global registrado en el pago.'}</div>
    <div class="label">Comentarios</div><div>${esc(comments.join(' · ')||'Sin comentarios')}</div>
    <div class="label">Total ajustes pago</div><div><strong>${money(totalDescuento)}</strong></div>`;
}

function renderFiscal(p){
  const rows=[
    ['Subtotal',p.subtotal_original,p.subtotal_ajustado,p.subtotal_pagado],
    ['IVA',p.iva_original,p.iva_ajustado,p.iva_pagado],
    ['IEPS',p.ieps_original,p.ieps_ajustado,p.ieps_pagado],
    ['Retenciones',p.retenciones_originales,p.retenciones_ajustadas,p.retenciones_pagadas]
  ];
  $('fiscalBody').innerHTML=rows.map(r=>`<tr><td>${r[0]}</td><td class="num">${money(r[1])}</td><td class="num neg">${n(r[2])?negMoney(r[2]):money(0)}</td><td class="num">${money(r[3])}</td></tr>`).join('');
}


async function cargarFotosDeuda(facturas){
  fotosPorUuid = new Map();
  const uuids=[...new Set((facturas||[]).map(f=>String(f?.uuid_cfdi||f?.uuid||f?.UUID||f?.udi||'').trim()).filter(Boolean))];
  if(!uuids.length){ actualizarCeldasFotos(); return; }

  // deuda_limpia_pdd guarda las fotos por UUID del CFDI. Se consulta en un solo lote.
  const {data,error}=await sb
    .from('deuda_limpia_pdd')
    .select('uuid_cfdi,fotos')
    .in('uuid_cfdi',uuids);

  if(error){
    console.error('Error consultando fotos en deuda_limpia_pdd:',error);
    document.querySelectorAll('.photo-cell').forEach(td=>td.innerHTML='<span class="photo-error">Error al consultar</span>');
    return;
  }

  (data||[]).forEach(row=>{
    const key=String(row.uuid_cfdi||'').toUpperCase();
    const fotos=Array.isArray(row.fotos) ? row.fotos.filter(Boolean) : [];
    fotosPorUuid.set(key,fotos);
  });
  actualizarCeldasFotos();
}

function actualizarCeldasFotos(){
  document.querySelectorAll('.photo-cell').forEach(td=>{
    const uuid=String(td.dataset.photoUuid||'').toUpperCase();
    const fotos=fotosPorUuid.get(uuid)||[];
    if(!uuid){ td.innerHTML='<span class="photo-none">Sin UUID</span>'; return; }
    if(!fotos.length){ td.innerHTML='<span class="photo-none">Sin fotos</span>'; return; }
    td.innerHTML=`<button type="button" class="btn-photo" data-open-photos="${esc(uuid)}">📷 Ver ${fotos.length} foto${fotos.length===1?'':'s'}</button>`;
  });
  document.querySelectorAll('[data-open-photos]').forEach(btn=>btn.addEventListener('click',()=>abrirFotos(btn.dataset.openPhotos)));
}

function abrirFotos(uuid){
  const fotos=fotosPorUuid.get(String(uuid||'').toUpperCase())||[];
  $('fotosTitulo').textContent='Fotos de la factura';
  $('fotosMeta').textContent=`UUID: ${uuid} · ${fotos.length} foto(s)`;
  $('fotosGaleria').innerHTML=fotos.length ? fotos.map((src,i)=>{
    const u=String(src||'').trim();
    const safe=esc(u);
    return `<figure class="photo-item">
      <a href="${safe}" target="_blank" rel="noopener noreferrer" title="Abrir foto original">
        <img src="${safe}" alt="Foto ${i+1} del CFDI" loading="lazy" onerror="this.closest('figure').classList.add('photo-load-error')">
      </a>
      <figcaption>Foto ${i+1} · <a href="${safe}" target="_blank" rel="noopener noreferrer">Abrir original</a></figcaption>
      <div class="photo-fallback">No se pudo previsualizar. <a href="${safe}" target="_blank" rel="noopener noreferrer">Abrir archivo</a></div>
    </figure>`;
  }).join('') : '<div class="empty">No hay fotos registradas para este UUID.</div>';
  $('fotosModal').classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function cerrarFotos(){
  $('fotosModal').classList.add('hidden');
  document.body.classList.remove('modal-open');
  $('fotosGaleria').innerHTML='';
}

const urlId=new URLSearchParams(location.search).get('id');
if(urlId) cargarPago(urlId);
