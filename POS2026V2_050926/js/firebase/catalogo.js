import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "./config.js";

let catalogo = [];
const codeIndex = new Map();
const catalogoById = new Map();

export async function cargarCatalogo() {
  const q = query(
    collection(db, "productos"),
    where("activo", "==", true)
  );

  const snap = await getDocs(q);

  catalogo = snap.docs.map(doc => {
    const x = doc.data();

    return {
      id: doc.id,
      nombre: x.nombre || x.concepto || "SIN NOMBRE",
      codigo: String(x.codigo || x.codigoBarra || "").trim(),
      precioPublico: Number(x.precioPublico || 0),
      mayoreo: Number(x.mayoreo || 0),
      medioMayoreo: Number(x.medioMayoreo || 0),
      ivaTasa: Number(x.ivaTasa || 0),
      iepsTasa: Number(x.iepsTasa || 0),
      equivalentes: Array.isArray(x.equivalentes) ? x.equivalentes : [],
      departamento_id: x.departamento_id || null,
      departamento: x.departamento || null,
      costoUnit: Number(x.costoUnit || x.costoSinImpuesto || 0),
      permite_descuento: x.permite_descuento !== false
    };
  });

  reconstruirIndices();

  return catalogo;
}

function reconstruirIndices() {
  codeIndex.clear();
  catalogoById.clear();

  catalogo.forEach(p => {
    catalogoById.set(p.id, p);

    if (p.codigo) {
      codeIndex.set(p.codigo, p.id);
    }

    if (Array.isArray(p.equivalentes)) {
      p.equivalentes.forEach(eq => {
        if (eq) codeIndex.set(String(eq).trim(), p.id);
      });
    }
  });
}

export function getCatalogo() {
  return catalogo;
}

export function resolverProductoPorCodigo(codigo) {
  const id = codeIndex.get(String(codigo || "").trim());
  if (!id) return null;
  return catalogoById.get(id) || null;
}

export function buscarLocal(texto) {
  const q = String(texto || "").trim().toLowerCase();

  if (!q) return [];

  const exacto = resolverProductoPorCodigo(q);
  if (exacto) return [exacto];

  return catalogo.filter(p =>
    String(p.nombre || "").toLowerCase().includes(q)
  );
}