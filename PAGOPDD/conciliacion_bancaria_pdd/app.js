import { supabaseUrl, supabaseAnonKey } from "./config.js";

const sb = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
const PAGE_SIZE = 1000;

const meses = [
  ["01","Enero"],["02","Febrero"],["03","Marzo"],["04","Abril"],
  ["05","Mayo"],["06","Junio"],["07","Julio"],["08","Agosto"],
  ["09","Septiembre"],["10","Octubre"],["11","Noviembre"],["12","Diciembre"]
];

const state = {
  conciliacion: [],
  conciliacionFiltrada: [],
  resumen: [],
  resumenFiltrado: [],
  seleccionados: new Set()
};

const $ = id => document.getElementById(id);
const num = v => Number(v || 0);
const money = v => num(v).toLocaleString("es-MX",{style:"currency",currency:"MXN"});
const fechaMx = v => {
  if(!v) return "—";
  const [y,m,d] = String(v).slice(0,10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : String(v);
};
const esc = v => String(v ?? "—")
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;").replace(/'/g,"&#039;");

function parseArray(value){
  if(Array.isArray(value)) return value;
  if(!value) return [];
  try{
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  }catch{return []}
}

function cantidadFacturas(pago){
  return parseArray(pago.facturas_info).length;
}

function periodoDesdeControles(prefix){
  const mes = $(prefix === "c" ? "mesConciliacion" : "mesResumen").value;
  const anio = $(prefix === "c" ? "anioConciliacion" : "anioResumen").value;
  return `${anio}-${mes}-01`;
}

function rangoMes(anio, mes){
  const start = `${anio}-${mes}-01`;
  const next = new Date(Number(anio), Number(mes), 1);
  const end = `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,"0")}-01`;
  return {start,end};
}

function initPeriodos(){
  const hoy = new Date();
  ["mesConciliacion","mesResumen"].forEach(id=>{
    $(id).innerHTML = meses.map(([v,n])=>`<option value="${v}" ${Number(v)===hoy.getMonth()+1?"selected":""}>${n}</option>`).join("");
  });
  const years = [];
  for(let y=hoy.getFullYear()+1;y>=2023;y--) years.push(y);
  ["anioConciliacion","anioResumen"].forEach(id=>{
    $(id).innerHTML = years.map(y=>`<option value="${y}" ${y===hoy.getFullYear()?"selected":""}>${y}</option>`).join("");
  });
}

async function fetchAll(buildQuery){
  let all = [];
  for(let from=0;;from+=PAGE_SIZE){
    const {data,error} = await buildQuery(from, from+PAGE_SIZE-1);
    if(error) throw error;
    all = all.concat(data || []);
    if(!data || data.length < PAGE_SIZE) break;
  }
  return all;
}

function selectBase(){
  return `id,rfc_emisor,proveedor_nombre,banco,fecha_pago,importe_pagado,total_facturas,total_ajustes,
    facturas_info,notas,tipo_pago,subtotal_original,subtotal_pagado,subtotal_ajustado,
    iva_original,iva_pagado,iva_ajustado,ieps_original,ieps_pagado,ieps_ajustado,
    retenciones_originales,retenciones_pagadas,retenciones_ajustadas,
    impuestos_detalle,conciliado,periodo_conciliacion`;
}

async function cargarBancos(){
  try{
    const pagos = await fetchAll((from,to)=>
      sb.from("pagos_proveedor").select("banco").not("banco","is",null).order("banco").range(from,to)
    );
    const bancos = [...new Set(pagos.map(x=>String(x.banco||"").trim()).filter(Boolean))];
    ["bancoConciliacion","bancoResumen"].forEach(id=>{
      const actual = $(id).value;
      $(id).innerHTML = `<option value="">Todos</option>`+
        bancos.map(b=>`<option value="${esc(b)}">${esc(b)}</option>`).join("");
      if(bancos.includes(actual)) $(id).value = actual;
    });
  }catch(e){console.error("No se pudieron cargar bancos",e)}
}

function setMessage(id,text,error=false){
  const el=$(id);
  if(!text){el.classList.add("hidden");el.textContent="";return}
  el.textContent=text;el.classList.remove("hidden");el.classList.toggle("error",error);
}

async function consultarConciliacion(){
  setMessage("mensajeConciliacion","Consultando pagos...");
  state.seleccionados.clear();
  actualizarSeleccion();

  const anio=$("anioConciliacion").value;
  const mes=$("mesConciliacion").value;
  const banco=$("bancoConciliacion").value;
  const estado=$("estadoConciliacion").value;
  const {start,end}=rangoMes(anio,mes);
  const periodo=`${anio}-${mes}-01`;

  try{
    state.conciliacion = await fetchAll((from,to)=>{
      let q=sb.from("pagos_proveedor").select(selectBase())
        .gte("fecha_pago",start).lt("fecha_pago",end)
        .order("fecha_pago",{ascending:true}).order("proveedor_nombre",{ascending:true});
      if(banco) q=q.eq("banco",banco);
      if(estado==="pendientes") q=q.eq("conciliado",false);
      if(estado==="conciliados") q=q.eq("conciliado",true).eq("periodo_conciliacion",periodo);
      return q.range(from,to);
    });
    filtrarConciliacion();
    setMessage("mensajeConciliacion","");
  }catch(e){
    console.error(e);
    setMessage("mensajeConciliacion",`Error: ${e.message}`,true);
  }
}

function filtrarConciliacion(){
  const q=$("buscarConciliacion").value.trim().toLowerCase();
  state.conciliacionFiltrada=state.conciliacion.filter(p=>{
    if(!q) return true;
    return [p.proveedor_nombre,p.rfc_emisor,p.banco,p.importe_pagado,p.fecha_pago]
      .some(v=>String(v??"").toLowerCase().includes(q));
  });
  renderConciliacion();
}

function renderConciliacion(){
  const tbody=$("tbodyConciliacion");
  const rows=state.conciliacionFiltrada;
  $("resultadoInfo").textContent=` · ${rows.length} pagos visibles`;
  if(!rows.length){
    tbody.innerHTML=`<tr><td colspan="11" class="empty">No hay pagos con esos filtros.</td></tr>`;
    return;
  }
  tbody.innerHTML=rows.map(p=>{
    const checked=state.seleccionados.has(p.id)?"checked":"";
    const conc=Boolean(p.conciliado);
    return `<tr>
      <td class="check"><input class="row-check" type="checkbox" data-id="${p.id}" ${checked}></td>
      <td>${fechaMx(p.fecha_pago)}</td>
      <td>${esc(p.banco)}</td>
      <td><strong>${esc(p.proveedor_nombre)}</strong></td>
      <td>${esc(p.rfc_emisor)}</td>
      <td class="num">${money(p.importe_pagado)}</td>
      <td class="num">${money(p.subtotal_pagado)}</td>
      <td class="num">${money(p.iva_pagado)}</td>
      <td class="num">${money(p.ieps_pagado)}</td>
      <td class="num">${cantidadFacturas(p)}</td>
      <td><span class="badge ${conc?"ok":"pending"}">${conc?"CONCILIADO":"PENDIENTE"}</span></td>
    </tr>`;
  }).join("");
  document.querySelectorAll(".row-check").forEach(ch=>{
    ch.addEventListener("change",()=>{
      ch.checked?state.seleccionados.add(ch.dataset.id):state.seleccionados.delete(ch.dataset.id);
      actualizarSeleccion();
    });
  });
}

function actualizarSeleccion(){
  const n=state.seleccionados.size;
  $("seleccionInfo").textContent=`${n} seleccionados`;
  $("btnMarcarConciliados").disabled=n===0;
  $("btnQuitarConciliacion").disabled=n===0;
  const visibles=state.conciliacionFiltrada.map(x=>x.id);
  $("seleccionarTodos").checked=visibles.length>0 && visibles.every(id=>state.seleccionados.has(id));
  $("seleccionarTodos").indeterminate=visibles.some(id=>state.seleccionados.has(id)) && !visibles.every(id=>state.seleccionados.has(id));
}

async function actualizarConciliacion(marcar){
  const ids=[...state.seleccionados];
  if(!ids.length) return;
  const periodo=periodoDesdeControles("c");
  const texto=marcar
    ? `¿Marcar ${ids.length} pagos como conciliados en ${periodo.slice(0,7)}?`
    : `¿Quitar la conciliación de ${ids.length} pagos?`;
  if(!confirm(texto)) return;

  setMessage("mensajeConciliacion","Guardando cambios...");
  try{
    const payload=marcar
      ? {conciliado:true,periodo_conciliacion:periodo}
      : {conciliado:false,periodo_conciliacion:null};

    const chunkSize=100;
    let actualizados=0;
    for(let i=0;i<ids.length;i+=chunkSize){
      const chunk=ids.slice(i,i+chunkSize);
      const {data,error}=await sb.from("pagos_proveedor")
        .update(payload).in("id",chunk).select("id");
      if(error) throw error;
      actualizados += (data||[]).length;
    }
    if(actualizados!==ids.length){
      throw new Error(`Supabase permitió actualizar ${actualizados} de ${ids.length}. Revisa la política RLS de UPDATE.`);
    }
    setMessage("mensajeConciliacion",`${actualizados} pagos actualizados correctamente.`);
    await consultarConciliacion();
  }catch(e){
    console.error(e);
    setMessage("mensajeConciliacion",`Error: ${e.message}`,true);
  }
}

async function consultarResumen(){
  setMessage("mensajeResumen","Consultando pagos conciliados...");
  const anio=$("anioResumen").value;
  const mes=$("mesResumen").value;
  const banco=$("bancoResumen").value;
  const periodo=`${anio}-${mes}-01`;

  try{
    state.resumen=await fetchAll((from,to)=>{
      let q=sb.from("pagos_proveedor").select(selectBase())
        .eq("conciliado",true).eq("periodo_conciliacion",periodo)
        .order("fecha_pago",{ascending:true}).order("proveedor_nombre",{ascending:true});
      if(banco) q=q.eq("banco",banco);
      return q.range(from,to);
    });
    filtrarResumen();
    $("resumenPeriodo").textContent=`Periodo ${meses.find(x=>x[0]===mes)[1]} ${anio}${banco?` · ${banco}`:" · Todos los bancos"}`;
    $("btnExcel").disabled=state.resumen.length===0;
    setMessage("mensajeResumen","");
  }catch(e){
    console.error(e);
    setMessage("mensajeResumen",`Error: ${e.message}`,true);
  }
}

function filtrarResumen(){
  const q=$("buscarResumen").value.trim().toLowerCase();
  state.resumenFiltrado=state.resumen.filter(p=>{
    if(!q) return true;
    return [p.proveedor_nombre,p.rfc_emisor,p.banco,p.importe_pagado,p.fecha_pago]
      .some(v=>String(v??"").toLowerCase().includes(q));
  });
  renderResumen();
}

function sumar(rows,campo){return rows.reduce((s,x)=>s+num(x[campo]),0)}
function totals(rows){
  return {
    importe:sumar(rows,"importe_pagado"),
    subtotal:sumar(rows,"subtotal_pagado"),
    iva:sumar(rows,"iva_pagado"),
    ieps:sumar(rows,"ieps_pagado"),
    ret:sumar(rows,"retenciones_pagadas"),
    facturas:rows.reduce((s,x)=>s+cantidadFacturas(x),0)
  }
}

function renderResumen(){
  const rows=state.resumenFiltrado;
  const t=totals(rows);
  $("mTotal").textContent=money(t.importe);
  $("mPagos").textContent=rows.length.toLocaleString("es-MX");
  $("mSubtotal").textContent=money(t.subtotal);
  $("mIva").textContent=money(t.iva);
  $("mIeps").textContent=money(t.ieps);
  $("mRetenciones").textContent=money(t.ret);
  $("fImporte").textContent=money(t.importe);
  $("fSubtotal").textContent=money(t.subtotal);
  $("fIva").textContent=money(t.iva);
  $("fIeps").textContent=money(t.ieps);
  $("fRet").textContent=money(t.ret);
  $("fFacturas").textContent=t.facturas.toLocaleString("es-MX");

  const tbody=$("tbodyResumen");
  if(!rows.length){
    tbody.innerHTML=`<tr><td colspan="11" class="empty">No hay pagos conciliados con esos filtros.</td></tr>`;
    return;
  }
  tbody.innerHTML=rows.map(p=>`<tr>
    <td>${fechaMx(p.fecha_pago)}</td>
    <td>${esc(p.banco)}</td>
    <td><strong>${esc(p.proveedor_nombre)}</strong></td>
    <td>${esc(p.rfc_emisor)}</td>
    <td class="num">${money(p.importe_pagado)}</td>
    <td class="num">${money(p.subtotal_pagado)}</td>
    <td class="num">${money(p.iva_pagado)}</td>
    <td class="num">${money(p.ieps_pagado)}</td>
    <td class="num">${money(p.retenciones_pagadas)}</td>
    <td class="num">${cantidadFacturas(p)}</td>
    <td><button class="link-btn detalle-btn" data-id="${p.id}">Ver facturas</button></td>
  </tr>`).join("");
  document.querySelectorAll(".detalle-btn").forEach(btn=>btn.addEventListener("click",()=>abrirDetalle(btn.dataset.id)));
}

function getImportesFactura(f){
  const original=num(f?.importe_original ?? f?.total_factura ?? f?.importe ?? f?.total);
  let descuento=0;
  if(f?.descuento && typeof f.descuento==="object") descuento=num(f.descuento.monto);
  else descuento=num(f?.descuento_monto ?? f?.descuento_factura);
  const finalRaw=f?.importe_final ?? f?.total_neto ?? f?.neto;
  const final=finalRaw===undefined||finalRaw===null||finalRaw==="" ? original-descuento : num(finalRaw);
  return {original,descuento,final};
}

function abrirDetalle(id){
  const p=state.resumen.find(x=>x.id===id);
  if(!p) return;
  $("modalProveedor").textContent=p.proveedor_nombre||"Detalle del pago";
  $("modalMeta").textContent=`${fechaMx(p.fecha_pago)} · ${p.banco||"Sin banco"} · ${p.rfc_emisor||"Sin RFC"}`;
  $("modalTotales").innerHTML=`
    <div><span>Importe pagado</span><strong>${money(p.importe_pagado)}</strong></div>
    <div><span>Subtotal</span><strong>${money(p.subtotal_pagado)}</strong></div>
    <div><span>IVA</span><strong>${money(p.iva_pagado)}</strong></div>
    <div><span>IEPS</span><strong>${money(p.ieps_pagado)}</strong></div>
    <div><span>Retenciones</span><strong>${money(p.retenciones_pagadas)}</strong></div>`;
  const fs=parseArray(p.facturas_info);
  $("tbodyFacturas").innerHTML=fs.length?fs.map(f=>{
    const imp=getImportesFactura(f);
    return `<tr>
      <td>${fechaMx(f.fecha)}</td>
      <td>${esc(f.serie)}</td>
      <td>${esc(f.folio)}</td>
      <td class="uuid">${esc(f.uuid_cfdi||f.uuid||f.udi)}</td>
      <td class="num">${money(imp.original)}</td>
      <td class="num">${money(imp.descuento)}</td>
      <td class="num">${money(imp.final)}</td>
    </tr>`;
  }).join(""):`<tr><td colspan="7" class="empty">Este pago no tiene facturas_info.</td></tr>`;
  $("detalleModal").showModal();
}

function exportarExcel(){
  const rows=state.resumenFiltrado;
  if(!rows.length) return;
  const anio=$("anioResumen").value, mes=$("mesResumen").value;
  const banco=$("bancoResumen").value||"TODOS";
  const t=totals(rows);

  const resumen=[
    ["CONCILIACIÓN BANCARIA PROVSOFT"],
    ["Periodo",`${meses.find(x=>x[0]===mes)[1]} ${anio}`],
    ["Banco",banco],
    [],
    ["Concepto","Importe"],
    ["Total conciliado",t.importe],
    ["Cantidad de pagos",rows.length],
    ["Subtotal pagado",t.subtotal],
    ["IVA acreditable",t.iva],
    ["IEPS acreditable",t.ieps],
    ["Retenciones",t.ret]
  ];

  const detalle=rows.map(p=>({
    "Fecha":p.fecha_pago,
    "Banco":p.banco,
    "Proveedor":p.proveedor_nombre,
    "RFC":p.rfc_emisor,
    "Importe pagado":num(p.importe_pagado),
    "Subtotal pagado":num(p.subtotal_pagado),
    "IVA pagado":num(p.iva_pagado),
    "IEPS pagado":num(p.ieps_pagado),
    "Retenciones pagadas":num(p.retenciones_pagadas),
    "Cantidad facturas":cantidadFacturas(p),
    "ID pago":p.id
  }));

  const facturas=[];
  rows.forEach(p=>parseArray(p.facturas_info).forEach(f=>{
    const imp=getImportesFactura(f);
    facturas.push({
      "ID pago":p.id,
      "Fecha pago":p.fecha_pago,
      "Banco":p.banco,
      "Proveedor":p.proveedor_nombre,
      "RFC":p.rfc_emisor,
      "UUID":f.uuid_cfdi||f.uuid||f.udi||"",
      "Serie":f.serie||"",
      "Folio":f.folio||"",
      "Fecha factura":f.fecha||"",
      "Importe original":imp.original,
      "Descuento":imp.descuento,
      "Importe final":imp.final
    });
  }));

  const wb=XLSX.utils.book_new();
  const ws1=XLSX.utils.aoa_to_sheet(resumen);
  ws1["!cols"]=[{wch:28},{wch:22}];
  const ws2=XLSX.utils.json_to_sheet(detalle);
  ws2["!cols"]=[{wch:12},{wch:18},{wch:42},{wch:16},{wch:16},{wch:16},{wch:14},{wch:14},{wch:18},{wch:15},{wch:38}];
  XLSX.utils.book_append_sheet(wb,ws1,"Resumen");
  XLSX.utils.book_append_sheet(wb,ws2,"Pagos conciliados");
  if(facturas.length){
    const ws3=XLSX.utils.json_to_sheet(facturas);
    ws3["!cols"]=[{wch:38},{wch:12},{wch:18},{wch:42},{wch:16},{wch:38},{wch:10},{wch:12},{wch:12},{wch:16},{wch:14},{wch:16}];
    XLSX.utils.book_append_sheet(wb,ws3,"Facturas");
  }
  XLSX.writeFile(wb,`conciliacion_${anio}_${mes}_${banco.replace(/\W+/g,"_")}.xlsx`);
}

function cambiarVista(view){
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x.dataset.view===view));
  document.querySelectorAll(".view").forEach(x=>x.classList.toggle("active",x.id===`view-${view}`));
  if(view==="resumen" && !state.resumen.length) consultarResumen();
}

