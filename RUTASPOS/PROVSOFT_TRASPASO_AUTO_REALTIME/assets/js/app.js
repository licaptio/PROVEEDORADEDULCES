import { db, collection, query, where, getDocs, addDoc, orderBy } from "./firebase.js";
import { openDB, saveProductos, saveProductoIndividual, getAllProductos, getProductoPorCodigo } from "./db-local.js";
import { iniciarCatalogoEnVivo } from "./catalogo-realtime.js";
import { buscarCoincidencias, tieneLetras } from "./search-engine.js";
import { crearFirma } from "./firma.js";

let carrito = [];
let resultadosBusqueda = [];
let indiceEdicionCantidad = null;
let firmaPaso1;
let firmaPaso2;
let timerBusquedaTexto = null;
let detenerCatalogoEnVivo = null;

const $ = id => document.getElementById(id);

function setCarga(porcentaje, texto, detalle = "") {
  if ($("barraCargaInner")) $("barraCargaInner").style.width = `${Math.max(0, Math.min(100, porcentaje))}%`;
  if ($("textoCarga")) $("textoCarga").textContent = texto || "Cargando...";
  if ($("detalleCarga")) $("detalleCarga").textContent = detalle || "";
}

function mostrarApp() {
  setCarga(100, "Sistema listo", "Entrando a transferencias...");
  setTimeout(() => {
    $("pantallaCarga").style.display = "none";
    $("appPrincipal").style.display = "block";
    $("buscador").focus();
  }, 200);
}

function mostrarErrorCarga(msg) {
  setCarga(100, "Error al cargar la aplicación", msg || "Revise conexión o permisos de Firebase.");
}

function mostrarEstadoBusqueda(msg = "", tipo = "info") {
  const el = $("estadoBusquedaFirebase");
  el.textContent = msg;
  el.className = `estado-busqueda ${tipo}`;
  el.style.display = msg ? "block" : "none";
}

async function syncProductos() {
  try {
    setCarga(28, "Descargando catálogo activo...", "Consultando productos en Firebase");
    const q = query(collection(db, "productos"), where("activo", "==", true));
    const snap = await getDocs(q);
    if (snap.empty) return 0;

    const lista = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setCarga(45, "Guardando catálogo local...", `${lista.length} productos activos`);
    await saveProductos(lista, { reemplazar: true });
    return lista.length;
  } catch (err) {
    console.warn("Error al sincronizar catálogo:", err);
    return 0;
  }
}

function decodificarBalanza(codigo) {
  if (codigo.length === 13 && codigo.startsWith("20")) {
    return {
      esBalanza: true,
      codigoProducto: codigo.substring(0, 7),
      pesoKg: parseFloat(codigo.substring(7, 12)) / 1000
    };
  }
  return { esBalanza: false };
}


async function buscarProductoEnFirebasePorCodigo(codigo) {
  const codigoTxt = String(codigo || "").trim();
  if (!codigoTxt) return null;

  try {
    const qPrincipal = query(
      collection(db, "productos"),
      where("activo", "==", true),
      where("codigoBarra", "==", codigoTxt)
    );
    const snapPrincipal = await getDocs(qPrincipal);
    if (!snapPrincipal.empty) {
      const d = snapPrincipal.docs[0];
      const producto = { id: d.id, ...d.data() };
      await saveProductoIndividual(producto);
      return producto;
    }

    const qEquivalente = query(
      collection(db, "productos"),
      where("activo", "==", true),
      where("codigosEquivalentes", "array-contains", codigoTxt)
    );
    const snapEquivalente = await getDocs(qEquivalente);
    if (!snapEquivalente.empty) {
      const d = snapEquivalente.docs[0];
      const producto = { id: d.id, ...d.data() };
      await saveProductoIndividual(producto);
      return producto;
    }
  } catch (err) {
    console.warn("Error buscando producto puntual en Firebase:", err);
  }
  return null;
}

function seleccionarProducto(data) {
  $("codigoSel").value = data.codigoBarra || "";
  $("conceptoSel").value = data.concepto || "";
  $("precioSel").value = Number(data.precioPublico || 0);
  $("preview").textContent = `${data.concepto || "Sin concepto"} — $${Number(data.precioPublico || 0).toFixed(2)}`;
}

