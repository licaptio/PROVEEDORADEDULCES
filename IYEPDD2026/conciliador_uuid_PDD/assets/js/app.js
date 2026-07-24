import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { supabaseUrl, supabaseAnonKey } from "./config.js";

const db = createClient(supabaseUrl, supabaseAnonKey);

const state = {
  metadata: [],
  ingresos: [],
  coinciden: [],
  faltan_ingresos: [],
  faltan_metadata: [],
  duplicados: [],
  view: "faltan_ingresos",
  query: ""
};

const $ = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const uuid = value => String(value || "").trim().toUpperCase();
const number = value => Number(value || 0).toLocaleString("es-MX");
const money = value => Number(value || 0).toLocaleString("es-MX", {style:"currency", currency:"MXN"});

function initExercise(){
  const now = new Date();
  const year = now.getFullYear();
  for(let y = year + 1; y >= 2020; y--){
    const option = document.createElement("option");
    option.value = String(y);
    option.textContent = String(y);
    $("anio").appendChild(option);
  }
  $("anio").value = String(year);
}

function progress(percent, title, detail){
  $("progressBar").style.width = `${percent}%`;
  $("processPercent").textContent = `${percent}%`;
  $("processTitle").textContent = title;
  $("bitacora").textContent = detail;
}

function rangeYear(year){
  const y = Number(year);
  return {
    start: `${y}-01-01T00:00:00-06:00`,
    end: `${y + 1}-01-01T00:00:00-06:00`
  };
}

