import { db, doc, getDoc } from "./firebase.js";

const qs = nombre => new URLSearchParams(location.search).get(nombre);
const $ = id => document.getElementById(id);
const W = 40;
const line = () => "-".repeat(W) + "\n";
const center = valor => {
  const s = String(valor ?? "");
  if (s.length >= W) return s.slice(0, W) + "\n";
  return " ".repeat(Math.floor((W - s.length) / 2)) + s + "\n";
};
const cut = (valor, n) => String(valor ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const money = valor => "$" + Number(valor ?? 0).toFixed(2);

function escapeHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtFecha(iso) {
  return new Date(iso).toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

async function cargar() {
  const id = qs("id");
  const ruta = qs("ruta");
  if (!id || !ruta) throw new Error("Falta id o ruta del traspaso.");

  const ref = doc(db, "almacenes", ruta, "entradas", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("No se encontró el traspaso solicitado.");
  const d = snap.data();

  $("folio").textContent = id;
  $("rutaId").textContent = ruta;
  $("vendedorId").textContent = d.vendedorId ?? "";
  $("vendedorNombre").textContent = d.vendedorNombre ?? "";
  $("fecha").textContent = fmtFecha(d.fecha);

  $("items").innerHTML = "";
  for (const it of d.items || []) {
    $("items").insertAdjacentHTML("beforeend", `
      <tr>
        <td class="right">${escapeHtml(it.cantidad)}</td>
        <td>${escapeHtml(it.codigo)}</td>
        <td>${escapeHtml(it.concepto)}</td>
        <td class="right">${money(it.precioUnitario ?? it.precio)}</td>
      </tr>`);
  }

  let t = "";
  t += center("PROVEEDORA DE DULCES Y DESECHABLES");
  t += center("TRASPASO ENTRE ALMACENES");
  t += line();
  t += `Folio : ${id}\n`;
  t += `Ruta  : ${ruta}\n`;
  t += `Vende : ${cut(d.vendedorNombre, 30)}\n`;
  t += `Fecha : ${fmtFecha(d.fecha)}\n`;
  t += line();
  t += center("DETALLE");
  t += "Cant Codigo      Producto           P.U.\n";
  t += line();

  for (const it of d.items || []) {
    t += `${String(it.cantidad).padStart(3)} ${cut(it.codigo,9).padEnd(9)} ${cut(it.concepto,16).padEnd(16)} ${money(it.precioUnitario ?? it.precio).padStart(7)}\n`;
  }

  t += line();
  t += `ENTREGA: ${cut(d?.firmas?.entrega?.nombre || "—", 30)}\n`;
  t += `RECIBE : ${cut(d?.firmas?.recibe?.nombre || "—", 30)}\n`;
  t += "FIRMA INGRESADA EN LA BASE DE DATOS\n";
  t += line();
  t += center("FIN DEL TICKET");
  $("detalleTexto").textContent = t;

  // Al finalizar o reimprimir desde PROVSOFT, abre directamente el diálogo de impresión.
  setTimeout(() => window.print(), 350);
}

document.addEventListener("DOMContentLoaded", async () => {
  $("btnPrint").addEventListener("click", () => window.print());
  $("btnClose").addEventListener("click", () => window.close());
  try {
    await cargar();
  } catch (err) {
    console.error(err);
    alert(err.message || "No se pudo cargar el traspaso.");
  }
});