function agregarItem() {
  const codigo = $("codigoSel").value;
  const concepto = $("conceptoSel").value;
  const precio = Number($("precioSel").value || 0);

  let cantidad = 1;
  if (window.pesoDetectado) cantidad = window.pesoDetectado;
  if (window.cantidadManual) cantidad = window.cantidadManual;
  window.cantidadManual = null;

  if (!codigo || cantidad <= 0) return;

  const existente = carrito.find(i => i.codigo === codigo);
  if (existente) {
    existente.cantidad += cantidad;
    carrito = carrito.filter(i => i.codigo !== codigo);
    carrito.unshift(existente);
  } else {
    carrito.unshift({ codigo, concepto, precio, cantidad });
  }

  window.pesoDetectado = null;
  persistirCarrito();
  renderTabla();
}

function persistirCarrito() {
  localStorage.setItem("carrito_traspaso", JSON.stringify(carrito));
}

function renderTabla() {
  const tabla = $("tabla");
  tabla.innerHTML = "";

  if (!carrito.length) {
    tabla.innerHTML = `<tr><td colspan="5" class="tabla-vacia">Aún no hay artículos en el traspaso.</td></tr>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  carrito.forEach((it, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="codigo-cell">${it.codigo}</td>
      <td>${it.concepto}</td>
      <td class="cantidad-cell">
        <span>${Number(it.cantidad).toLocaleString("es-MX", { maximumFractionDigits: 3 })}</span>
        <button class="btn-icon btn-editar" data-index="${i}" title="Editar cantidad">✎</button>
      </td>
      <td>$${Number(it.precio).toFixed(2)}</td>
      <td><button class="btn-icon btn-eliminar" data-index="${i}" title="Eliminar">×</button></td>`;
    fragment.appendChild(tr);
  });
  tabla.appendChild(fragment);
}

function abrirModalBusqueda(consultaInicial = "") {
  $("modalResultados").style.display = "flex";
  $("busquedaNombre").value = consultaInicial;
  renderCoincidencias(consultaInicial);
  setTimeout(() => {
    $("busquedaNombre").focus();
    $("busquedaNombre").setSelectionRange($("busquedaNombre").value.length, $("busquedaNombre").value.length);
  }, 30);
}

function cerrarModalBusqueda() {
  $("modalResultados").style.display = "none";
  $("buscador").value = "";
  $("buscador").focus();
}

function renderCoincidencias(consulta) {
  const contenedor = $("listaResultados");
  const texto = String(consulta || "").trim();
  contenedor.innerHTML = "";

  if (!texto) {
    contenedor.innerHTML = `<div class="resultado-vacio">Escribe parte del nombre. Ejemplo: <b>BIG C/6</b></div>`;
    $("contadorResultados").textContent = "";
    return;
  }

  const filtrados = buscarCoincidencias(resultadosBusqueda, texto, 60);
  $("contadorResultados").textContent = `${filtrados.length} coincidencia${filtrados.length === 1 ? "" : "s"}`;

  if (!filtrados.length) {
    contenedor.innerHTML = `<div class="resultado-vacio">No encontré coincidencias para <b>${escapeHtml(texto)}</b>.</div>`;
    return;
  }

  filtrados.forEach(prod => {
    const div = document.createElement("button");
    div.type = "button";
    div.className = "resultado-item";
    div.innerHTML = `
      <span class="resultado-concepto">${escapeHtml(prod.concepto || "Sin concepto")}</span>
      <span class="resultado-meta">Código: ${escapeHtml(prod.codigoBarra || "")} · $${Number(prod.precioPublico || 0).toFixed(2)}</span>`;
    div.addEventListener("click", () => {
      seleccionarProducto(prod);
      agregarItem();
      cerrarModalBusqueda();
      $("preview").textContent = "";
    });
    contenedor.appendChild(div);
  });
}

function escapeHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function procesarBuscadorPrincipal() {
  const valorOriginal = $("buscador").value.trim();
  if (!valorOriginal) return;

  // Si hay letras, la intención es búsqueda por descripción y se abre modal.
  if (tieneLetras(valorOriginal)) {
    resultadosBusqueda = await getAllProductos();
    abrirModalBusqueda(valorOriginal);
    return;
  }

  let codigo = valorOriginal;
  const bal = decodificarBalanza(codigo);
  if (bal.esBalanza) {
    codigo = bal.codigoProducto;
    window.pesoDetectado = bal.pesoKg;
  } else {
    window.pesoDetectado = null;
  }

  mostrarEstadoBusqueda();
  // Código exacto/equivalente se resuelve directo por índices de IndexedDB.
  // No recorre todo el catálogo en cada escaneo.
  let encontrado = await getProductoPorCodigo(codigo);

  if (!encontrado) {
    mostrarEstadoBusqueda("No está en catálogo local. Buscando en Firebase...", "aviso");
    encontrado = await buscarProductoEnFirebasePorCodigo(codigo);
  }

  if (!encontrado) {
    mostrarEstadoBusqueda(`Artículo no encontrado: ${valorOriginal}`, "error");
    $("preview").textContent = "Artículo no encontrado";
    $("buscador").select();
    return;
  }

  mostrarEstadoBusqueda();
  seleccionarProducto(encontrado);
  agregarItem();
  $("preview").textContent = "";
  $("buscador").value = "";
  $("buscador").focus();
}


async function cargarListaVendedores() {
  const q = query(
    collection(db, "usuarios_ruta"),
    where("rol", "==", "vendedor"),
    where("activo", "==", true)
  );
  const snap = await getDocs(q);
  const select = $("vendedorSelect");
  select.innerHTML = `<option value="">Seleccione vendedor</option>`;

  snap.forEach(doc => {
    const d = doc.data();
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.dataset.nombre = d.nombre || "";
    opt.dataset.ruta = d.rutaId || "";
    opt.textContent = d.nombre || doc.id;
    select.appendChild(opt);
  });
}

function cargarRutasReimpresion() {
  $("rutaReimpresion").innerHTML = `
    <option value="">Seleccione Ruta</option>
    <option value="Almacen_Ruta_1">Almacén Ruta 1</option>
    <option value="Almacen_Ruta_2">Almacén Ruta 2</option>`;
}

async function guardarTraspasoFinal(nombreEntrega, nombreRecibe, firmaEntregaB64, firmaRecibeB64) {
  const vendedorId = $("vendedorSelect").value;
  const rutaId = $("rutaId").value;
  const opt = $("vendedorSelect").selectedOptions[0];

  const payload = {
    vendedorId,
    rutaId,
    fecha: new Date().toISOString(),
    vendedorNombre: opt ? (opt.dataset.nombre || opt.textContent) : "",
    items: carrito,
    firmas: {
      entrega: { nombre: nombreEntrega, pngBase64: firmaEntregaB64 },
      recibe: { nombre: nombreRecibe, pngBase64: firmaRecibeB64 }
    }
  };

  const docRef = await addDoc(collection(db, "almacenes", rutaId, "entradas"), payload);
  $("modalRecibe").style.display = "none";
  firmaPaso1.clear();
  firmaPaso2.clear();
  $("nombreEntregaPaso1").value = "";
  alert("✔ Traspaso enviado correctamente");

  window.open(`impresion_traspaso.html?id=${docRef.id}&ruta=${rutaId}`, "_blank");
  carrito = [];
  renderTabla();
  localStorage.removeItem("carrito_traspaso");
}

