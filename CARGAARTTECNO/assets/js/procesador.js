import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  getDocs,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const COLECCION = "productos";

let firebaseMap = new Map();

function tokenizarLinea(linea) {
  const out = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m;

  while ((m = re.exec(linea)) !== null) {
    out.push(m[1] !== undefined ? m[1] : m[2]);
  }

  return out;
}

function toNumber(v) {
  if (v === undefined || v === null || v === "" || v === "?") return null;

  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toBoolYesNo(v) {
  if (v === "yes") return true;
  if (v === "no") return false;
  return null;
}

function normalizarCodigo(x) {
  return String(x ?? "").trim();
}

function valid(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === "string" && v.trim() === "") return false;
  return true;
}

function equal(a, b) {
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) < 0.000001;
  }

  return String(a ?? "") === String(b ?? "");
}

function redondear(n) {
  return Math.round(n * 100) / 100;
}

function lineasValidas(texto) {
  return texto
    .split(/\r?\n/)
    .map(x => x.trim())
    .filter(Boolean);
}

async function leerHandle(handle) {
  const file = await handle.getFile();
  return await file.text();
}

async function vaciarHandle(handle) {
  const writable = await handle.createWritable();
  await writable.write("");
  await writable.close();
}

async function descargarCatalogo() {
  firebaseMap = new Map();

  const snap = await getDocs(collection(db, COLECCION));

  snap.forEach(ds => {
    const d = { id: ds.id, ref: ds.ref, ...ds.data() };

    const docId = String(ds.id || "").trim();
    if (docId) firebaseMap.set(docId, d);

    const codigoBarra = String(d.codigoBarra || "").trim();
    if (codigoBarra) firebaseMap.set(codigoBarra, d);
  });

  return snap.size;
}

function extraerProducto(cols) {
  return {
    codigoBarra: normalizarCodigo(cols[0]),
    concepto: String(cols[1] || "").trim(),
    costoSinImpuesto: toNumber(cols[2]),
    precioPublico: toNumber(cols[8]),
    medioMayoreo: toNumber(cols[4]),
    mayoreo: toNumber(cols[26]),
    activo: toBoolYesNo(cols[20]),
    departamento_id: cols[9] != null ? String(cols[9]).trim() : "",
    claveSat: String(cols[34] || "").trim(),
    unidadMedidaSat: String(cols[35] || "").trim()
  };
}

async function actualizarPorLotes(rows) {
  let actualizados = 0;
  let altas = 0;
  let modificaciones = 0;

  for (let i = 0; i < rows.length; i += 400) {
    const slice = rows.slice(i, i + 400);
    const batch = writeBatch(db);

    for (const r of slice) {
      if (r.tipo === "alta") {
        const refNueva = doc(collection(db, COLECCION), r.codigo);

        batch.set(refNueva, {
          ...r.payload,
          creadoEn: r.payload.creadoEn || new Date().toISOString(),
          actualizadoEn: new Date().toISOString(),
          updatedAt: serverTimestamp()
        });

        altas++;
      } else {
        batch.update(r.ref, {
          ...r.payload,
          actualizadoEn: new Date().toISOString(),
          updatedAt: serverTimestamp()
        });

        modificaciones++;
      }
    }

    await batch.commit();
    actualizados += slice.length;
  }

  return { actualizados, altas, modificaciones };
}

