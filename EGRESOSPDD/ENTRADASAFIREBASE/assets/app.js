import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { firebaseConfig, FIRESTORE_PATH } from "./firebase-config.js";

const $ = (s) => document.querySelector(s);
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let entradas = [];
const fmtDinero = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const fmtNumero = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });

function fechaDocumento(x) {
  const raw = x.fecha || x.fecha_certificacion || x.timestamp || "";
  const d = raw?.toDate ? raw.toDate() : new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function texto(x, campos, respaldo = "Sin dato") {
  for (const c of campos) if (x?.[c] !== undefined && x?.[c] !== null && String(x[c]).trim()) return String(x[c]);
  return respaldo;
}

function normalizar(docSnap) {
  const d = docSnap.data();
  const fecha = fechaDocumento(d);
  return {
    id: docSnap.id,
    ...d,
    _fecha: fecha,
    _anio: fecha ? String(fecha.getFullYear()) : "",
    _mes: fecha ? String(fecha.getMonth() + 1).padStart(2, "0") : "",
    _proveedor: texto(d, ["razon_social_emisor", "proveedor", "nombre_proveedor", "emisor"]),
    _folio: [d.serie, d.folio].filter(Boolean).join("-") || d.folio || "Sin folio",
    _total: Number(d.total || 0),
    _conceptos: Array.isArray(d.conceptos_detalle) ? d.conceptos_detalle.length : 0
  };
}

async function cargar() {
  $("#estado").hidden = false;
  $("#estado").textContent = "Cargando entradas de Firestore...";
  $("#entradas").innerHTML = "";
  try {
    const ref = collection(db, FIRESTORE_PATH.almacenes, FIRESTORE_PATH.almacenId, FIRESTORE_PATH.entradas);
    const snap = await getDocs(ref);
    entradas = snap.docs.map(normalizar).sort((a,b) => (b._fecha?.getTime() || 0) - (a._fecha?.getTime() || 0));
    llenarAnios();
    render();
  } catch (e) {
    console.error(e);
    $("#estado").hidden = false;
    $("#estado").innerHTML = `<strong>No se pudieron cargar las entradas.</strong><br>${escapeHtml(e.message)}<br><small>Revisa firebase-config.js, las reglas de Firestore y que ejecutes la app desde un servidor local.</small>`;
  }
}

function llenarAnios() {
  const anios = [...new Set(entradas.map(x => x._anio).filter(Boolean))].sort((a,b)=>b-a);
  const actual = String(new Date().getFullYear());
  $("#selAnio").innerHTML = `<option value="">Todos</option>` + anios.map(a => `<option value="${a}">${a}</option>`).join("");
  if (anios.includes(actual)) $("#selAnio").value = actual;
}

function filtradas() {
  const anio = $("#selAnio").value;
  const mes = $("#selMes").value;
  const q = $("#txtBuscar").value.trim().toLowerCase();
  return entradas.filter(x => {
    const okFecha = (!anio || x._anio === anio) && (!mes || x._mes === mes);
    const bolsa = `${x._proveedor} ${x._folio} ${x.id} ${x.rfc_emisor || ""}`.toLowerCase();
    return okFecha && (!q || bolsa.includes(q));
  });
}

function render() {
  const lista = filtradas();
  $("#estado").hidden = lista.length > 0;
  if (!lista.length) $("#estado").textContent = "No hay entradas para los filtros seleccionados.";
  $("#entradasCount").textContent = lista.length;

  const total = lista.reduce((s,x)=>s+x._total,0);
  const conceptos = lista.reduce((s,x)=>s+x._conceptos,0);
  const proveedores = new Set(lista.map(x=>x._proveedor)).size;
  $("#stats").innerHTML = [
    ["Entradas", lista.length], ["Proveedores", proveedores], ["Conceptos", fmtNumero.format(conceptos)], ["Importe total", fmtDinero.format(total)]
  ].map(([k,v])=>`<article class="stat"><span>${k}</span><strong>${v}</strong></article>`).join("");

  const grupos = new Map();
  for (const x of lista) {
    const g = grupos.get(x._proveedor) || { cantidad:0, total:0, conceptos:0 };
    g.cantidad++; g.total += x._total; g.conceptos += x._conceptos;
    grupos.set(x._proveedor, g);
  }
  $("#proveedoresCount").textContent = grupos.size;
  $("#proveedores").innerHTML = [...grupos.entries()].sort((a,b)=>b[1].total-a[1].total).map(([nombre,g])=>`
    <button class="supplier-card" data-proveedor="${escapeAttr(nombre)}">
      <strong>${escapeHtml(nombre)}</strong>
      <span>${g.cantidad} entrada(s) · ${g.conceptos} concepto(s)</span>
      <b>${fmtDinero.format(g.total)}</b>
    </button>`).join("");

  $("#entradas").innerHTML = lista.map(x => `
    <article class="entry-card">
      <div class="entry-top">
        <span class="status ${String(x.estado||"").toLowerCase()}">${escapeHtml(x.estado || "sin estado")}</span>
        <time>${x._fecha ? x._fecha.toLocaleDateString("es-MX") : "Sin fecha"}</time>
      </div>
      <h3>${escapeHtml(x._proveedor)}</h3>
      <p class="muted">RFC: ${escapeHtml(x.rfc_emisor || "Sin dato")}</p>
      <div class="entry-meta">
        <div><span>Folio</span><strong>${escapeHtml(x._folio)}</strong></div>
        <div><span>Conceptos</span><strong>${x._conceptos}</strong></div>
        <div><span>Total</span><strong>${fmtDinero.format(x._total)}</strong></div>
      </div>
      <p class="uuid">${escapeHtml(x.id)}</p>
      <a class="btn btn-primary full" href="visor.html?id=${encodeURIComponent(x.id)}">Abrir visor</a>
    </article>`).join("");

  document.querySelectorAll(".supplier-card").forEach(btn => btn.addEventListener("click", () => {
    $("#txtBuscar").value = btn.dataset.proveedor;
    render();
    document.querySelector("#entradas").scrollIntoView({ behavior: "smooth" });
  }));
}

function escapeHtml(v="") { return String(v).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
function escapeAttr(v="") { return escapeHtml(v); }

["#selAnio","#selMes"].forEach(s => $(s).addEventListener("change", render));
$("#txtBuscar").addEventListener("input", render);
$("#btnLimpiar").addEventListener("click", () => { $("#selAnio").value=""; $("#selMes").value=""; $("#txtBuscar").value=""; render(); });
$("#btnRecargar").addEventListener("click", cargar);

cargar();