function configurarEventos() {
  $("buscador").addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      clearTimeout(timerBusquedaTexto);
      procesarBuscadorPrincipal();
    }
  });
  $("buscador").addEventListener("input", e => {
    clearTimeout(timerBusquedaTexto);
    const valor = e.target.value.trim();
    if (!tieneLetras(valor)) return;

    // Al escribir texto, abre las coincidencias automáticamente sin estorbar al escáner.
    timerBusquedaTexto = setTimeout(async () => {
      resultadosBusqueda = await getAllProductos();
      abrirModalBusqueda($("buscador").value.trim());
    }, 260);
  });
  $("busquedaNombre").addEventListener("input", e => renderCoincidencias(e.target.value));
  $("busquedaNombre").addEventListener("keydown", e => {
    if (e.key === "Escape") cerrarModalBusqueda();
  });
  $("cerrarModal").addEventListener("click", cerrarModalBusqueda);
  $("modalResultados").addEventListener("click", e => {
    if (e.target === $("modalResultados")) cerrarModalBusqueda();
  });

  $("tabla").addEventListener("click", e => {
    const editar = e.target.closest(".btn-editar");
    const eliminar = e.target.closest(".btn-eliminar");
    if (editar) {
      const index = Number(editar.dataset.index);
      const item = carrito[index];
      if (item.cantidad % 1 !== 0) return alert("Cantidad por balanza, no editable");
      indiceEdicionCantidad = index;
      $("inputCantidadNombre").value = item.cantidad;
      $("modalCantidad").style.display = "flex";
      setTimeout(() => { $("inputCantidadNombre").focus(); $("inputCantidadNombre").select(); }, 30);
    }
    if (eliminar) {
      carrito.splice(Number(eliminar.dataset.index), 1);
      persistirCarrito();
      renderTabla();
    }
  });

  $("btnAceptarCantidad").addEventListener("click", () => {
    const nuevaCantidad = Number($("inputCantidadNombre").value);
    if (!nuevaCantidad || nuevaCantidad <= 0) return alert("Cantidad inválida");
    if (indiceEdicionCantidad !== null) {
      carrito[indiceEdicionCantidad].cantidad = nuevaCantidad;
      indiceEdicionCantidad = null;
      persistirCarrito();
      renderTabla();
    } else {
      window.cantidadManual = nuevaCantidad;
      agregarItem();
    }
    $("modalCantidad").style.display = "none";
  });
  $("btnCancelarCantidad").addEventListener("click", () => {
    indiceEdicionCantidad = null;
    $("modalCantidad").style.display = "none";
  });

  $("vendedorSelect").addEventListener("change", e => {
    const opt = e.target.selectedOptions[0];
    $("rutaId").value = opt?.dataset.ruta || "";
  });

  $("btnTraspaso").addEventListener("click", () => {
    const vendedorId = $("vendedorSelect").value;
    const rutaId = $("rutaId").value;
    if (!vendedorId) return alert("Seleccione un vendedor");
    if (!rutaId) return alert("Este vendedor no tiene rutaId asignado");
    if (!carrito.length) return alert("Agregue productos antes de finalizar el traspaso");

    const opt = $("vendedorSelect").selectedOptions[0];
    $("nombreRecibePaso2").value = opt ? (opt.dataset.nombre || opt.textContent) : "";
    $("modalEntrega").style.display = "flex";
    setTimeout(() => firmaPaso1.resize(), 30);
  });

  $("btnLimpiarPaso1").addEventListener("click", () => firmaPaso1.clear());
  $("btnLimpiarPaso2").addEventListener("click", () => firmaPaso2.clear());
  $("btnContinuarPaso1").addEventListener("click", () => {
    const nombre = $("nombreEntregaPaso1").value.trim();
    if (!nombre) return alert("Escriba el nombre de quien entrega");
    if (!firmaPaso1.hasInk()) return alert("Falta la firma");
    $("modalEntrega").style.display = "none";
    $("modalRecibe").style.display = "flex";
    setTimeout(() => firmaPaso2.resize(), 30);
  });
  $("btnCancelarPaso2").addEventListener("click", () => {
    firmaPaso2.clear();
    $("modalRecibe").style.display = "none";
  });
  $("btnConfirmarPaso2").addEventListener("click", async () => {
    if (!firmaPaso2.hasInk()) return alert("Falta la firma del vendedor");
    await guardarTraspasoFinal(
      $("nombreEntregaPaso1").value.trim(),
      $("nombreRecibePaso2").value.trim(),
      firmaPaso1.getBase64(),
      firmaPaso2.getBase64()
    );
  });

  $("btnReimpresion").addEventListener("click", () => {
    cargarRutasReimpresion();
    $("modalReimpresion").style.display = "flex";
  });
  $("cerrarReimpresion").addEventListener("click", () => $("modalReimpresion").style.display = "none");
  $("rutaReimpresion").addEventListener("change", async e => {
    const rutaId = e.target.value.trim();
    if (!rutaId) return;
    const contenedor = $("listaReimpresion");
    contenedor.innerHTML = `<div class="resultado-vacio">Consultando...</div>`;
    try {
      const snap = await getDocs(query(collection(db, "almacenes", rutaId, "entradas"), orderBy("fecha", "desc")));
      contenedor.innerHTML = "";
      if (snap.empty) {
        contenedor.innerHTML = `<div class="resultado-vacio">No hay traspasos</div>`;
        return;
      }
      snap.forEach(doc => {
        const d = doc.data();
        const btn = document.createElement("button");
        btn.className = "reimpresion-item";
        btn.innerHTML = `<b>${new Date(d.fecha).toLocaleString("es-MX")}</b><span>${escapeHtml(d.vendedorNombre || "Sin vendedor")}</span>`;
        btn.addEventListener("click", () => window.open(`impresion_traspaso.html?id=${doc.id}&ruta=${rutaId}`, "_blank"));
        contenedor.appendChild(btn);
      });
    } catch (err) {
      contenedor.innerHTML = `<div class="resultado-vacio error-text">${escapeHtml(err.message)}</div>`;
    }
  });
}

