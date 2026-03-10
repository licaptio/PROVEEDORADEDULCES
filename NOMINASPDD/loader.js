import { supabaseUrl, supabaseAnonKey } from "./config.js";

const TABLE_CFDI = "nominas_pdd_cfdi";
const TABLE_MOVS = "nominas_pdd_movimientos";
const RFC_EMISOR_PERMITIDO = "PDD031204KL5";

const CFDI_BATCH = 300;
const MOVS_BATCH = 1200;

let cancelado = false;

const $files = document.getElementById("files");
const $btnCargar = document.getElementById("btnCargar");
const $btnLimpiarLog = document.getElementById("btnLimpiarLog");
const $btnCancelar = document.getElementById("btnCancelar");
const $bar = document.getElementById("bar");
const $log = document.getElementById("log");
const $status = document.getElementById("status");

const $kpiArchivos = document.getElementById("kpiArchivos");
const $kpiCfdi = document.getElementById("kpiCfdi");
const $kpiMovs = document.getElementById("kpiMovs");
const $kpiDup = document.getElementById("kpiDup");
const $kpiErr = document.getElementById("kpiErr");

$btnCargar?.addEventListener("click", procesar);
$btnLimpiarLog?.addEventListener("click", () => {
  if ($log) $log.textContent = "";
});
$btnCancelar?.addEventListener("click", () => {
  cancelado = true;
  log("⚠️ Cancelación solicitada...");
});

function headers(extra = {}) {
  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
    ...extra
  };
}

function log(msg) {
  if (!$log) return;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  $log.textContent += `[${hh}:${mm}:${ss}] ${msg}\n`;
  $log.scrollTop = $log.scrollHeight;
}

function setStatus(msg) {
  if ($status) $status.textContent = msg;
}

function setProgress(val) {
  if ($bar) $bar.style.width = `${Math.max(0, Math.min(100, val))}%`;
}

function attr(node, name) {
  if (!node) return null;
  const v = node.getAttribute(name);
  return v === "" ? null : v;
}

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function childrenOf(node) {
  return node ? Array.from(node.children || []) : [];
}

function findDirectChild(node, localName) {
  return childrenOf(node).find(n => n.localName === localName) || null;
}

function findAll(root, localName) {
  if (!root) return [];
  return Array.from(root.getElementsByTagName("*")).filter(n => n.localName === localName);
}

function nodeAttrs(node) {
  if (!node) return null;
  const obj = {};
  for (const a of Array.from(node.attributes || [])) {
    obj[a.name] = a.value;
  }
  return obj;
}