async function fetchPaged(factory, pageSize = 1000){
  let from = 0;
  const all = [];
  while(true){
    const {data, error} = await factory().range(from, from + pageSize - 1);
    if(error) throw error;
    const rows = data || [];
    all.push(...rows);
    if(rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function loadMetadata(year){
  const columns = "id,uuid_cfdi,rfc_receptor,nombre_receptor,fecha_emision,fecha_cancelacion,monto,estatus,efecto_comprobante,periodo_anio,periodo_mes";
  const all = [];

  // La consulta anual directa puede provocar timeout en Supabase.
  // Se consulta mes por mes y al final se integra todo el ejercicio.
  for(let month = 1; month <= 12; month++){
    progress(
      20 + Math.round((month / 12) * 30),
      "Consultando metadata SAT",
      `Leyendo metadata del ejercicio ${year}: mes ${month} de 12...`
    );

    const rows = await fetchPaged(() => db.from("metadata_ingresos")
      .select(columns)
      .eq("periodo_anio", Number(year))
      .eq("periodo_mes", month)
      .eq("efecto_comprobante", "I")
      .order("id", {ascending:true}));

    all.push(...rows);
  }

  all.sort((a, b) => {
    const fa = new Date(a.fecha_emision).getTime() || 0;
    const fb = new Date(b.fecha_emision).getTime() || 0;
    if(fa !== fb) return fa - fb;
    return Number(a.id || 0) - Number(b.id || 0);
  });

  return all;
}

async function loadIngresos(year){
  const columns = "id,uuid_cfdi,fecha,periodo_mes,periodo_anio,tipo_factura,rfc_receptor,razon_social_receptor,folio,serie,subtotal,total,metodo_pago,total_iva,total_ieps";
  const collected = [];

  for(let month = 1; month <= 12; month++){
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? Number(year) + 1 : Number(year);
    const start = `${year}-${String(month).padStart(2, "0")}-01T00:00:00-06:00`;
    const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00-06:00`;

    progress(
      52 + Math.round((month / 12) * 25),
      "Consultando ingresos PROVSOFT",
      `Leyendo ingresos del ejercicio ${year}: mes ${month} de 12...`
    );

    const [globalesMes, ingresosFechaMes] = await Promise.all([
      fetchPaged(() => db.from("ingresos_pdd").select(columns)
        .eq("tipo_factura", "GLOBAL")
        .eq("periodo_anio", String(year))
        .eq("periodo_mes", String(month).padStart(2, "0"))
        .order("id", {ascending:true})),
      fetchPaged(() => db.from("ingresos_pdd").select(columns)
        .gte("fecha", start)
        .lt("fecha", end)
        .order("id", {ascending:true}))
    ]);

    collected.push(...globalesMes, ...ingresosFechaMes);
  }

  const unique = new Map();
  collected.forEach(row => {
    if(!uuid(row.uuid_cfdi)) return;
    const key = String(row.id ?? `${uuid(row.uuid_cfdi)}|${row.fecha ?? ""}|${row.total ?? ""}`);
    if(!unique.has(key)) unique.set(key, row);
  });

  const rows = [...unique.values()];
  rows.sort((a, b) => {
    const fa = new Date(a.fecha).getTime() || 0;
    const fb = new Date(b.fecha).getTime() || 0;
    if(fa !== fb) return fa - fb;
    return Number(a.id || 0) - Number(b.id || 0);
  });

  return rows;
}

function groupByUuid(rows){
  const map = new Map();
  rows.forEach(row => {
    const key = uuid(row.uuid_cfdi);
    if(!key) return;
    if(!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  });
  return map;
}

function compare(){
  const metaMap = groupByUuid(state.metadata);
  const ingMap = groupByUuid(state.ingresos);
  const all = new Set([...metaMap.keys(), ...ingMap.keys()]);

  state.coinciden = [];
  state.faltan_ingresos = [];
  state.faltan_metadata = [];
  state.duplicados = [];

  all.forEach(key => {
    const metaRows = metaMap.get(key) || [];
    const ingRows = ingMap.get(key) || [];
    if(metaRows.length && ingRows.length){
      state.coinciden.push({uuid_cfdi:key, metadata:metaRows[0], ingreso:ingRows[0]});
    }else if(metaRows.length){
      metaRows.forEach(row => state.faltan_ingresos.push({...row, uuid_cfdi:key}));
    }else{
      ingRows.forEach(row => state.faltan_metadata.push({...row, uuid_cfdi:key}));
    }
    if(metaRows.length > 1){
      state.duplicados.push({uuid_cfdi:key, tabla:"metadata_ingresos", cantidad:metaRows.length, detalle:metaRows});
    }
    if(ingRows.length > 1){
      state.duplicados.push({uuid_cfdi:key, tabla:"ingresos_pdd", cantidad:ingRows.length, detalle:ingRows});
    }
  });
}

function updateCounts(){
  $("cCoinciden").textContent = number(state.coinciden.length);
  $("cFaltanIngresos").textContent = number(state.faltan_ingresos.length);
  $("cFaltanMetadata").textContent = number(state.faltan_metadata.length);
  $("cDuplicados").textContent = number(state.duplicados.length);
}

const views = {
  faltan_ingresos:{title:"UUID que existen en metadata y faltan en ingresos", help:"Estos CFDI deben incorporarse o revisarse en la tabla ingresos_pdd."},
  faltan_metadata:{title:"UUID que existen en ingresos y faltan en metadata", help:"Estos registros no tienen correspondencia en metadata_ingresos del periodo consultado."},
  coinciden:{title:"UUID encontrados en ambas tablas", help:"Coincidencias por UUID entre metadata_ingresos e ingresos_pdd."},
  duplicados:{title:"UUID duplicados dentro de una tabla", help:"Un mismo UUID aparece más de una vez y requiere revisión."}
};

function filteredRows(){
  const rows = state[state.view] || [];
  const q = state.query.trim().toUpperCase();
  if(!q) return rows;
  return rows.filter(row => JSON.stringify(row).toUpperCase().includes(q));
}

function fmtDate(value){
  if(!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString("es-MX", {dateStyle:"short", timeStyle:"short"});
}

function render(){
  const config = views[state.view];
  $("viewTitle").textContent = config.title;
  $("viewHelp").textContent = config.help;
  document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab.dataset.view === state.view));

  const rows = filteredRows();
  const head = $("tableHead");
  const body = $("tableBody");

  if(state.view === "faltan_ingresos"){
    head.innerHTML = `<tr><th>#</th><th>UUID</th><th>Fecha emisión</th><th>RFC receptor</th><th>Nombre receptor</th><th class="num">Monto SAT</th><th>Estado SAT</th><th>Acción</th></tr>`;
    body.innerHTML = rows.map((r,i) => `<tr><td>${i+1}</td><td class="uuid">${esc(r.uuid_cfdi)}</td><td>${esc(fmtDate(r.fecha_emision))}</td><td>${esc(r.rfc_receptor)}</td><td>${esc(r.nombre_receptor)}</td><td class="num">${money(r.monto)}</td><td><span class="badge ${r.fecha_cancelacion ? "badge-danger":"badge-ok"}">${r.fecha_cancelacion ? "CANCELADO":"VIGENTE"}</span></td><td><span class="badge badge-danger">AGREGAR / REVISAR INGRESO</span></td></tr>`).join("");
  }else if(state.view === "faltan_metadata"){
    head.innerHTML = `<tr><th>#</th><th>UUID</th><th>Fecha ingreso</th><th>Tipo</th><th>Serie</th><th>Folio</th><th>RFC receptor</th><th>Receptor</th><th class="num">Total</th><th>Acción</th></tr>`;
    body.innerHTML = rows.map((r,i) => `<tr><td>${i+1}</td><td class="uuid">${esc(r.uuid_cfdi)}</td><td>${esc(fmtDate(r.fecha))}</td><td>${esc(r.tipo_factura)}</td><td>${esc(r.serie)}</td><td>${esc(r.folio)}</td><td>${esc(r.rfc_receptor)}</td><td>${esc(r.razon_social_receptor)}</td><td class="num">${money(r.total)}</td><td><span class="badge badge-warning">BUSCAR EN METADATA</span></td></tr>`).join("");
  }else if(state.view === "coinciden"){
    head.innerHTML = `<tr><th>#</th><th>UUID</th><th>Fecha SAT</th><th>Fecha ingreso</th><th>Receptor</th><th class="num">Monto SAT</th><th class="num">Total ingreso</th><th>Diferencia</th><th>Resultado</th></tr>`;
    body.innerHTML = rows.map((r,i) => {
      const diff = Number(r.ingreso.total || 0) - Number(r.metadata.monto || 0);
      return `<tr><td>${i+1}</td><td class="uuid">${esc(r.uuid_cfdi)}</td><td>${esc(fmtDate(r.metadata.fecha_emision))}</td><td>${esc(fmtDate(r.ingreso.fecha))}</td><td>${esc(r.ingreso.razon_social_receptor || r.metadata.nombre_receptor)}</td><td class="num">${money(r.metadata.monto)}</td><td class="num">${money(r.ingreso.total)}</td><td class="num">${money(diff)}</td><td><span class="badge ${Math.abs(diff)<.01?"badge-ok":"badge-warning"}">${Math.abs(diff)<.01?"COINCIDE":"REVISAR IMPORTE"}</span></td></tr>`;
    }).join("");
  }else{
    head.innerHTML = `<tr><th>#</th><th>UUID</th><th>Tabla</th><th class="num">Repeticiones</th><th>Resultado</th></tr>`;
    body.innerHTML = rows.map((r,i) => `<tr><td>${i+1}</td><td class="uuid">${esc(r.uuid_cfdi)}</td><td>${esc(r.tabla)}</td><td class="num">${r.cantidad}</td><td><span class="badge badge-neutral">ELIMINAR O CONSOLIDAR DUPLICADO</span></td></tr>`).join("");
  }

  if(!rows.length){ body.innerHTML = `<tr><td colspan="10" class="empty">No hay registros en esta vista.</td></tr>`; }
  $("rowCount").textContent = `${number(rows.length)} registros visibles`;
  $("btnExportar").disabled = rows.length === 0;
}

async function process(){
  const year = $("anio").value;
  $("btnProcesar").disabled = true;
  $("connectionStatus").textContent = "Procesando...";
  try{
    progress(10,"Preparando consulta",`Ejercicio ${year}.`);
    progress(25,"Consultando metadata SAT","Leyendo UUID tipo ingreso desde metadata_ingresos...");
    state.metadata = await loadMetadata(year);
    progress(55,"Consultando ingresos PROVSOFT",`Metadata obtenida: ${number(state.metadata.length)} registros. Leyendo ingresos_pdd...`);
    state.ingresos = await loadIngresos(year);
    progress(80,"Comparando UUID","Construyendo coincidencias, faltantes y duplicados...");
    compare();
    updateCounts();
    state.view = "faltan_ingresos";
    state.query = "";
    $("buscar").value = "";
    $("periodLabel").textContent = `Ejercicio ${year}`;
    render();
    progress(100,"Conciliación terminada",`Se compararon ${number(groupByUuid(state.metadata).size)} UUID de metadata contra ${number(groupByUuid(state.ingresos).size)} UUID de ingresos.`);
    $("connectionStatus").textContent = "Proceso completado";
  }catch(error){
    console.error("ERROR SUPABASE:", error);
    const detail = [error.message, error.details, error.hint, error.code].filter(Boolean).join(" | ");
    progress(0,"Error en la conciliación",detail || "No fue posible consultar Supabase.");
    $("connectionStatus").textContent = "Error de conexión";
    alert(`Error: ${detail || "Consulta rechazada por Supabase"}`);
  }finally{
    $("btnProcesar").disabled = false;
  }
}

function exportCsv(){
  const rows = filteredRows();
  if(!rows.length) return;
  const flat = rows.map(r => {
    if(state.view === "coinciden") return {uuid:r.uuid_cfdi, fecha_sat:r.metadata.fecha_emision, fecha_ingreso:r.ingreso.fecha, monto_sat:r.metadata.monto, total_ingreso:r.ingreso.total, diferencia:Number(r.ingreso.total||0)-Number(r.metadata.monto||0)};
    if(state.view === "duplicados") return {uuid:r.uuid_cfdi, tabla:r.tabla, repeticiones:r.cantidad};
    return r;
  });
  const keys = [...new Set(flat.flatMap(Object.keys))].filter(k => !["detalle","metadata","ingreso"].includes(k));
  const quote = v => `"${String(v ?? "").replaceAll('"','""')}"`;
  const csv = [keys.map(quote).join(","), ...flat.map(r => keys.map(k => quote(r[k])).join(","))].join("\r\n");
  const blob = new Blob(["\ufeff" + csv], {type:"text/csv;charset=utf-8"});
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `conciliacion_uuid_${state.view}_ejercicio_${$("anio").value}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function clearAll(){
  state.metadata=[]; state.ingresos=[]; state.coinciden=[]; state.faltan_ingresos=[]; state.faltan_metadata=[]; state.duplicados=[]; state.query="";
  updateCounts();
  $("buscar").value="";
  $("periodLabel").textContent="Sin ejercicio seleccionado";
  progress(0,"Sin proceso ejecutado","Selecciona el ejercicio y después ejecuta la conciliación.");
  $("connectionStatus").textContent="Listo para consultar";
  render();
}

initExercise();
updateCounts();
render();
$("btnProcesar").addEventListener("click", process);
$("btnExportar").addEventListener("click", exportCsv);
$("btnLimpiar").addEventListener("click", clearAll);
$("buscar").addEventListener("input", event => { state.query = event.target.value; render(); });
document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => { state.view = tab.dataset.view; render(); }));
