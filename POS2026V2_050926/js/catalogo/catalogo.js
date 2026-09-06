import {
  guardarProductos,
  obtenerProductos,
  guardarMeta,
  obtenerMeta,
  guardarFotos,
  obtenerFotos
} from "./indexeddb.js";

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export let catalogo = [];
export const codeIndex = new Map();
export const catalogoById = new Map();
export const fotosIndex = new Map();

export function reconstruirIndices() {
  codeIndex.clear();
  catalogoById.clear();

  catalogo.forEach(p => {
    if (p.activo === false) return;
    catalogoById.set(p.id, p);

    if (p.codigo) {
      codeIndex.set(String(p.codigo).trim(), p.id);
    }

    if (Array.isArray(p.equivalentes)) {
      p.equivalentes.forEach(eq => {
        if (eq) codeIndex.set(String(eq).trim(), p.id);
      });
    }
  });
}

export function normalizarProducto(docSnap) {
  const x = docSnap.data();

  return {
    id: docSnap.id,
    nombre: x.nombre || x.concepto || "SIN NOMBRE",
    codigo: String(x.codigoBarra || x.codigo || "").trim(),
    precioPublico: Number(x.precioPublico || 0),
    mayoreo: Number(x.mayoreo || 0),
    medioMayoreo: Number(x.medioMayoreo || 0),
    ivaTasa: Number(x.ivaTasa || 0),
    iepsTasa: Number(x.iepsTasa || 0),
    equivalentes: Array.isArray(x.codigosEquivalentes)
      ? x.codigosEquivalentes
      : (Array.isArray(x.equivalentes) ? x.equivalentes : []),
    claveSat: x.claveSat || null,
    unidadMedidaSat: x.unidadSat || x.unidadMedidaSat || null,
    departamento_id: x.departamento_id || null,
    departamento: x.departamento || null,
    costoUnit: Number(x.costoUnit || x.costoSinImpuesto || 0),
    permite_descuento: x.permite_descuento !== false,
    comision_tipo: x.comision_tipo || null,
    comision_valor: Number(x.comision_valor || 0),
    activo: x.activo !== false,
    actualizadoEn: x.actualizadoEn || null,
    updatedAt: x.updatedAt?.toDate
      ? x.updatedAt.toDate().toISOString()
      : (x.updatedAt || x.actualizadoEn || null)
  };
}

export async function cargarCatalogo(db, forzar = false, actualizarEnSegundoPlano = true) {
  const local = await obtenerProductos();
  if (local.length) {
    catalogo = local;
    reconstruirIndices();
    console.log("⚡ Catálogo inmediato desde IndexedDB:", catalogo.length);
    if (actualizarEnSegundoPlano) {
      actualizarCatalogoIncremental(db, forzar).catch(err =>
        console.warn("Actualización incremental pendiente:", err)
      );
    }
    return catalogo;
  }

  await actualizarCatalogoIncremental(db, true);
  return catalogo;
}

export async function actualizarCatalogoIncremental(db, forzar = false) {
  const meta = await obtenerMeta("catalogo");
  let consulta = query(collection(db, "productos"), orderBy("updatedAt", "asc"));

  if (!forzar && meta?.ultimoUpdatedAt) {
    consulta = query(
      collection(db, "productos"),
      where("updatedAt", ">", Timestamp.fromDate(new Date(meta.ultimoUpdatedAt))),
      orderBy("updatedAt", "asc")
    );
  }

  const snap = await getDocs(consulta);
  if (!snap.empty) {
    const cambios = snap.docs.map(normalizarProducto);
    await guardarProductos(cambios);
    const mapa = new Map(catalogo.map(p => [p.id, p]));
    cambios.forEach(p => mapa.set(p.id, p));
    catalogo = [...mapa.values()];
    reconstruirIndices();

    const ultimo = snap.docs[snap.docs.length - 1].data().updatedAt;
    await guardarMeta("catalogo", {
      ultimoUpdatedAt: ultimo?.toDate ? ultimo.toDate().toISOString() : new Date().toISOString(),
      total: catalogo.length
    });
  }

  console.log(`✅ Catálogo incremental: ${snap.size} cambio(s)`);
  window.__ULTIMOS_CAMBIOS_CATALOGO = snap.size;
  window.dispatchEvent(new CustomEvent("pos:catalogo-actualizado", { detail: { cambios: snap.size } }));
  return catalogo;
}

export async function cargarCatalogoFotos(db, forzar = false) {
  const local = await obtenerFotos();
  fotosIndex.clear();
  local.forEach(x => fotosIndex.set(String(x.codigo), x));
  console.log("📷 Fotos locales disponibles:", fotosIndex.size);
  actualizarFotosSegundoPlano(db, forzar || !local.length).catch(err =>
    console.warn("Actualización de fotos pendiente:", err)
  );
  return fotosIndex;
}

async function actualizarFotosSegundoPlano(db, forzar = false) {
  const meta = await obtenerMeta("catalogo_fotos");
  let consulta = collection(db, "productos_fotos_meta");
  if (!forzar && meta?.ultimoUpdatedAt) {
    consulta = query(
      collection(db, "productos_fotos_meta"),
      where("updatedAt", ">", Timestamp.fromDate(new Date(meta.ultimoUpdatedAt))),
      orderBy("updatedAt", "asc")
    );
  }

  const snap = await getDocs(consulta);

  const fotos = [];

  snap.forEach(docSnap => {
    fotos.push({
      codigo: docSnap.id,
      ...docSnap.data()
    });
  });

  await guardarFotos(fotos);
  if (fotos.length) {
    const fechas = snap.docs
      .map(d => d.data().updatedAt)
      .filter(Boolean)
      .map(x => x?.toDate ? x.toDate() : new Date(x));
    const ultimo = fechas.length ? new Date(Math.max(...fechas.map(x => x.getTime()))) : new Date();
    await guardarMeta("catalogo_fotos", {
      ultimoUpdatedAt: ultimo.toISOString(),
      total: fotosIndex.size
    });
  }

  fotos.forEach(x => {
    fotosIndex.set(String(x.codigo), x);
  });

  console.log("✅ Catálogo fotos actualizado:", fotos.length);
  return fotosIndex;
}

export function obtenerFotosProducto(codigo) {
  const key = String(codigo || "").trim();
  const item = fotosIndex.get(key);

  if (!item) return [];

  return Array.isArray(item.urlsFotos)
    ? item.urlsFotos.filter(Boolean)
    : [];
}

export function resolverProductoPorCodigo(codigo) {
  const key = String(codigo || "").trim();
  const id = codeIndex.get(key);

  if (!id) return null;

  return catalogoById.get(id) || null;
}

export function buscarLocal(texto) {
  const q = String(texto || "").trim().toLowerCase();

  if (!q) return [];

  const directo = resolverProductoPorCodigo(q);
  if (directo) return [directo];

  return catalogo
    .filter(p => {
      const nombre = String(p.nombre || "").toLowerCase();
      const codigo = String(p.codigo || "").toLowerCase();

      return nombre.includes(q) || codigo.includes(q);
    })
    .slice(0, 50);
}

export function obtenerCatalogo() {
  return catalogo;
}
