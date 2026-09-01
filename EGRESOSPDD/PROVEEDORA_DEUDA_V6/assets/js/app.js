import { supabaseUrl, supabaseAnonKey } from "../config.js";

const db = window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
  realtime: { params: { eventsPerSecond: 2 } }
});

const state = {
  raw: [],
  shown: [],
  loading: false,
  order: localStorage.getItem("pdd_debt_order") || "proveedor_deuda_antigua",
  realtime: null,
  debounce: null,
  fallback: null,
  toast: null
};

const ORDER_NAMES = {
  rfc: "RFC",
  nombre: "Nombre",
  fecha_antigua: "Fecha más antigua",
  proveedor_deuda_antigua: "Proveedor completo por deuda más antigua"
};

const $ = (id) => document.getElementById(id);

const SCROLL_KEY = "pdd_debt_scroll_v1";
let scrollSaveTimer = null;
let initialScrollRestored = false;

function readScrollState(){
  try{
    return JSON.parse(sessionStorage.getItem(SCROLL_KEY) || "{}");
  }catch{
    return {};
  }
}

function saveScrollState(){
  const tableShell = document.querySelector(".table-shell");
  sessionStorage.setItem(SCROLL_KEY, JSON.stringify({
    windowY: Math.max(0, Math.round(window.scrollY || 0)),
    tableTop: Math.max(0, Math.round(tableShell?.scrollTop || 0)),
    savedAt: Date.now()
  }));
}

function scheduleScrollSave(){
  clearTimeout(scrollSaveTimer);
  scrollSaveTimer = setTimeout(saveScrollState, 80);
}

function restoreSavedScroll({force=false} = {}){
  if(initialScrollRestored && !force) return;
  const saved = readScrollState();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const tableShell = document.querySelector(".table-shell");

      if(tableShell && Number.isFinite(Number(saved.tableTop))){
        tableShell.scrollTop = Number(saved.tableTop) || 0;
      }

      if(Number.isFinite(Number(saved.windowY))){
        window.scrollTo({ top:Number(saved.windowY) || 0, left:0, behavior:"auto" });
      }

      initialScrollRestored = true;
    });
  });
}
const norm = (value) => String(value ?? "").trim().toUpperCase();
const money = (value) => Number(value || 0).toLocaleString("es-MX", { style:"currency", currency:"MXN" });

