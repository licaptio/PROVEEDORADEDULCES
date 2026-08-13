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

function tokens(valor) {
  return normalizarTexto(valor).split(" ").filter(Boolean);
}

function tokensProducto(producto) {
  const equivalentes = Array.isArray(producto?.codigosEquivalentes)
    ? producto.codigosEquivalentes.join(" ")
    : "";
  return tokens(`${producto?.concepto || ""} ${producto?.codigoBarra || ""} ${equivalentes}`);
}

export function puntuarProducto(producto, consulta) {
  const q = normalizarTexto(consulta);
  if (!q) return -1;

  const concepto = normalizarTexto(producto?.concepto || "");
  const codigo = normalizarTexto(producto?.codigoBarra || "");
  const qTokens = tokens(consulta);
  const pTokens = tokensProducto(producto);
  const conjunto = new Set(pTokens);

  // Todas las palabras/partes escritas deben existir como token del producto.
  // Ej.: BIG C/6 => BIG + C + 6 encuentra BIG COLA 3.3 C/6.
  if (!qTokens.every(t => conjunto.has(t))) return -1;

  let score = 0;
  if (concepto === q) score += 10000;
  if (codigo === q) score += 9500;
  if (concepto.startsWith(q)) score += 5000;
  if (concepto.includes(q)) score += 3500;

  // Favorece el orden escrito, pero NO lo exige.
  let ultimaPos = -1;
  let ordenCorrecto = true;
  for (let i = 0; i < qTokens.length; i++) {
    const token = qTokens[i];
    const pos = pTokens.indexOf(token);
    if (pos >= 0) {
      score += 600;
      if (i === 0 && pos === 0) score += 700;
      if (pos < ultimaPos) ordenCorrecto = false;
      ultimaPos = Math.max(ultimaPos, pos);
    }
  }
  if (ordenCorrecto) score += 900;

  // Menos palabras sobrantes = resultado más cercano.
  score -= Math.max(0, pTokens.length - qTokens.length) * 8;
  score -= Math.max(0, concepto.length - q.length);
  return score;
}

export function buscarCoincidencias(productos, consulta, limite = 60) {
  return (productos || [])
    .map(producto => ({ producto, score: puntuarProducto(producto, consulta) }))
    .filter(x => x.score >= 0)
    .sort((a, b) => b.score - a.score || String(a.producto.concepto || "").localeCompare(String(b.producto.concepto || "")))
    .slice(0, limite)
    .map(x => x.producto);
}
