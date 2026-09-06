import { db } from "../firebase/config.js";
import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  resolverProductoPorCodigo,
  catalogo
} from "../catalogo/catalogo.js";

import { agregarProducto } from "../carrito/carrito.js";
import { toast } from "../ui/toast.js";
import { abrirBusquedaManual } from "../busqueda/busquedaManual.js";

export function iniciarScanner() {
  const input = document.getElementById("buscador");
  let timerBusqueda = null;

  if (!input) return;

  input.focus();

  input.addEventListener("input", () => {
    clearTimeout(timerBusqueda);

    const texto = input.value.trim();
    const pareceCodigo = /^\d+$/.test(texto);

    if (texto.length < 2 || pareceCodigo) return;

    timerBusqueda = setTimeout(() => {
      const busqueda = input.value.trim();
      if (busqueda.length < 2 || /^\d+$/.test(busqueda)) return;

      input.value = "";
      abrirBusquedaManual(busqueda);
    }, 350);
  });

  input.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;

    e.preventDefault();
    clearTimeout(timerBusqueda);

    const texto = input.value;
    procesarTexto(texto);
  });
}

function decodificarBalanza(codigo) {
  codigo = String(codigo || "").trim();

  if (!codigo.startsWith("2")) {
    return { esBalanza: false };
  }

  if (codigo.length < 13 || codigo.length > 15) {
    return { esBalanza: false };
  }

  const codigoProducto = codigo.substring(0, 7);
  const pesoBruto = codigo.substring(7, 12);
  const pesoKg = parseFloat(pesoBruto) / 1000;

  return {
    esBalanza: true,
    codigoProducto,
    pesoKg
  };
}

async function buscarEquivalenteRemoto(codigo) {
  try {
    const equivalentesCol = collection(db, "equivalentes");

    const q1 = query(
      equivalentesCol,
      where("codigo_equivalente", "==", codigo)
    );

    const q2 = query(
      equivalentesCol,
      where("codigo_origen", "==", codigo)
    );

    const [snap1, snap2] = await Promise.all([
      getDocs(q1),
      getDocs(q2)
    ]);

    const codigosBusqueda = [codigo];

    snap1.forEach(d => {
      const origen = d.data().codigo_origen;
      if (origen && !codigosBusqueda.includes(origen)) {
        codigosBusqueda.push(origen);
      }
    });

    snap2.forEach(d => {
      const equivalente = d.data().codigo_equivalente;
      if (equivalente && !codigosBusqueda.includes(equivalente)) {
        codigosBusqueda.push(equivalente);
      }
    });

    return catalogo.filter(p => {
      const codPrincipal = String(p.codigo || "").trim();
      const eqs = Array.isArray(p.equivalentes) ? p.equivalentes : [];

      return (
        codigosBusqueda.includes(codPrincipal) ||
        eqs.some(e =>
          codigosBusqueda.includes(String(e).trim())
        )
      );
    });

  } catch (err) {
    console.error("Error buscando equivalente remoto:", err);
    return [];
  }
}

export async function procesarTexto(texto) {
  const input = document.getElementById("buscador");
  const resultados = document.getElementById("resultados");

  const q = String(texto || "").trim();

  if (input) input.value = "";

  if (!q) return;

  const balanza = decodificarBalanza(q);

  if (balanza.esBalanza) {
    await procesarCodigoBalanza(
      balanza,
      input,
      resultados
    );
    return;
  }

  // Un código exacto se agrega de inmediato; cualquier texto abre la búsqueda.
  let producto = resolverProductoPorCodigo(q);

  // Las equivalencias remotas sólo aplican a códigos; una descripción abre
  // inmediatamente el catálogo local para que la captura sea fluida.
  const pareceCodigo = /^\d{4,}$/.test(q);
  if (!producto && pareceCodigo) {
    const remotos = await buscarEquivalenteRemoto(q);
    producto = remotos[0] || null;
  }

  if (producto) {
    agregarProducto(producto, 1);
    toast("Producto agregado");
    limpiarBusqueda(input, resultados);
    return;
  }

  limpiarBusqueda(input, resultados);
  abrirBusquedaManual(q);
}

async function procesarCodigoBalanza(
  balanza,
  input,
  resultados
) {
  let codigoBase = balanza.codigoProducto;

  try {
    const equivalentesCol = collection(db, "equivalentes");

    const qEq = query(
      equivalentesCol,
      where("codigo_equivalente", "==", codigoBase)
    );

    const snap = await getDocs(qEq);

    if (!snap.empty) {
      codigoBase = snap.docs[0].data().codigo_origen;
    }

  } catch (err) {
    console.warn("No se pudo validar equivalencia de báscula:", err);
  }

  let producto = resolverProductoPorCodigo(codigoBase);

  if (!producto) {
    const remotos = await buscarEquivalenteRemoto(codigoBase);
    producto = remotos[0] || null;
  }

  if (!producto) {
    toast("Producto de báscula no registrado");
    limpiarBusqueda(input, resultados);
    return;
  }

  const peso = Number(balanza.pesoKg.toFixed(3));

  agregarProducto(producto, peso);

  toast(`${producto.nombre} ${peso.toFixed(3)} kg`);

  limpiarBusqueda(input, resultados);
}

function limpiarBusqueda(input, resultados) {
  if (input) {
    input.value = "";

    setTimeout(() => {
      input.value = "";
      input.focus();
    }, 30);
  }

  if (resultados) {
    resultados.innerHTML = "";
    resultados.style.display = "none";
  }
}