function xmlHasParserError(xmlDoc) {
  return xmlDoc.getElementsByTagName("parsererror").length > 0;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function normalizeTextPart(v) {
  return String(v ?? "")
    .trim()
    .replace(/\|/g, "/")
    .replace(/\s+/g, " ");
}

function normalizeNumPart(v) {
  const n = toNumber(v);
  return n === null ? "" : String(n);
}

function buildMovKey(row) {
  return [
    row.uuid_cfdi,
    row.tipo_movimiento,
    row.tipo_nomina,
    row.tipo_codigo,
    row.clave,
    row.concepto,
    normalizeNumPart(row.importe_gravado),
    normalizeNumPart(row.importe_exento),
    normalizeNumPart(row.importe)
  ].map(normalizeTextPart).join("|");
}

function classifyProvsoft(tipoMov, tipoCodigo, concepto, tipoNomina) {
  const c = (concepto || "").toLowerCase().trim();

  if (tipoMov === "PERCEPCION") {
    if (tipoCodigo === "003" || c.includes("utilidad")) return "UTILIDADES";
    if (c.includes("aguinaldo")) return "AGUINALDO";
    if (tipoCodigo === "021" || c.includes("prima vacacional")) return "PRIMA_VACACIONAL";
    if (tipoCodigo === "019" || c.includes("hora extra")) return "HORAS_EXTRA";
    if (tipoCodigo === "022" || c.includes("prima dominical")) return "PRIMA_DOMINICAL";
    if (tipoCodigo === "001" && tipoNomina === "O") return "SUELDO";
    if (tipoCodigo === "001" && tipoNomina === "E") return c.includes("aguinaldo") ? "AGUINALDO" : "PERCEPCION_EXTRAORDINARIA";
    return "PERCEPCION_OTRA";
  }

  if (tipoMov === "DEDUCCION") {
    if (tipoCodigo === "002" || c.includes("isr")) return "ISR";
    if (tipoCodigo === "001" || c.includes("i.m.s.s") || c.includes("imss")) return "IMSS";
    return "DEDUCCION_OTRA";
  }

  if (tipoMov === "OTRO_PAGO") {
    if (tipoCodigo === "002" || c.includes("subsid")) return "SUBSIDIO_EMPLEO";
    if (tipoCodigo === "999" || c.includes("ajuste")) return "AJUSTE_NETO";
    return "OTRO_PAGO";
  }

  return "SIN_CLASIFICAR";
}

function buildJsonRaw({
  fileName,
  comp,
  emisorCfdi,
  receptorCfdi,
  nomina,
  emisorNomina,
  receptorNomina,
  percepciones,
  deducciones,
  otrosPagos,
  timbre
}) {
  return {
    archivo: fileName,
    comprobante: nodeAttrs(comp),
    emisor_cfdi: nodeAttrs(emisorCfdi),
    receptor_cfdi: nodeAttrs(receptorCfdi),
    nomina: nodeAttrs(nomina),
    emisor_nomina: nodeAttrs(emisorNomina),
    receptor_nomina: nodeAttrs(receptorNomina),
    percepciones: percepciones.map(nodeAttrs),
    deducciones: deducciones.map(nodeAttrs),
    otros_pagos: otrosPagos.map(op => ({
      ...nodeAttrs(op),
      subsidio_al_empleo: nodeAttrs(findDirectChild(op, "SubsidioAlEmpleo")),
      compensacion_saldos_a_favor: nodeAttrs(findDirectChild(op, "CompensacionSaldosAFavor"))
    })),
    timbre_fiscal_digital: nodeAttrs(timbre)
  };
}

function parseNominaXml(xmlText, fileName) {
  const xml = new DOMParser().parseFromString(xmlText, "application/xml");

  if (xmlHasParserError(xml)) {
    throw new Error("XML inválido o mal formado");
  }

  const comp = (xml.documentElement && xml.documentElement.localName === "Comprobante")
    ? xml.documentElement
    : findAll(xml, "Comprobante")[0];

  if (!comp) throw new Error("No se encontró Comprobante");

  const tipoDeComprobante = attr(comp, "TipoDeComprobante");
  if (tipoDeComprobante !== "N") {
    throw new Error(`No es CFDI de nómina. TipoDeComprobante=${tipoDeComprobante || "?"}`);
  }

  const emisorCfdi = findDirectChild(comp, "Emisor");
  const receptorCfdi = findDirectChild(comp, "Receptor");
  const complemento = findDirectChild(comp, "Complemento");

  const nomina = findAll(complemento || comp, "Nomina")[0];
  if (!nomina) throw new Error("No se encontró complemento Nomina");

  const timbre = findAll(complemento || comp, "TimbreFiscalDigital")[0];
  if (!timbre) throw new Error("No se encontró TimbreFiscalDigital");

  const emisorNomina = findDirectChild(nomina, "Emisor");
  const receptorNomina = findDirectChild(nomina, "Receptor");

  const percepciones = findAll(nomina, "Percepcion");
  const deducciones = findAll(nomina, "Deduccion");
  const otrosPagos = findAll(nomina, "OtroPago");

  const uuid = attr(timbre, "UUID");
  if (!uuid) throw new Error("No se encontró UUID");

  const rfcEmisor = attr(emisorCfdi, "Rfc");
  if (rfcEmisor !== RFC_EMISOR_PERMITIDO) {
    throw new Error(`RFC emisor no permitido: ${rfcEmisor || "SIN_RFC"}`);
  }

  const tipoNomina = attr(nomina, "TipoNomina") || "O";
  const fechaPago = attr(nomina, "FechaPago");

  const cfdiRow = {
    uuid_cfdi: uuid,

    serie: attr(comp, "Serie"),
    folio: attr(comp, "Folio"),

    rfc_emisor: rfcEmisor,
    nombre_emisor: attr(emisorCfdi, "Nombre"),

    rfc_receptor: attr(receptorCfdi, "Rfc"),
    nombre_receptor: attr(receptorCfdi, "Nombre"),

    curp: attr(receptorNomina, "Curp"),
    num_empleado: attr(receptorNomina, "NumEmpleado"),

    departamento: attr(receptorNomina, "Departamento"),
    puesto: attr(receptorNomina, "Puesto"),

    registro_patronal: attr(emisorNomina, "RegistroPatronal"),

    fecha_emision: attr(comp, "Fecha"),
    fecha_timbrado: attr(timbre, "FechaTimbrado"),

    fecha_pago: fechaPago,
    fecha_inicio_pago: attr(nomina, "FechaInicialPago"),
    fecha_fin_pago: attr(nomina, "FechaFinalPago"),

    tipo_nomina: tipoNomina,
    periodicidad_pago: attr(receptorNomina, "PeriodicidadPago"),

    salario_base: toNumber(attr(receptorNomina, "SalarioBaseCotApor")),
    salario_diario_integrado: toNumber(attr(receptorNomina, "SalarioDiarioIntegrado")),

    total_percepciones: toNumber(attr(nomina, "TotalPercepciones")),
    total_deducciones: toNumber(attr(nomina, "TotalDeducciones")),
    total_otros_pagos: toNumber(attr(nomina, "TotalOtrosPagos")),

    subtotal: toNumber(attr(comp, "SubTotal")),
    descuento: toNumber(attr(comp, "Descuento")),
    total: toNumber(attr(comp, "Total")),

    certificado: attr(comp, "Certificado"),
    no_certificado: attr(comp, "NoCertificado"),
    no_certificado_sat: attr(timbre, "NoCertificadoSAT"),
    rfc_pac: attr(timbre, "RfcProvCertif"),

    xml_raw: xmlText,
    json_raw: buildJsonRaw({
      fileName,
      comp,
      emisorCfdi,
      receptorCfdi,
      nomina,
      emisorNomina,
      receptorNomina,
      percepciones,
      deducciones,
      otrosPagos,
      timbre
    })
  };

  const baseMov = {
    uuid_cfdi: uuid,
    num_empleado: attr(receptorNomina, "NumEmpleado"),
    nombre_empleado: attr(receptorCfdi, "Nombre"),
    departamento: attr(receptorNomina, "Departamento"),
    puesto: attr(receptorNomina, "Puesto"),
    tipo_nomina: tipoNomina,
    fecha_pago: fechaPago
  };

  const movRows = [];

  for (const p of percepciones) {
    const importeGravado = toNumber(attr(p, "ImporteGravado")) || 0;
    const importeExento = toNumber(attr(p, "ImporteExento")) || 0;
    const importe = toNumber(attr(p, "Importe"));
    const row = {
      ...baseMov,
      tipo_movimiento: "PERCEPCION",
      tipo_codigo: attr(p, "TipoPercepcion"),
      clave: attr(p, "Clave"),
      concepto: attr(p, "Concepto"),
      importe_gravado: importeGravado || null,
      importe_exento: importeExento || null,
      importe: importe !== null ? importe : (importeGravado + importeExento)
    };
    row.mov_key = buildMovKey(row);
    movRows.push(row);
  }

  for (const d of deducciones) {
    const row = {
      ...baseMov,
      tipo_movimiento: "DEDUCCION",
      tipo_codigo: attr(d, "TipoDeduccion"),
      clave: attr(d, "Clave"),
      concepto: attr(d, "Concepto"),
      importe_gravado: null,
      importe_exento: null,
      importe: toNumber(attr(d, "Importe"))
    };
    row.mov_key = buildMovKey(row);
    movRows.push(row);
  }

  for (const o of otrosPagos) {
    const row = {
      ...baseMov,
      tipo_movimiento: "OTRO_PAGO",
      tipo_codigo: attr(o, "TipoOtroPago"),
      clave: attr(o, "Clave"),
      concepto: attr(o, "Concepto"),
      importe_gravado: null,
      importe_exento: null,
      importe: toNumber(attr(o, "Importe"))
    };
    row.mov_key = buildMovKey(row);
    movRows.push(row);
  }

  const resumen = movRows.reduce((acc, r) => {
    const cat = classifyProvsoft(r.tipo_movimiento, r.tipo_codigo, r.concepto, r.tipo_nomina);
    acc[cat] = (acc[cat] || 0) + (r.importe || 0);
    return acc;
  }, {});

  return {
    uuid,
    fileName,
    tipoNomina,
    cfdiRow,
    movRows,
    resumen
  };
}

async function upsertBatches(table, rows, batchSize, onConflict, progressStart, progressEnd) {
  if (!rows.length) return;

  const batches = chunk(rows, batchSize);

  for (let i = 0; i < batches.length; i++) {
    if (cancelado) throw new Error("Proceso cancelado");

    const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
    if (onConflict) {
      url.searchParams.set("on_conflict", onConflict);
    }

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: headers({
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal"
      }),
      body: JSON.stringify(batches[i])
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Error en ${table}: ${txt}`);
    }

    const p = progressStart + ((i + 1) / batches.length) * (progressEnd - progressStart);
    setProgress(p);
    log(`✅ ${table} lote ${i + 1}/${batches.length} (${batches[i].length} registros)`);
    await sleep(10);
  }
}

async function procesar() {
  cancelado = false;
  setProgress(0);

  const files = Array.from($files?.files || []);
  if (!files.length) {
    alert("Selecciona XML");
    return;
  }

  $kpiArchivos && ($kpiArchivos.textContent = String(files.length));
  $kpiCfdi && ($kpiCfdi.textContent = "0");
  $kpiMovs && ($kpiMovs.textContent = "0");
  $kpiDup && ($kpiDup.textContent = "0");
  $kpiErr && ($kpiErr.textContent = "0");

  setStatus("Leyendo XML...");
  log(`🚀 Inicio de carga: ${files.length} archivo(s)`);

  const parsed = [];
  const localSeen = new Set();

  let errores = 0;
  let duplicadosLocales = 0;
  let ordinarias = 0;
  let extraordinarias = 0;

  let totalSueldos = 0;
  let totalAguinaldo = 0;
  let totalUtilidades = 0;

  for (let i = 0; i < files.length; i++) {
    if (cancelado) {
      log("⛔ Cancelado por usuario");
      setStatus("Cancelado");
      return;
    }

    const file = files[i];

    try {
      const text = await file.text();
      const item = parseNominaXml(text, file.name);

      if (localSeen.has(item.uuid)) {
        duplicadosLocales++;
        log(`⚠️ UUID repetido en selección local: ${item.uuid} | ${file.name}`);
      } else {
        localSeen.add(item.uuid);
        parsed.push(item);

        if (item.tipoNomina === "E") extraordinarias++;
        else ordinarias++;

        totalSueldos += item.resumen.SUELDO || 0;
        totalAguinaldo += item.resumen.AGUINALDO || 0;
        totalUtilidades += item.resumen.UTILIDADES || 0;

        log(`📄 OK ${file.name} | UUID ${item.uuid} | TipoNomina ${item.tipoNomina} | Movs ${item.movRows.length}`);
      }
    } catch (err) {
      errores++;
      log(`❌ ${file.name}: ${err.message}`);
    }

    setProgress(((i + 1) / files.length) * 45);
    setStatus(`Parseando ${i + 1}/${files.length}...`);
  }

  $kpiDup && ($kpiDup.textContent = String(duplicadosLocales));
  $kpiErr && ($kpiErr.textContent = String(errores));

  if (!parsed.length) {
    setStatus("No hubo XML válidos");
    log("❌ No hubo XML válidos para cargar");
    return;
  }

  const cfdiRows = parsed.map(x => x.cfdiRow);
  const movRows = parsed.flatMap(x => x.movRows);

  $kpiCfdi && ($kpiCfdi.textContent = String(cfdiRows.length));
  $kpiMovs && ($kpiMovs.textContent = String(movRows.length));

  log(`🧾 CFDI procesados únicos: ${cfdiRows.length}`);
  log(`🧩 Movimientos procesados: ${movRows.length}`);
  log(`📘 Ordinarias: ${ordinarias}`);
  log(`📙 Extraordinarias: ${extraordinarias}`);
  log(`💰 Sueldos detectados: ${totalSueldos.toFixed(2)}`);
  log(`🎄 Aguinaldo detectado: ${totalAguinaldo.toFixed(2)}`);
  log(`🏆 Utilidades detectadas: ${totalUtilidades.toFixed(2)}`);

  setStatus("Upsert CFDI...");
  await upsertBatches(TABLE_CFDI, cfdiRows, CFDI_BATCH, "uuid_cfdi", 45, 72);

  setStatus("Upsert movimientos...");
  await upsertBatches(TABLE_MOVS, movRows, MOVS_BATCH, "mov_key", 72, 100);

  setProgress(100);
  setStatus("Carga finalizada");
  log("🎉 Carga terminada correctamente");
}