async function procesarProductos(texto) {
  const lines = lineasValidas(texto);

  if (!lines.length) {
    return {
      leidos: 0,
      cambios: 0,
      altas: 0,
      reactivados: 0,
      actualizados: 0,
      detalle: "Archivo vacío"
    };
  }

  const fields = [
    "concepto",
    "costoSinImpuesto",
    "precioPublico",
    "medioMayoreo",
    "mayoreo",
    "claveSat",
    "unidadMedidaSat",
    "activo",
    "departamento_id"
  ];

  const map = new Map();

  for (const line of lines) {
    const cols = tokenizarLinea(line);

    if (cols.length >= 36) {
      const p = extraerProducto(cols);

      if (p.codigoBarra) {
        map.set(p.codigoBarra, p);
      }
    }
  }

  const updates = [];
  const fechaVerificacion = new Date().toISOString();
  const hoy = fechaVerificacion.substring(0, 10);

  let cambiosDetectados = 0;
  let productosNuevos = 0;
  let productosReactivados = 0;
  let productosVerificados = 0;
  let omitidosInactivos = 0;
  let omitidosYaVerificadosHoy = 0;

  for (const nuevo of map.values()) {
    const actual = firebaseMap.get(nuevo.codigoBarra);

    if (!actual) {
      updates.push({
        tipo: "alta",
        codigo: nuevo.codigoBarra,
        payload: {
          codigoBarra: nuevo.codigoBarra,
          concepto: nuevo.concepto || "",
          costoSinImpuesto: nuevo.costoSinImpuesto,
          precioPublico: nuevo.precioPublico,
          medioMayoreo: nuevo.medioMayoreo,
          mayoreo: nuevo.mayoreo,
          activo: nuevo.activo,
          departamento_id: nuevo.departamento_id || "",
          claveSat: nuevo.claveSat || "",
          unidadMedidaSat: nuevo.unidadMedidaSat || "",
          codigosEquivalentes: [],
          preciosPorCantidad: [],
          catalogoVerificadoEn: fechaVerificacion,
          creadoEn: fechaVerificacion
        }
      });

      productosNuevos++;
      productosVerificados++;
      continue;
    }

    if (actual.activo !== true && nuevo.activo !== true) {
      omitidosInactivos++;
      continue;
    }

    const fueReactivado =
      actual.activo !== true &&
      nuevo.activo === true;

    const payload = {};

    for (const f of fields) {
      const nuevoValor = nuevo[f];
      const actualValor = actual[f];

      if (!valid(nuevoValor)) continue;

      if (!equal(actualValor, nuevoValor)) {
        payload[f] = nuevoValor;
      }
    }

    const tieneCambios = Object.keys(payload).length > 0;
    const ultimaVerificacion =
      String(actual.catalogoVerificadoEn || "").substring(0, 10);

    if (!tieneCambios && !fueReactivado && ultimaVerificacion === hoy) {
      omitidosYaVerificadosHoy++;
      continue;
    }

    if (tieneCambios) cambiosDetectados++;

    if (fueReactivado) {
      productosReactivados++;
      payload.activo = true;
    }

    updates.push({
      tipo: "update",
      ref: actual.ref,
      codigo: nuevo.codigoBarra,
      payload: {
        ...payload,
        catalogoVerificadoEn: fechaVerificacion
      }
    });

    productosVerificados++;
  }

  const r = await actualizarPorLotes(updates);

  return {
    leidos: map.size,
    cambios: cambiosDetectados,
    altas: productosNuevos,
    reactivados: productosReactivados,
    actualizados: r.actualizados,
    detalle:
      `${map.size} productos leídos, ` +
      `${productosNuevos} nuevos, ` +
      `${productosReactivados} reactivados, ` +
      `${productosVerificados} verificados, ` +
      `${cambiosDetectados} con cambios, ` +
      `${omitidosInactivos} inactivos omitidos, ` +
      `${omitidosYaVerificadosHoy} ya verificados hoy`
  };
}

function precioArrayDesdeCols(cols) {
  const codigo = normalizarCodigo(cols[0]);
  const c1 = toNumber(cols[1]);
  const t1 = toNumber(cols[5]);
  const c2 = toNumber(cols[7]);
  const t2 = toNumber(cols[8]);
  const arr = [];

  if (c1 && t1) {
    arr.push({
      cantidadMinima: c1,
      precioUnitario: redondear(t1 / c1),
      precioTotal: t1
    });
  }

  if (c2 && t2) {
    arr.push({
      cantidadMinima: c2,
      precioUnitario: redondear(t2 / c2),
      precioTotal: t2
    });
  }

  return { codigo, arr };
}

function normalizarPrecios(arr = []) {
  if (!Array.isArray(arr)) return [];

  return arr
    .map(x => ({
      cantidadMinima: Number(x.cantidadMinima),
      precioUnitario: redondear(Number(x.precioUnitario)),
      precioTotal: redondear(Number(x.precioTotal))
    }))
    .filter(x =>
      Number.isFinite(x.cantidadMinima) &&
      Number.isFinite(x.precioUnitario) &&
      Number.isFinite(x.precioTotal)
    )
    .sort((a, b) => a.cantidadMinima - b.cantidadMinima);
}

function arraysPreciosIguales(a, b) {
  return JSON.stringify(normalizarPrecios(a)) ===
    JSON.stringify(normalizarPrecios(b));
}

async function procesarPrecios(texto) {
  const lines = lineasValidas(texto);

  if (!lines.length) {
    return {
      leidos: 0,
      cambios: 0,
      actualizados: 0,
      detalle: "Archivo vacío"
    };
  }

  const preciosMap = new Map();

  for (const line of lines) {
    const cols = tokenizarLinea(line);

    if (cols.length >= 9) {
      const { codigo, arr } = precioArrayDesdeCols(cols);

      if (codigo && arr.length) {
        preciosMap.set(
          codigo,
          arr.sort((a, b) => a.cantidadMinima - b.cantidadMinima)
        );
      }
    }
  }

  const updates = [];

  for (const [codigo, nuevoArr] of preciosMap.entries()) {
    const actual = firebaseMap.get(codigo);
    if (!actual) continue;

    const actualArr = normalizarPrecios(actual.preciosPorCantidad || []);

    if (!arraysPreciosIguales(actualArr, nuevoArr)) {
      updates.push({
        tipo: "update",
        ref: actual.ref,
        codigo,
        payload: {
          preciosPorCantidad: nuevoArr
        }
      });
    }
  }

  const r = await actualizarPorLotes(updates);

  return {
    leidos: preciosMap.size,
    cambios: updates.length,
    actualizados: r.actualizados,
    detalle: `${preciosMap.size} precios leídos, ${updates.length} con cambios`
  };
}