function bind(){
  document.querySelectorAll(".tab").forEach(x=>x.addEventListener("click",()=>cambiarVista(x.dataset.view)));
  $("btnConsultarConciliacion").addEventListener("click",consultarConciliacion);
  $("buscarConciliacion").addEventListener("input",filtrarConciliacion);
  $("btnMarcarConciliados").addEventListener("click",()=>actualizarConciliacion(true));
  $("btnQuitarConciliacion").addEventListener("click",()=>actualizarConciliacion(false));
  $("seleccionarTodos").addEventListener("change",e=>{
    state.conciliacionFiltrada.forEach(p=>e.target.checked?state.seleccionados.add(p.id):state.seleccionados.delete(p.id));
    renderConciliacion();actualizarSeleccion();
  });
  $("btnConsultarResumen").addEventListener("click",consultarResumen);
  $("buscarResumen").addEventListener("input",filtrarResumen);
  $("btnExcel").addEventListener("click",exportarExcel);
  $("cerrarModal").addEventListener("click",()=>$("detalleModal").close());
  $("btnRecargar").addEventListener("click",async()=>{await cargarBancos(); await consultarConciliacion();});
}

async function init(){
  initPeriodos();bind();
  if(supabaseUrl.includes("PEGA_AQUI") || supabaseAnonKey.includes("PEGA_AQUI")){
    setMessage("mensajeConciliacion","Abre config.js y coloca tu SUPABASE_URL y SUPABASE_ANON_KEY.",true);
    return;
  }
  await cargarBancos();
  await consultarConciliacion();
}
init();