function dateKey(value){
  if(!value) return Number.MAX_SAFE_INTEGER;
  const clean = String(value).split("T")[0];
  const parts = clean.split("-").map(Number);
  if(parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return Number.MAX_SAFE_INTEGER;
  return new Date(parts[0], parts[1]-1, parts[2]).getTime();
}

function formatDate(value){
  if(!value) return "—";
  const clean = String(value).split("T")[0];
  const [y,m,d] = clean.split("-");
  return y && m && d ? `${d}/${m}/${y}` : clean;
}

function daysOld(value){
  const t = dateKey(value);
  if(!Number.isFinite(t) || t === Number.MAX_SAFE_INTEGER) return 0;
  const today = new Date();
  today.setHours(0,0,0,0);
  const day = new Date(t);
  day.setHours(0,0,0,0);
  return Math.max(0, Math.floor((today - day) / 86400000));
}

function esc(value){
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeInvoice(f){
  return {
    ...f,
    uuid_cfdi: String(f.uuid_cfdi || f.uuid || "").trim(),
    fecha: f.fecha || null,
    rfc_emisor: norm(f.rfc_emisor),
    razon_social_emisor: String(f.razon_social_emisor || "").trim(),
    proveedor: String(f.proveedor || f.razon_social_emisor || f.rfc_emisor || "SIN PROVEEDOR").trim(),
    serie_folio: String(f.serie_folio || f.factura || f.folio || "—").trim(),
    total: Number(f.total || 0),
    factura_pagada: norm(f.factura_pagada || "NO"),
    factura_fisicamente: norm(f.factura_fisicamente || "NO"),
    fotos: Array.isArray(f.fotos) ? f.fotos.filter(Boolean) : []
  };
}

function providerKey(f){
  return norm(f.rfc_emisor || f.proveedor || f.razon_social_emisor || "SIN PROVEEDOR");
}

function sortDebt(data, type = state.order){
  const rows = [...data];

  if(type === "fecha_antigua") return rows.sort((a,b) => dateKey(a.fecha) - dateKey(b.fecha));

  if(type === "nombre"){
    return rows.sort((a,b) => {
      const c = norm(a.proveedor).localeCompare(norm(b.proveedor), "es");
      return c || dateKey(a.fecha) - dateKey(b.fecha);
    });
  }

  if(type === "proveedor_deuda_antigua"){
    const groups = new Map();
    rows.forEach(row => {
      const key = providerKey(row);
      if(!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });

    return [...groups.entries()]
      .map(([key, invoices]) => {
        invoices.sort((a,b) => dateKey(a.fecha) - dateKey(b.fecha));
        return { key, invoices, oldest: Math.min(...invoices.map(x => dateKey(x.fecha))) };
      })
      .sort((a,b) => (a.oldest - b.oldest) || a.key.localeCompare(b.key, "es"))
      .flatMap(group => group.invoices);
  }

  return rows.sort((a,b) => {
    const c = norm(a.rfc_emisor).localeCompare(norm(b.rfc_emisor), "es");
    return c || dateKey(a.fecha) - dateKey(b.fecha);
  });
}

async function loadDebt({quiet=false} = {}){
  if(state.loading) return;
  state.loading = true;
  setSync(quiet ? "Actualizando…" : "Conectando…");

  try{
    const { data, error } = await db
      .from("v_deuda_proveedores")
      .select("*")
      .neq("factura_pagada", "SI");

    if(error) throw error;

    const unique = new Map();
    (data || []).map(normalizeInvoice).forEach((f, index) => {
      const key = f.uuid_cfdi || `${f.rfc_emisor}|${f.serie_folio}|${f.fecha}|${f.total}|${index}`;
      if(!unique.has(key)) unique.set(key, f);
    });

    state.raw = [...unique.values()];
    render();
    setSync(`En línea · ${new Date().toLocaleTimeString("es-MX", {hour:"2-digit", minute:"2-digit"})}`);
  }catch(err){
    console.error("Error cargando deuda", err);
    setSync("Sin sincronizar", true);
    if(!quiet) toast("No se pudo cargar la deuda.");
  }finally{
    state.loading = false;
  }
}

function render(){
  state.shown = sortDebt(state.raw);
  const total = state.shown.reduce((sum,row) => sum + Number(row.total || 0), 0);
  $("totalGlobal").textContent = money(total);
  $("invoiceCount").textContent = `${state.shown.length.toLocaleString("es-MX")} factura${state.shown.length === 1 ? "" : "s"}`;
  $("orderLabel").textContent = `Orden: ${ORDER_NAMES[state.order] || ORDER_NAMES.rfc}`;
  renderDebtView();
}

function renderDebtView(){
  const previousTableTop = document.querySelector(".table-shell")?.scrollTop ?? null;
  if(!state.shown.length){
    $("debtView").innerHTML = `<div class="empty-state"><strong>Sin deuda pendiente</strong>No hay facturas activas para mostrar.</div>`;
    return;
  }

  const desktopRows = state.shown.map(row => {
    const days = daysOld(row.fecha);
    const overdue = days >= 30 ? "overdue" : "";
    const photos = row.fotos.length
      ? `<div class="photo-links">${row.fotos.map((url,i) => `<a href="${esc(url)}" target="_blank" rel="noopener" title="Foto ${i+1}">📷</a>`).join("")}</div>`
      : "—";
    return `<tr class="${overdue}" data-uuid="${esc(row.uuid_cfdi)}">
      <td>${formatDate(row.fecha)}</td>
      <td class="center"><span class="day-badge">${days}</span></td>
      <td><a class="uuid-link" href="./detalle_completo.html?uuid=${encodeURIComponent(row.uuid_cfdi)}" title="Abrir detalle completo de ${esc(row.uuid_cfdi)}">${esc(row.uuid_cfdi || "—")}</a></td>
      <td>${esc(row.rfc_emisor || "—")}</td>
      <td class="provider">${esc(row.proveedor)}</td>
      <td>${esc(row.serie_folio)}</td>
      <td class="number">${money(row.total)}</td>
      <td class="center">${row.factura_fisicamente === "SI" ? "✅" : "—"}</td>
      <td class="center">${photos}</td>
      <td class="center"><button class="pay-button" type="button" title="Marcar como pagada" data-pay="${esc(row.uuid_cfdi)}"></button></td>
    </tr>`;
  }).join("");

  const mobileCards = state.shown.map(row => {
    const days = daysOld(row.fecha);
    const overdue = days >= 30 ? "overdue" : "";
    const photo = row.fotos[0] ? `<a class="photo-button" href="${esc(row.fotos[0])}" target="_blank" rel="noopener" aria-label="Ver foto">📷</a>` : "";
    return `<article class="invoice-card ${overdue}" data-uuid="${esc(row.uuid_cfdi)}">
      <div class="invoice-top">
        <div><div class="invoice-provider">${esc(row.proveedor)}</div><div class="invoice-rfc">${esc(row.rfc_emisor || "SIN RFC")}</div></div>
        <div><div class="invoice-total">${money(row.total)}</div><div class="invoice-date">${formatDate(row.fecha)}</div></div>
      </div>
      <div class="invoice-grid">
        <div class="invoice-field"><small>Folio</small><strong>${esc(row.serie_folio)}</strong></div>
        <div class="invoice-field"><small>Antigüedad</small><strong class="${days >= 30 ? "danger-days" : ""}">${days} días</strong></div>
        <div class="invoice-field"><small>UUID</small><a href="./detalle_completo.html?uuid=${encodeURIComponent(row.uuid_cfdi)}" title="Abrir detalle completo de la factura">${esc(row.uuid_cfdi || "—")}</a></div>
      </div>
      <div class="invoice-actions">
        <div class="mini-status"><span>${row.factura_fisicamente === "SI" ? "✅ Física" : "○ Sin física"}</span>${row.fotos.length ? `<span>· ${row.fotos.length} foto${row.fotos.length === 1 ? "" : "s"}</span>` : ""}</div>
        <div style="display:flex;gap:7px;align-items:center">${photo}<button class="pay-mobile" type="button" data-pay="${esc(row.uuid_cfdi)}">✓ PAGADA</button></div>
      </div>
    </article>`;
  }).join("");

  $("debtView").innerHTML = `
    <div class="table-shell"><table>
      <thead><tr><th>Fecha</th><th>Días</th><th>UUID</th><th>RFC</th><th>Proveedor</th><th>Serie/Folio</th><th>Total</th><th>Física</th><th>Fotos</th><th>Acción</th></tr></thead>
      <tbody>${desktopRows}</tbody>
    </table></div>
    <div class="mobile-list">${mobileCards}</div>`;

  const tableShell = document.querySelector(".table-shell");
  if(tableShell){
    tableShell.addEventListener("scroll", scheduleScrollSave, {passive:true});

    if(previousTableTop !== null){
      tableShell.scrollTop = previousTableTop;
    }else{
      const saved = readScrollState();
      tableShell.scrollTop = Number(saved.tableTop) || 0;
    }
  }

  restoreSavedScroll();

  document.querySelectorAll("[data-pay]").forEach(button => {
    button.addEventListener("click", () => markPaid(button.dataset.pay));
  });

}

async function markPaid(uuid){
  if(!uuid) return;
  const row = state.raw.find(x => x.uuid_cfdi === uuid);
  if(!row) return;

  const ok = confirm(`¿Marcar como pagada esta factura?\n\n${row.proveedor}\n${row.serie_folio}\n${money(row.total)}`);
  if(!ok) return;

  try{
    const { error } = await db.from("deuda_limpia_pdd").update({ factura_pagada:"SI" }).eq("uuid_cfdi", uuid);
    if(error) throw error;

    document.querySelectorAll(`[data-uuid="${CSS.escape(uuid)}"]`).forEach(el => el.classList.add("row-removing"));
    setTimeout(() => {
      state.raw = state.raw.filter(x => x.uuid_cfdi !== uuid);
      render();
    }, 320);
    toast("Factura marcada como pagada.");
  }catch(err){
    console.error(err);
    toast("No se pudo marcar como pagada.");
  }
}

function exportExcel(){
  if(!state.shown.length){ toast("No hay deuda para exportar."); return; }

  const rows = state.shown.map(f => ({
    "Fecha": formatDate(f.fecha),
    "Días": daysOld(f.fecha),
    "UUID": f.uuid_cfdi || "",
    "RFC": f.rfc_emisor || "",
    "Proveedor": f.proveedor || "",
    "Serie/Folio": f.serie_folio || "",
    "Total": Number(f.total || 0),
    "Física": f.factura_fisicamente === "SI" ? "SI" : "NO",
    "Fotos": f.fotos.join(" | ")
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{wch:12},{wch:8},{wch:39},{wch:18},{wch:44},{wch:18},{wch:16},{wch:10},{wch:42}];

  const totalRow = rows.length + 2;
  XLSX.utils.sheet_add_aoa(ws, [["", "", "", "", "", "TOTAL DEUDA ÍNTEGRA", state.shown.reduce((s,f)=>s+Number(f.total||0),0)]], {origin:`A${totalRow}`});

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Deuda íntegra");
  XLSX.writeFile(wb, `deuda_integra_${new Date().toISOString().slice(0,10)}.xlsx`);
  toast("Excel generado con la deuda visible.");
}

function scheduleRefresh(){
  clearTimeout(state.debounce);
  state.debounce = setTimeout(() => loadDebt({quiet:true}), 1400);
}

function startRealtime(){
  if(state.realtime) db.removeChannel(state.realtime);

  state.realtime = db.channel("pdd-deuda-live")
    .on("postgres_changes", { event:"*", schema:"public", table:"deuda_limpia_pdd" }, scheduleRefresh)
    .subscribe(status => {
      if(status === "SUBSCRIBED") setSync("En línea · tiempo real");
      if(status === "CHANNEL_ERROR" || status === "TIMED_OUT") setSync("Reintentando…", true);
    });

  clearInterval(state.fallback);
  state.fallback = setInterval(() => {
    if(document.visibilityState === "visible") loadDebt({quiet:true});
  }, 90000);
}

function setSync(text, error=false){
  const el = $("syncStatus");
  el.classList.toggle("error", error);
  el.innerHTML = `<i></i>${esc(text)}`;
}

function toggleMenu(force){
  const menu = $("mainMenu");
  const open = typeof force === "boolean" ? force : menu.classList.contains("hidden");
  menu.classList.toggle("hidden", !open);
  $("menuButton").setAttribute("aria-expanded", String(open));
}

function openConfig(){
  toggleMenu(false);
  const radio = document.querySelector(`input[name="debtOrder"][value="${state.order}"]`);
  if(radio) radio.checked = true;
  $("configModal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeConfig(){
  $("configModal").classList.add("hidden");
  document.body.style.overflow = "";
}

function saveOrder(){
  const chosen = document.querySelector('input[name="debtOrder"]:checked')?.value;
  if(!chosen) return;
  state.order = chosen;
  localStorage.setItem("pdd_debt_order", chosen);
  render();
  closeConfig();
  toast(`Orden cambiado a: ${ORDER_NAMES[chosen]}.`);
}

function toast(message){
  clearTimeout(state.toast);
  $("toast").textContent = message;
  $("toast").classList.remove("hidden");
  state.toast = setTimeout(() => $("toast").classList.add("hidden"), 2600);
}

$("menuButton").addEventListener("click", e => { e.stopPropagation(); toggleMenu(); });
$("excelButton").addEventListener("click", () => { toggleMenu(false); exportExcel(); });
$("configButton").addEventListener("click", openConfig);
$("closeModalButton").addEventListener("click", closeConfig);
$("cancelModalButton").addEventListener("click", closeConfig);
$("saveOrderButton").addEventListener("click", saveOrder);
$("configModal").addEventListener("click", e => { if(e.target === $("configModal")) closeConfig(); });
document.addEventListener("click", e => { if(!e.target.closest(".menu-wrap")) toggleMenu(false); });
document.addEventListener("keydown", e => { if(e.key === "Escape"){ toggleMenu(false); closeConfig(); } });
document.addEventListener("visibilitychange", () => {
  if(document.visibilityState === "hidden"){
    saveScrollState();
  }else{
    loadDebt({quiet:true});
    restoreSavedScroll({force:true});
  }
});

window.addEventListener("scroll", scheduleScrollSave, {passive:true});
window.addEventListener("pagehide", saveScrollState);
window.addEventListener("pageshow", () => restoreSavedScroll({force:true}));
window.addEventListener("beforeunload", () => {
  saveScrollState();
  if(state.realtime) db.removeChannel(state.realtime);
  clearInterval(state.fallback);
});

loadDebt();
startRealtime();
