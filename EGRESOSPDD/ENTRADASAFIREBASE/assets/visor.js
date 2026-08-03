import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { firebaseConfig, FIRESTORE_PATH } from "./firebase-config.js";

const $ = s => document.querySelector(s);
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const fmtDinero = new Intl.NumberFormat("es-MX", { style:"currency", currency:"MXN" });
const fmtNumero = new Intl.NumberFormat("es-MX", { maximumFractionDigits:4 });
const id = new URLSearchParams(location.search).get("id");

function escapeHtml(v="") { return String(v).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
function safeJson(data) { return JSON.stringify(data, (k,v) => v?.toDate ? v.toDate().toISOString() : v, 2); }
function card(label, value) { return `<article class="detail-card"><span>${label}</span><strong>${escapeHtml(value ?? "Sin dato")}</strong></article>`; }
function fecha(v) { const d=v?.toDate?v.toDate():new Date(v); return Number.isNaN(d.getTime())?"Sin dato":d.toLocaleString("es-MX"); }

async function cargar() {
  if (!id) return fallo("No se recibió el ID de la entrada.");
  const ruta = `${FIRESTORE_PATH.almacenes}/${FIRESTORE_PATH.almacenId}/${FIRESTORE_PATH.entradas}/${id}`;
  $("#visorRuta").textContent = ruta;
  try {
    const snap = await getDoc(doc(db, FIRESTORE_PATH.almacenes, FIRESTORE_PATH.almacenId, FIRESTORE_PATH.entradas, id));
    if (!snap.exists()) return fallo("El documento no existe o no tienes permiso para consultarlo.");
    const d = snap.data();
    $("#visorEstado").hidden = true;
    $("#visorContenido").hidden = false;
    const proveedor = d.razon_social_emisor || d.proveedor || d.nombre_proveedor || "Sin proveedor";
    $("#detalleCabecera").innerHTML = [
      card("Proveedor", proveedor), card("RFC emisor", d.rfc_emisor), card("Folio", [d.serie,d.folio].filter(Boolean).join("-") || d.folio),
      card("Fecha CFDI", fecha(d.fecha)), card("Fecha de registro", fecha(d.timestamp)), card("Estado", d.estado),
      card("Subtotal", fmtDinero.format(Number(d.subtotal||0))), card("IVA trasladado", fmtDinero.format(Number(d.impuestos_globales?.total_trasladados||0))),
      card("Total", fmtDinero.format(Number(d.total||0))), card("Método de pago", d.metodo_pago), card("Forma de pago", d.forma_pago),
      card("UUID", d.uuid_cfdi || id)
    ].join("");

    const conceptos = Array.isArray(d.conceptos_detalle) ? d.conceptos_detalle : [];
    $("#conceptosCount").textContent = conceptos.length;
    $("#tablaConceptos").innerHTML = conceptos.map((c,i) => {
      const iva = (c.traslados || []).filter(t=>String(t.impuesto)==="002").reduce((s,t)=>s+Number(t.importe||0),0);
      return `<tr><td>${i+1}</td><td>${escapeHtml(c.noIdentificacion||"")}</td><td>${escapeHtml(c.descripcion||"")}</td>
      <td class="num">${fmtNumero.format(Number(c.cantidad||0))}</td><td>${escapeHtml(c.unidad||c.claveUnidad||"")}</td>
      <td class="num">${fmtDinero.format(Number(c.valorUnitario||0))}</td><td class="num">${fmtDinero.format(Number(c.importe||0))}</td>
      <td class="num">${fmtDinero.format(iva)}</td></tr>`;
    }).join("") || `<tr><td colspan="8">No hay conceptos_detalle en este documento.</td></tr>`;

    const fotos = Array.isArray(d.fotos) ? d.fotos : [];
    if (fotos.length) {
      $("#fotosSeccion").hidden = false;
      $("#fotos").innerHTML = fotos.map((f,i)=>{
        const url = typeof f === "string" ? f : (f.url || f.downloadURL || "");
        return url ? `<a href="${escapeHtml(url)}" target="_blank"><img src="${escapeHtml(url)}" alt="Foto ${i+1}"></a>` : "";
      }).join("");
    }
    $("#jsonRaw").textContent = safeJson({ id:snap.id, ...d });
  } catch (e) { console.error(e); fallo(e.message); }
}
function fallo(msg) { $("#visorEstado").innerHTML = `<strong>No se pudo abrir la entrada.</strong><br>${escapeHtml(msg)}`; }
cargar();