function normalizarEquiv(arr = []) {
  if (!Array.isArray(arr)) return [];

  return [...new Set(
    arr.map(x => normalizarCodigo(x)).filter(Boolean)
  )].sort();
}

function arraysEquivIguales(a, b) {
  return JSON.stringify(normalizarEquiv(a)) ===
    JSON.stringify(normalizarEquiv(b));
}

async function procesarEquivalentes(texto) {
  const lines = lineasValidas(texto);

  if (!lines.length) {
    return {
      leidos: 0,
      cambios: 0,
      actualizados: 0,
      detalle: "Archivo vacío"
    };
  }

  const mapSets = new Map();

  for (const line of lines) {
    const cols = tokenizarLinea(line);

    if (cols.length >= 2) {
      const principal = normalizarCodigo(cols[0]);
      const equiv = normalizarCodigo(cols[1]);

      if (principal && equiv && principal !== equiv) {
        if (!mapSets.has(principal)) {
          mapSets.set(principal, new Set());
        }

        mapSets.get(principal).add(equiv);
      }
    }
  }

  const updates = [];

  for (const [codigo, set] of mapSets.entries()) {
    const actual = firebaseMap.get(codigo);
    if (!actual) continue;

    const actuales =
      normalizarEquiv(actual.codigosEquivalentes || [])
        .filter(x => x !== codigo);

    const nuevos =
      normalizarEquiv([...set])
        .filter(x => x !== codigo);

    const mezclado =
      normalizarEquiv([...actuales, ...nuevos])
        .filter(x => x !== codigo);

    if (!arraysEquivIguales(actuales, mezclado)) {
      updates.push({
        tipo: "update",
        ref: actual.ref,
        codigo,
        payload: {
          codigosEquivalentes: mezclado
        }
      });
    }
  }

  const r = await actualizarPorLotes(updates);

  return {
    leidos: mapSets.size,
    cambios: updates.length,
    actualizados: r.actualizados,
    detalle:
      `${mapSets.size} productos con equivalentes, ` +
      `${updates.length} con cambios`
  };
}

async function procesar(handles) {
  const {
    articulosHandle,
    preciosHandle,
    equivalentesHandle
  } = handles;

  const productosTxt = await leerHandle(articulosHandle);
  const preciosTxt = await leerHandle(preciosHandle);
  const equivalentesTxt = await leerHandle(equivalentesHandle);

  const totalLineas =
    lineasValidas(productosTxt).length +
    lineasValidas(preciosTxt).length +
    lineasValidas(equivalentesTxt).length;

  if (totalLineas === 0) {
    return {
      ok: true,
      mensaje: "Los tres archivos están vacíos. No se procesó nada.",
      resumen: {
        productosLeidos: 0,
        productosNuevos: 0,
        productosReactivados: 0,
        preciosLeidos: 0,
        equivalentesLeidos: 0,
        productosCambios: 0,
        preciosCambios: 0,
        equivCambios: 0,
        actualizados: 0,
        archivosReset: false
      },
      detalle: [
        {
          etapa: "Validación",
          estado: "OK",
          detalle: "Los tres archivos están vacíos."
        }
      ]
    };
  }

  const totalCatalogo = await descargarCatalogo();
  const rProductos = await procesarProductos(productosTxt);

  if (rProductos.altas > 0 || rProductos.reactivados > 0) {
    await descargarCatalogo();
  }

  const rPrecios = await procesarPrecios(preciosTxt);
  const rEquiv = await procesarEquivalentes(equivalentesTxt);

  const totalActualizados =
    rProductos.actualizados +
    rPrecios.actualizados +
    rEquiv.actualizados;

  await vaciarHandle(articulosHandle);
  await vaciarHandle(preciosHandle);
  await vaciarHandle(equivalentesHandle);

  return {
    ok: true,
    mensaje: "Proceso completado correctamente",
    resumen: {
      productosLeidos: rProductos.leidos,
      productosNuevos: rProductos.altas,
      productosReactivados: rProductos.reactivados,
      preciosLeidos: rPrecios.leidos,
      equivalentesLeidos: rEquiv.leidos,
      productosCambios: rProductos.cambios,
      preciosCambios: rPrecios.cambios,
      equivCambios: rEquiv.cambios,
      actualizados: totalActualizados,
      archivosReset: true
    },
    detalle: [
      {
        etapa: "Catálogo Firebase",
        estado: "OK",
        detalle: `${totalCatalogo} documentos descargados`
      },
      {
        etapa: "Productos",
        estado: "OK",
        detalle: rProductos.detalle
      },
      {
        etapa: "Precios por cantidad",
        estado: "OK",
        detalle: rPrecios.detalle
      },
      {
        etapa: "Equivalentes",
        estado: "OK",
        detalle: rEquiv.detalle
      },
      {
        etapa: "Reset",
        estado: "OK",
        detalle: "Los tres archivos fueron vaciados a 0 bytes"
      }
    ]
  };
}

export { procesar };