async function init() {
  try {
    setCarga(8, "Iniciando PROVSOFT...", "Preparando módulo de traspasos");
    firmaPaso1 = crearFirma($("canvasEntregaPaso1"));
    firmaPaso2 = crearFirma($("canvasRecibePaso2"));
    configurarEventos();

    setCarga(18, "Abriendo catálogo local...", "Validando IndexedDB");
    await openDB();
    const productosLocales = await getAllProductos();

    // Descarga completa únicamente cuando este navegador todavía no tiene catálogo.
    // A partir de ahí, Firestore mantiene IndexedDB actualizado en vivo.
    if (productosLocales.length === 0) {
      const totalSync = await syncProductos();
      if (totalSync > 0) localStorage.setItem("ultima_sync_productos", String(Date.now()));
    } else {
      setCarga(45, "Catálogo local disponible", `${productosLocales.length} productos; activando actualización en vivo`);
    }

    resultadosBusqueda = await getAllProductos();

    // Listener permanente: actualiza/agrega/elimina únicamente los productos que cambian.
    // Si cambia codigoBarra, db-local elimina la clave anterior antes de guardar la nueva.
    detenerCatalogoEnVivo = await iniciarCatalogoEnVivo({
      onCambios: async cambios => {
        resultadosBusqueda = await getAllProductos();
        console.info(`[Catálogo en vivo] ${cambios} cambio(s) aplicado(s) en IndexedDB`);

        // Si el modal de descripción está abierto, refresca sus resultados sin cerrarlo.
        if ($("modalResultados").style.display === "flex") {
          renderCoincidencias($("busquedaNombre").value);
        }
      },
      onEstado: ({ conectado }) => {
        console.info(conectado ? "[Catálogo en vivo] conectado" : "[Catálogo en vivo] desconectado");
      },
      onError: err => {
        console.warn("No se pudo mantener el catálogo en vivo; la búsqueda local continúa disponible.", err);
      }
    });

    setCarga(62, "Cargando vendedores...", "Consultando usuarios activos");
    await cargarListaVendedores();

    setCarga(78, "Restaurando sesión...", "Revisando traspaso pendiente");
    const guardado = localStorage.getItem("carrito_traspaso");
    if (guardado) {
      try { carrito = JSON.parse(guardado) || []; } catch { carrito = []; }
      $("barraSesion").style.display = "block";
      $("barraSesion").textContent = "Sesión anterior recuperada ✓";
    }
    renderTabla();

    setCarga(92, "Preparando interfaz...", "Listo para escanear o escribir producto");
    mostrarApp();
  } catch (err) {
    console.error(err);
    mostrarErrorCarga(err.message || "No se pudo iniciar la aplicación.");
  }
}

window.addEventListener("beforeunload", () => {
  if (typeof detenerCatalogoEnVivo === "function") detenerCatalogoEnVivo();
});

document.addEventListener("DOMContentLoaded", init);
