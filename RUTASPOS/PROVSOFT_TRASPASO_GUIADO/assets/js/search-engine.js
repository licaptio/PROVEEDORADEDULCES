const indiceProductoCache = new WeakMap();

export function normalizarTexto(valor = "") {
  return String(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tieneLetras(valor = "") {
  return /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(String(valor));
}

function tokensBase(valor) {
  return normalizarTexto(valor).split(" ").filter(Boolean);
}

function variantesToken(token) {
  const t = String(token || "");
  if (!t) return [];

  const partes = t
    .replace(/([A-Z])([0-9])/g, "$1 $2")
    .replace(/([0-9])([A-Z])/g, "$1 $2")
    .split(" ")
    .filter(Boolean);

  return [...new Set([t, ...partes])];
}

function crearIndiceProducto(producto = {}) {
  if (producto && typeof producto === "object" && indiceProductoCache.has(producto)) {
    return indiceProductoCache.get(producto);
  }

  const equivalentes = Array.isArray(producto?.codigosEquivalentes)
    ? producto.codigosEquivalentes.join(" ")
    : "";

  const concepto = normalizarTexto(producto?.concepto || producto?.descripcion || producto?.nombre || "");
  const codigo = normalizarTexto(producto?.codigoBarra || producto?.codigo || "");
  const texto = normalizarTexto(`${concepto} ${codigo} ${equivalentes}`);
  const base = texto.split(" ").filter(Boolean);
  const tokenSet = new Set();

  for (const token of base) {
    for (const variante of variantesToken(token)) tokenSet.add(variante);
  }

  const indice = {
    concepto,
    codigo,
    texto,
    compacto: texto.replace(/\s+/g, ""),
    tokens: [...tokenSet],
    tokenSet
  };

  if (producto && typeof producto === "object") indiceProductoCache.set(producto, indice);
  return indice;
}

function tokenCoincide(qToken, indice) {
  if (indice.tokenSet.has(qToken)) return 3;

  // Permite C6 contra C/6, 33 contra 3.3, etc.
  if (qToken.length >= 2 && indice.compacto.includes(qToken)) return 2;

  // Permite escribir una parte razonable de una palabra: TOKA -> TOKAY.
  if (qToken.length >= 3 && indice.tokens.some(t => t.startsWith(qToken) || qToken.startsWith(t))) return 1;

  return 0;
}

export function puntuarProducto(producto, consulta) {
  const q = normalizarTexto(consulta);
  if (!q) return -1;

  const indice = crearIndiceProducto(producto);
  const qTokensBase = tokensBase(consulta);
  const qTokens = [];
  for (const token of qTokensBase) qTokens.push(...variantesToken(token));

  const tokensUnicos = [...new Set(qTokens)];
  if (!tokensUnicos.length) return -1;

  let calidadTokens = 0;
  for (const token of tokensUnicos) {
    const calidad = tokenCoincide(token, indice);
    if (!calidad) return -1;
    calidadTokens += calidad;
  }

  const qCompacto = q.replace(/\s+/g, "");
  let score = calidadTokens * 700;

  if (indice.concepto === q) score += 12000;
  if (indice.codigo === q) score += 11500;
  if (indice.concepto.startsWith(q)) score += 6500;
  if (indice.concepto.includes(q)) score += 5000;
  if (qCompacto && indice.compacto.includes(qCompacto)) score += 3800;

  // Premia el orden escrito, pero nunca lo exige.
  let cursor = -1;
  let ordenCorrecto = true;
  for (const token of qTokensBase) {
    const pos = indice.texto.indexOf(token, Math.max(0, cursor));
    if (pos >= 0) {
      cursor = pos + token.length;
      score += 350;
    } else {
      ordenCorrecto = false;
    }
  }
  if (ordenCorrecto) score += 800;

  // Resultados con menos texto sobrante aparecen primero.
  score -= Math.max(0, indice.tokens.length - tokensUnicos.length) * 4;
  score -= Math.max(0, indice.concepto.length - q.length) * 0.5;
  return score;
}

export function buscarCoincidencias(productos, consulta, limite = 120) {
  return (productos || [])
    .map(producto => ({ producto, score: puntuarProducto(producto, consulta) }))
    .filter(x => x.score >= 0)
    .sort((a, b) => b.score - a.score || String(a.producto.concepto || "").localeCompare(String(b.producto.concepto || "")))
    .slice(0, limite)
    .map(x => x.producto);
}
