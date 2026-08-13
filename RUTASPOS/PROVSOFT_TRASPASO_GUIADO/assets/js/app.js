import { db, collection, query, where, getDocs, addDoc, orderBy } from "./firebase.js";
import { openDB, saveProductos, saveProductoIndividual, getAllProductos, getProductoPorCodigo } from "./db-local.js";
import { iniciarCatalogoEnVivo } from "./catalogo-realtime.js";
import { buscarCoincidencias, tieneLetras } from "./search-engine.js";
import { crearFirma } from "./firma.js";

let carrito = [];
let resultadosBusqueda = [];
let vendedoresCargados = [];
let vendedorSeleccionado = null;
let vendedorModalPendiente = null;
let productoPendiente = null;
let indiceEdicionCantidad = null;
let cantidadEsBalanza = false;
let firmaPaso1;
let firmaPaso2;
let timerBusquedaTexto = null;
let detenerCatalogoEnVivo = null;
let modalProductoDebeReabrir = false;

const STORAGE_CARRITO = "carrito_traspaso";
const STORAGE_VENDEDOR = "vendedor_traspaso";
const $ = id => document.getElementById(id);

function setCarga(porcentaje, texto, detalle = "") {
  if ($("barraCargaInner")) $("barraCargaInner").style.width = `${Math.max(0, Math.min(100, porcentaje))}%`;
  if ($("textoCarga")) $("textoCarga").textContent = texto || "Cargando...";
  if ($("detalleCarga")) $("detalleCarga").textContent = detalle || "";
}

function setEstadoCarga(tipo, estado, detalle, resultado) {
  const fila = tipo === "catalogo" ? $("estadoCargaCatalogo") : $("estadoCargaVendedores");
  const detalleEl = tipo === "catalogo" ? $("detalleCargaCatalogo") : $("detalleCargaVendedores");
  const resultadoEl = tipo === "catalogo" ? $("resultadoCargaCatalogo") : $("resultadoCargaVendedores");
  fila?.classList.remove("ok", "error");
  if (estado) fila?.classList.add(estado);
  if (detalleEl) detalleEl.textContent = detalle || "";
  if (resultadoEl) resultadoEl.textContent = resultado || "";
}

function mostrarApp() {
  setCarga(100, "Sistema listo", "Catálogo y vendedores preparados");
  setTimeout(() => {
    $("pantallaCarga").style.display = "none";
    $("appPrincipal").style.display = "block";
    mostrarVistaOperacion();

    actualizarResumenVendedor();
    if (carrito.length && vendedorSeleccionado) mostrarSesionRecuperada();

    // El flujo siempre inicia confirmando vendedor. Si existe una sesión
    // recuperada, aparece preseleccionado pero el usuario debe pulsar Iniciar.
    abrirModalVendedor({ obligatorio: true });
  }, 220);
}

function mostrarErrorCarga(msg) {
  setCarga(100, "No se pudo iniciar", msg || "Revise conexión o permisos de Firebase.");
}

function mostrarEstadoBusqueda(msg = "", tipo = "info") {
  const el = $("estadoBusquedaFirebase");
  if (!el) return;
  el.textContent = msg;
  el.className = `estado-busqueda ${tipo}`;
  el.style.display = msg ? "block" : "none";
}

function actualizarEstadoCatalogoVivo(conectado) {
  const el = $("estadoCatalogoVivo");
  if (!el) return;
  el.classList.toggle("offline", !conectado);
  el.innerHTML = `<span class="live-dot"></span>${conectado ? "Catálogo en vivo" : "Catálogo local"}`;
}

async function syncProductos() {
  setCarga(22, "Cargando catálogo...", "No existe catálogo local; descargando productos activos");
  setEstadoCarga("catalogo", "", "Descargando desde Firebase...", "Cargando");

  const q = query(collection(db, "productos"), where("activo", "==", true));
  const snap = await getDocs(q);
  const lista = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  if (!lista.length) throw new Error("Firebase no devolvió productos activos para iniciar el catálogo.");

  setCarga(40, "Guardando catálogo local...", `${lista.length.toLocaleString("es-MX")} productos activos`);
  await saveProductos(lista, { reemplazar: true });
  return lista.length;
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

function escapeHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function guardarSesion() {
  localStorage.setItem(STORAGE_CARRITO, JSON.stringify(carrito));
  if (vendedorSeleccionado) {
    localStorage.setItem(STORAGE_VENDEDOR, JSON.stringify(vendedorSeleccionado));
  } else {
    localStorage.removeItem(STORAGE_VENDEDOR);
  }
}

function limpiarSesionCompleta() {
  carrito = [];
  vendedorSeleccionado = null;
  vendedorModalPendiente = null;
  localStorage.removeItem(STORAGE_CARRITO);
  localStorage.removeItem(STORAGE_VENDEDOR);
  $("vendedorSelect").value = "";
  $("rutaId").value = "";
  renderTabla();
  actualizarResumenVendedor();
}

function restaurarSesion() {
  const guardadoCarrito = localStorage.getItem(STORAGE_CARRITO);
  if (guardadoCarrito) {
    try {
      const parsed = JSON.parse(guardadoCarrito);
      carrito = Array.isArray(parsed) ? parsed : [];
    } catch {
      carrito = [];
    }
  }

  const guardadoVendedor = localStorage.getItem(STORAGE_VENDEDOR);
  if (guardadoVendedor) {
    try {
      const parsed = JSON.parse(guardadoVendedor);
      const actual = vendedoresCargados.find(v => v.id === parsed?.id && v.rutaId === parsed?.rutaId);
      if (actual) vendedorSeleccionado = actual;
    } catch {
      vendedorSeleccionado = null;
    }
  }

  // Un carrito recuperado sin vendedor no es seguro porque perdería su destino.
  if (carrito.length && !vendedorSeleccionado) {
    carrito = [];
    localStorage.removeItem(STORAGE_CARRITO);
  }

  if (vendedorSeleccionado) {
    $("vendedorSelect").value = vendedorSeleccionado.id;
    $("rutaId").value = vendedorSeleccionado.rutaId;
  }
}

function mostrarSesionRecuperada() {
  const barra = $("barraSesion");
  if (!barra || !carrito.length || !vendedorSeleccionado) return;
  barra.style.display = "flex";
  barra.textContent = `Sesión recuperada · ${vendedorSeleccionado.nombre} · ${carrito.length} artículo(s) en carrito`;
}

function ocultarSesionRecuperada() {
  if ($("barraSesion")) $("barraSesion").style.display = "none";
}

function actualizarResumenVendedor() {
  const hay = Boolean(vendedorSeleccionado?.id && vendedorSeleccionado?.rutaId);
  $("nombreVendedorResumen").textContent = hay ? vendedorSeleccionado.nombre : "Sin vendedor seleccionado";
  $("rutaVendedorResumen").textContent = hay ? `Ruta destino: ${vendedorSeleccionado.rutaId}` : "Primero selecciona el vendedor y la ruta destino.";
  $("vendedorSelect").value = hay ? vendedorSeleccionado.id : "";
  $("rutaId").value = hay ? vendedorSeleccionado.rutaId : "";
  $("btnAgregarProducto").disabled = !hay;

  $("flowVendedor").classList.toggle("done", hay);
  $("flowVendedor").classList.toggle("active", !hay);
  $("flowVendedorTxt").textContent = hay ? vendedorSeleccionado.nombre : "Pendiente";

  if (!hay) {
    $("flowProducto").classList.remove("active", "done");
    $("flowCantidad").classList.remove("active", "done");
    $("flowFinalizar").classList.remove("active", "done");
  } else if (!carrito.length) {
    $("flowProducto").classList.add("active");
    $("flowProducto").classList.remove("done");
    $("flowCantidad").classList.remove("active", "done");
    $("flowFinalizar").classList.remove("active", "done");
  } else {
    $("flowProducto").classList.add("done");
    $("flowProducto").classList.remove("active");
    $("flowCantidad").classList.add("done");
    $("flowCantidad").classList.remove("active");
    $("flowFinalizar").classList.add("active");
    $("flowFinalizar").classList.remove("done");
  }

  renderTabla();
}

function marcarPasoModal(paso) {
  if (!vendedorSeleccionado) return;
  $("flowVendedor").classList.add("done");
  $("flowVendedor").classList.remove("active");

  if (paso === "producto") {
    $("flowProducto").classList.add("active");
    $("flowProducto").classList.remove("done");
    $("flowCantidad").classList.remove("active");
  } else if (paso === "cantidad") {
    $("flowProducto").classList.add("done");
    $("flowProducto").classList.remove("active");
    $("flowCantidad").classList.add("active");
    $("flowCantidad").classList.remove("done");
  } else if (paso === "finalizar") {
    $("flowProducto").classList.add("done");
    $("flowCantidad").classList.add("done");
    $("flowCantidad").classList.remove("active");
    $("flowFinalizar").classList.add("active");
  }
}

function renderTabla() {
  const tabla = $("tabla");
  if (!tabla) return;
  tabla.innerHTML = "";

  $("contadorArticulos").textContent = String(carrito.length);
  $("productoCartCount").textContent = String(carrito.length);
  const totalUnidades = carrito.reduce((acc, item) => acc + Number(item.cantidad || 0), 0);
  $("contadorUnidades").textContent = totalUnidades.toLocaleString("es-MX", { maximumFractionDigits: 3 });

  const puedeFinalizar = Boolean(vendedorSeleccionado?.id && vendedorSeleccionado?.rutaId) && carrito.length > 0;
  $("btnTraspaso").disabled = !puedeFinalizar;

  if (!carrito.length) {
    tabla.innerHTML = `<tr><td colspan="5" class="tabla-vacia"><b>Carrito vacío.</b><span>Selecciona un vendedor y agrega el primer producto.</span></td></tr>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  carrito.forEach((it, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="codigo-cell">${escapeHtml(it.codigo)}</td>
      <td><b class="product-table-name">${escapeHtml(it.concepto)}</b></td>
      <td class="cantidad-cell">${Number(it.cantidad).toLocaleString("es-MX", { maximumFractionDigits: 3 })}</td>
      <td>$${Number(it.precio).toFixed(2)}</td>
      <td class="actions-cell">
        <button class="btn-icon btn-editar" data-index="${i}" title="Editar cantidad" aria-label="Editar cantidad">✎</button>
        <button class="btn-icon btn-eliminar" data-index="${i}" title="Eliminar" aria-label="Eliminar">×</button>
      </td>`;
    fragment.appendChild(tr);
  });
  tabla.appendChild(fragment);
}

function seleccionarProducto(data) {
  $("codigoSel").value = data.codigoBarra || data.codigo || "";
  $("conceptoSel").value = data.concepto || "";
  $("precioSel").value = Number(data.precioPublico ?? data.precio ?? 0);
  $("preview").textContent = data.concepto || "";
}

function agregarProductoAlCarrito(producto, cantidad) {
  const codigo = String(producto?.codigoBarra || producto?.codigo || "").trim();
  const concepto = producto?.concepto || "";
  const precio = Number(producto?.precioPublico ?? producto?.precio ?? 0);
  if (!codigo || !Number.isFinite(cantidad) || cantidad <= 0) return;

  const existente = carrito.find(i => i.codigo === codigo);
  if (existente) {
    existente.cantidad = Number(existente.cantidad || 0) + cantidad;
    carrito = carrito.filter(i => i.codigo !== codigo);
    carrito.unshift(existente);
  } else {
    carrito.unshift({ codigo, concepto, precio, cantidad });
  }

  guardarSesion();
  ocultarSesionRecuperada();
  renderTabla();
  actualizarResumenVendedor();
}

async function cargarListaVendedores() {
  const q = query(
    collection(db, "usuarios_ruta"),
    where("rol", "==", "vendedor"),
    where("activo", "==", true)
  );
  const snap = await getDocs(q);
  vendedoresCargados = [];

  snap.forEach(doc => {
    const d = doc.data();
    vendedoresCargados.push({
      id: doc.id,
      nombre: d.nombre || doc.id,
      rutaId: d.rutaId || ""
    });
  });

  vendedoresCargados.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  renderVendedoresModal();
  return vendedoresCargados.length;
}

function renderVendedoresModal() {
  const contenedor = $("listaVendedoresModal");
  contenedor.innerHTML = "";

  if (!vendedoresCargados.length) {
    contenedor.innerHTML = `<div class="resultado-vacio">No hay vendedores activos.</div>`;
    return;
  }

  vendedoresCargados.forEach(vendedor => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "vendor-choice";
    btn.dataset.id = vendedor.id;
    btn.disabled = !vendedor.rutaId;
    btn.innerHTML = `
      <span class="vendor-choice-avatar">${escapeHtml((vendedor.nombre || "V").slice(0, 1).toUpperCase())}</span>
      <span class="vendor-choice-copy">
        <b>${escapeHtml(vendedor.nombre)}</b>
        <small>${vendedor.rutaId ? `Ruta: ${escapeHtml(vendedor.rutaId)}` : "Sin rutaId configurado"}</small>
      </span>
      <span class="vendor-choice-check">✓</span>`;

    btn.addEventListener("click", () => {
      if (!vendedor.rutaId) return;
      vendedorModalPendiente = vendedor;
      document.querySelectorAll(".vendor-choice").forEach(el => el.classList.toggle("selected", el.dataset.id === vendedor.id));
      $("vendedorModalNombre").textContent = vendedor.nombre;
      $("vendedorModalRuta").textContent = vendedor.rutaId;
      $("vendedorModalEstado").textContent = "Vendedor listo. Presiona Iniciar para comenzar la captura.";
      $("btnIniciarVendedor").disabled = false;
    });

    contenedor.appendChild(btn);
  });
}

function abrirModalVendedor({ obligatorio = false } = {}) {
  vendedorModalPendiente = vendedorSeleccionado;
  $("modalVendedor").style.display = "flex";
  $("modalVendedor").dataset.obligatorio = obligatorio || !vendedorSeleccionado ? "1" : "0";
  $("cerrarVendedor").style.visibility = vendedorSeleccionado ? "visible" : "hidden";
  $("btnIniciarVendedor").disabled = !vendedorModalPendiente?.rutaId;

  document.querySelectorAll(".vendor-choice").forEach(el => {
    el.classList.toggle("selected", Boolean(vendedorModalPendiente && el.dataset.id === vendedorModalPendiente.id));
  });

  if (vendedorModalPendiente) {
    $("vendedorModalNombre").textContent = vendedorModalPendiente.nombre;
    $("vendedorModalRuta").textContent = vendedorModalPendiente.rutaId;
    $("vendedorModalEstado").textContent = "Puedes confirmar este vendedor o seleccionar otro.";
  } else {
    $("vendedorModalNombre").textContent = "Ninguno";
    $("vendedorModalRuta").textContent = "—";
    $("vendedorModalEstado").textContent = "Selecciona un vendedor para continuar.";
  }
}

function cerrarModalVendedor() {
  if (!vendedorSeleccionado) return;
  $("modalVendedor").style.display = "none";
}

function confirmarVendedor() {
  if (!vendedorModalPendiente?.rutaId) return;

  if (carrito.length && vendedorSeleccionado && vendedorSeleccionado.id !== vendedorModalPendiente.id) {
    alert("No se puede cambiar de vendedor mientras el carrito tenga productos. Vacía el carrito o termina el traspaso actual.");
    return;
  }

  vendedorSeleccionado = { ...vendedorModalPendiente };
  $("vendedorSelect").value = vendedorSeleccionado.id;
  $("rutaId").value = vendedorSeleccionado.rutaId;
  guardarSesion();
  $("modalVendedor").style.display = "none";
  actualizarResumenVendedor();
  abrirModalProducto();
}

function resetProductoModal() {
  clearTimeout(timerBusquedaTexto);
  $("buscador").value = "";
  $("codigoSel").value = "";
  $("conceptoSel").value = "";
  $("precioSel").value = "";
  $("preview").textContent = "";
  mostrarEstadoBusqueda();
  $("listaProductosModal").innerHTML = `<div class="resultado-vacio">Escanea un código o escribe parte del nombre del producto.</div>`;
}

function abrirModalProducto() {
  if (!vendedorSeleccionado) {
    abrirModalVendedor({ obligatorio: true });
    return;
  }

  mostrarVistaOperacion();
  resetProductoModal();
  $("productoVendedorContexto").textContent = `Vendedor: ${vendedorSeleccionado.nombre} · ${vendedorSeleccionado.rutaId}`;
  $("productoCartCount").textContent = String(carrito.length);
  $("modalProducto").style.display = "flex";
  marcarPasoModal("producto");
  setTimeout(() => $("buscador").focus(), 40);
}

function cerrarModalProducto() {
  $("modalProducto").style.display = "none";
  clearTimeout(timerBusquedaTexto);
  actualizarResumenVendedor();
}

function renderCoincidenciasProducto(consulta) {
  const contenedor = $("listaProductosModal");
  const texto = String(consulta || "").trim();
  contenedor.innerHTML = "";

  if (!texto) {
    contenedor.innerHTML = `<div class="resultado-vacio">Escanea un código o escribe parte del nombre del producto.</div>`;
    return;
  }

  const filtrados = buscarCoincidencias(resultadosBusqueda, texto, 120);
  if (!filtrados.length) {
    contenedor.innerHTML = `<div class="resultado-vacio">No encontré coincidencias para <b>${escapeHtml(texto)}</b>.</div>`;
    return;
  }

  const resumen = document.createElement("div");
  resumen.className = "resultado-resumen";
  resumen.textContent = `${filtrados.length} coincidencia(s) para “${texto}”`;
  contenedor.appendChild(resumen);

  filtrados.forEach(prod => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "resultado-item";
    btn.innerHTML = `
      <span class="resultado-concepto">${escapeHtml(prod.concepto || "Sin concepto")}</span>
      <span class="resultado-meta">Código: ${escapeHtml(prod.codigoBarra || "")}</span>
      <span class="resultado-precio">$${Number(prod.precioPublico || 0).toFixed(2)}</span>`;
    btn.addEventListener("click", () => seleccionarDesdeProductoModal(prod, 1, false));
    contenedor.appendChild(btn);
  });
}

function seleccionarDesdeProductoModal(producto, cantidadInicial = 1, balanza = false) {
  seleccionarProducto(producto);
  $("modalProducto").style.display = "none";
  abrirCantidadProducto(producto, cantidadInicial, { balanza });
}

async function procesarBuscadorPrincipal() {
  const valorOriginal = $("buscador").value.trim();
  if (!valorOriginal || !vendedorSeleccionado) return;

  // ENTER siempre intenta primero coincidencia exacta local. Esto permite
  // escáneres alfanuméricos sin confundirlos con una búsqueda por texto.
  const exactoLocal = await getProductoPorCodigo(valorOriginal);
  if (exactoLocal) {
    mostrarEstadoBusqueda();
    seleccionarDesdeProductoModal(exactoLocal, 1, false);
    return;
  }

  // Si hay letras, ENTER confirma la búsqueda textual inmediatamente.
  // No bloqueamos al usuario esperando una consulta de red.
  if (tieneLetras(valorOriginal)) {
    renderCoincidenciasProducto(valorOriginal);
    return;
  }

  let codigo = valorOriginal;
  let cantidadInicial = 1;
  let esBalanza = false;
  const bal = decodificarBalanza(codigo);
  if (bal.esBalanza) {
    codigo = bal.codigoProducto;
    cantidadInicial = bal.pesoKg;
    esBalanza = true;
  }

  mostrarEstadoBusqueda("Buscando producto...", "info");
  let encontrado = await getProductoPorCodigo(codigo);

  if (!encontrado) {
    mostrarEstadoBusqueda("No está en catálogo local. Consultando Firebase...", "aviso");
    encontrado = await buscarProductoEnFirebasePorCodigo(codigo);
  }

  if (!encontrado) {
    mostrarEstadoBusqueda(`Artículo no encontrado: ${valorOriginal}`, "error");
    $("buscador").select();
    return;
  }

  mostrarEstadoBusqueda();
  seleccionarDesdeProductoModal(encontrado, cantidadInicial, esBalanza);
}

function abrirCantidadProducto(producto, cantidadInicial = 1, { balanza = false, editarIndex = null } = {}) {
  productoPendiente = producto;
  indiceEdicionCantidad = editarIndex;
  cantidadEsBalanza = balanza;
  modalProductoDebeReabrir = editarIndex === null;

  $("cantidadProductoNombre").textContent = producto?.concepto || "Sin concepto";
  $("cantidadProductoCodigo").textContent = `Código: ${producto?.codigoBarra || producto?.codigo || "—"}`;
  $("inputCantidadNombre").value = Number(cantidadInicial || 1);
  $("inputCantidadNombre").readOnly = balanza;
  $("tituloCantidad").textContent = editarIndex === null ? "Seleccionar cantidad" : "Editar cantidad";
  $("btnAceptarCantidad").textContent = editarIndex === null ? "Agregar al carrito y continuar" : "Guardar cantidad";
  $("notaCantidad").textContent = balanza
    ? "Cantidad detectada por código de balanza."
    : "Selecciona una cantidad rápida o captura manualmente.";

  document.querySelectorAll("#cantidadesRapidas button").forEach(btn => {
    btn.disabled = balanza;
    btn.style.opacity = balanza ? ".45" : "1";
  });

  $("modalCantidad").style.display = "flex";
  marcarPasoModal("cantidad");

  setTimeout(() => {
    $("inputCantidadNombre").focus();
    if (!balanza) $("inputCantidadNombre").select();
  }, 40);
}

function cerrarCantidad({ continuarCaptura = false } = {}) {
  $("modalCantidad").style.display = "none";
  $("inputCantidadNombre").readOnly = false;
  productoPendiente = null;
  indiceEdicionCantidad = null;
  cantidadEsBalanza = false;
  actualizarResumenVendedor();

  if (continuarCaptura && vendedorSeleccionado) {
    setTimeout(() => abrirModalProducto(), 70);
  }
}

function cargarRutasReimpresion() {
  const rutas = [...new Set(vendedoresCargados.map(v => v.rutaId).filter(Boolean))].sort();
  const opciones = [`<option value="">Seleccione ruta</option>`];
  for (const ruta of rutas) opciones.push(`<option value="${escapeHtml(ruta)}">${escapeHtml(ruta)}</option>`);

  if (!rutas.includes("Almacen_Ruta_1")) opciones.push(`<option value="Almacen_Ruta_1">Almacén Ruta 1</option>`);
  if (!rutas.includes("Almacen_Ruta_2")) opciones.push(`<option value="Almacen_Ruta_2">Almacén Ruta 2</option>`);
  $("rutaReimpresion").innerHTML = opciones.join("");
}

function mostrarVistaOperacion() {
  $("vistaOperacion").classList.remove("view-hidden");
  $("vistaReimpresion").classList.add("view-hidden");
}

function mostrarVistaReimpresion() {
  cerrarModalProducto();
  $("modalVendedor").style.display = "none";
  cargarRutasReimpresion();
  $("vistaOperacion").classList.add("view-hidden");
  $("vistaReimpresion").classList.remove("view-hidden");
  $("listaReimpresion").innerHTML = `<div class="resultado-vacio">Selecciona una ruta para consultar.</div>`;
}

async function consultarReimpresiones(rutaId) {
  const contenedor = $("listaReimpresion");
  if (!rutaId) {
    contenedor.innerHTML = `<div class="resultado-vacio">Selecciona una ruta para consultar.</div>`;
    return;
  }

  contenedor.innerHTML = `<div class="resultado-vacio">Consultando traspasos...</div>`;
  try {
    const snap = await getDocs(query(collection(db, "almacenes", rutaId, "entradas"), orderBy("fecha", "desc")));
    contenedor.innerHTML = "";

    if (snap.empty) {
      contenedor.innerHTML = `<div class="resultado-vacio">No hay traspasos en esta ruta.</div>`;
      return;
    }

    snap.forEach(doc => {
      const d = doc.data();
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "reimpresion-item";
      const fecha = d.fecha ? new Date(d.fecha).toLocaleString("es-MX") : "Sin fecha";
      const unidades = (d.items || []).reduce((acc, item) => acc + Number(item.cantidad || 0), 0);
      btn.innerHTML = `
        <span class="reprint-date">${escapeHtml(fecha)}</span>
        <b>${escapeHtml(d.vendedorNombre || "Sin vendedor")}</b>
        <small>${(d.items || []).length} artículo(s) · ${unidades.toLocaleString("es-MX", { maximumFractionDigits: 3 })} unidades</small>
        <em>IMPRIMIR →</em>`;
      btn.addEventListener("click", () => {
        window.open(`impresion_traspaso.html?id=${encodeURIComponent(doc.id)}&ruta=${encodeURIComponent(rutaId)}`, "_blank");
      });
      contenedor.appendChild(btn);
    });
  } catch (err) {
    contenedor.innerHTML = `<div class="resultado-vacio error-text">${escapeHtml(err.message)}</div>`;
  }
}

async function guardarTraspasoFinal(nombreEntrega, nombreRecibe, firmaEntregaB64, firmaRecibeB64, ventanaImpresion = null) {
  if (!vendedorSeleccionado) throw new Error("No hay vendedor seleccionado.");

  const payload = {
    vendedorId: vendedorSeleccionado.id,
    rutaId: vendedorSeleccionado.rutaId,
    fecha: new Date().toISOString(),
    vendedorNombre: vendedorSeleccionado.nombre,
    items: carrito,
    firmas: {
      entrega: { nombre: nombreEntrega, pngBase64: firmaEntregaB64 },
      recibe: { nombre: nombreRecibe, pngBase64: firmaRecibeB64 }
    }
  };

  const docRef = await addDoc(collection(db, "almacenes", vendedorSeleccionado.rutaId, "entradas"), payload);
  const rutaGuardada = vendedorSeleccionado.rutaId;

  $("modalRecibe").style.display = "none";
  firmaPaso1.clear();
  firmaPaso2.clear();
  $("nombreEntregaPaso1").value = "";

  const urlImpresion = `impresion_traspaso.html?id=${encodeURIComponent(docRef.id)}&ruta=${encodeURIComponent(rutaGuardada)}`;
  if (ventanaImpresion && !ventanaImpresion.closed) ventanaImpresion.location.href = urlImpresion;
  else window.open(urlImpresion, "_blank");

  limpiarSesionCompleta();
  ocultarSesionRecuperada();
  alert("Traspaso guardado correctamente. Se abrió la impresión.");
  abrirModalVendedor({ obligatorio: true });
}

function configurarMenu() {
  const cerrarMenu = () => {
    $("menuApp").classList.remove("open");
    $("btnMenu").setAttribute("aria-expanded", "false");
  };

  $("btnMenu").addEventListener("click", e => {
    e.stopPropagation();
    const abierto = $("menuApp").classList.toggle("open");
    $("btnMenu").setAttribute("aria-expanded", String(abierto));
  });

  document.addEventListener("click", e => {
    if (!e.target.closest(".menu-wrap")) cerrarMenu();
  });

  $("menuNuevaCaptura").addEventListener("click", () => {
    cerrarMenu();
    mostrarVistaOperacion();
  });

  $("menuReimpresion").addEventListener("click", () => {
    cerrarMenu();
    mostrarVistaReimpresion();
  });
}

function configurarEventos() {
  configurarMenu();

  $("btnCambiarVendedor").addEventListener("click", () => {
    if (carrito.length) {
      alert("Para cambiar de vendedor primero termina el traspaso actual o elimina los productos del carrito.");
      return;
    }
    abrirModalVendedor({ obligatorio: true });
  });

  $("btnAgregarProducto").addEventListener("click", abrirModalProducto);

  $("cerrarVendedor").addEventListener("click", cerrarModalVendedor);
  $("btnIniciarVendedor").addEventListener("click", confirmarVendedor);
  $("modalVendedor").addEventListener("click", e => {
    if (e.target === $("modalVendedor") && vendedorSeleccionado) cerrarModalVendedor();
  });

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
    mostrarEstadoBusqueda();

    if (!valor) {
      $("listaProductosModal").innerHTML = `<div class="resultado-vacio">Escanea un código o escribe parte del nombre del producto.</div>`;
      return;
    }

    if (!tieneLetras(valor)) return;
    timerBusquedaTexto = setTimeout(() => renderCoincidenciasProducto(valor), 380);
  });

  $("cerrarProducto").addEventListener("click", cerrarModalProducto);
  $("btnVerCarrito").addEventListener("click", cerrarModalProducto);
  $("modalProducto").addEventListener("click", e => {
    if (e.target === $("modalProducto")) cerrarModalProducto();
  });

  $("tabla").addEventListener("click", e => {
    const editar = e.target.closest(".btn-editar");
    const eliminar = e.target.closest(".btn-eliminar");

    if (editar) {
      const index = Number(editar.dataset.index);
      const item = carrito[index];
      abrirCantidadProducto(item, item.cantidad, { editarIndex: index });
      return;
    }

    if (eliminar) {
      const index = Number(eliminar.dataset.index);
      carrito.splice(index, 1);
      guardarSesion();
      renderTabla();
      actualizarResumenVendedor();
    }
  });

  $("cantidadesRapidas").addEventListener("click", e => {
    const btn = e.target.closest("button[data-qty]");
    if (!btn || btn.disabled) return;
    $("inputCantidadNombre").value = btn.dataset.qty;
    $("inputCantidadNombre").focus();
  });

  $("inputCantidadNombre").addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      $("btnAceptarCantidad").click();
    }
  });

  $("btnAceptarCantidad").addEventListener("click", () => {
    const nuevaCantidad = Number($("inputCantidadNombre").value);
    if (!Number.isFinite(nuevaCantidad) || nuevaCantidad <= 0) return alert("Cantidad inválida");

    const eraEdicion = indiceEdicionCantidad !== null;
    if (eraEdicion) {
      carrito[indiceEdicionCantidad].cantidad = nuevaCantidad;
      guardarSesion();
      renderTabla();
      cerrarCantidad({ continuarCaptura: false });
      return;
    }

    if (productoPendiente) agregarProductoAlCarrito(productoPendiente, nuevaCantidad);
    cerrarCantidad({ continuarCaptura: modalProductoDebeReabrir });
  });

  $("btnCancelarCantidad").addEventListener("click", () => {
    const continuar = indiceEdicionCantidad === null;
    cerrarCantidad({ continuarCaptura: continuar });
  });

  $("modalCantidad").addEventListener("click", e => {
    if (e.target === $("modalCantidad")) {
      const continuar = indiceEdicionCantidad === null;
      cerrarCantidad({ continuarCaptura: continuar });
    }
  });

  $("btnTraspaso").addEventListener("click", () => {
    if (!vendedorSeleccionado?.id) return alert("Seleccione un vendedor");
    if (!vendedorSeleccionado?.rutaId) return alert("Este vendedor no tiene rutaId asignado");
    if (!carrito.length) return alert("Agregue productos antes de finalizar el traspaso");

    $("nombreRecibePaso2").value = vendedorSeleccionado.nombre;
    $("modalEntrega").style.display = "flex";
    marcarPasoModal("finalizar");
    setTimeout(() => firmaPaso1.resize(), 30);
  });

  $("btnLimpiarPaso1").addEventListener("click", () => firmaPaso1.clear());
  $("btnLimpiarPaso2").addEventListener("click", () => firmaPaso2.clear());

  $("btnContinuarPaso1").addEventListener("click", () => {
    const nombre = $("nombreEntregaPaso1").value.trim();
    if (!nombre) return alert("Escriba el nombre de quien entrega");
    if (!firmaPaso1.hasInk()) return alert("Falta la firma de quien entrega");
    $("modalEntrega").style.display = "none";
    $("modalRecibe").style.display = "flex";
    setTimeout(() => firmaPaso2.resize(), 30);
  });

  $("btnCancelarPaso2").addEventListener("click", () => {
    firmaPaso2.clear();
    $("modalRecibe").style.display = "none";
    $("modalEntrega").style.display = "flex";
    setTimeout(() => firmaPaso1.resize(), 30);
  });

  $("btnConfirmarPaso2").addEventListener("click", async () => {
    if (!firmaPaso2.hasInk()) return alert("Falta la firma de quien recibe");

    const ventanaImpresion = window.open("", "_blank");
    try {
      await guardarTraspasoFinal(
        $("nombreEntregaPaso1").value.trim(),
        $("nombreRecibePaso2").value.trim(),
        firmaPaso1.getBase64(),
        firmaPaso2.getBase64(),
        ventanaImpresion
      );
    } catch (err) {
      if (ventanaImpresion && !ventanaImpresion.closed) ventanaImpresion.close();
      console.error(err);
      alert(`No se pudo guardar el traspaso: ${err.message || err}`);
    }
  });

  $("btnVolverOperacion").addEventListener("click", mostrarVistaOperacion);
  $("rutaReimpresion").addEventListener("change", e => consultarReimpresiones(e.target.value.trim()));

  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    $("menuApp").classList.remove("open");

    if ($("modalCantidad").style.display === "flex") {
      const continuar = indiceEdicionCantidad === null;
      cerrarCantidad({ continuarCaptura: continuar });
      return;
    }
    if ($("modalProducto").style.display === "flex") {
      cerrarModalProducto();
      return;
    }
    if ($("modalVendedor").style.display === "flex" && vendedorSeleccionado) {
      cerrarModalVendedor();
    }
  });
}

async function init() {
  try {
    setCarga(6, "Iniciando PROVSOFT...", "Preparando módulo de traspasos");
    firmaPaso1 = crearFirma($("canvasEntregaPaso1"));
    firmaPaso2 = crearFirma($("canvasRecibePaso2"));
    configurarEventos();

    setCarga(14, "Revisando catálogo local...", "Validando IndexedDB");
    setEstadoCarga("catalogo", "", "Revisando catálogo local...", "Validando");
    await openDB();
    let productosLocales = await getAllProductos();

    if (productosLocales.length === 0) {
      const totalSync = await syncProductos();
      localStorage.setItem("ultima_sync_productos", String(Date.now()));
      productosLocales = await getAllProductos();
      setEstadoCarga("catalogo", "ok", `${totalSync.toLocaleString("es-MX")} productos descargados y guardados localmente`, "LISTO");
    } else {
      setCarga(44, "Catálogo local disponible", `${productosLocales.length.toLocaleString("es-MX")} productos listos`);
      setEstadoCarga("catalogo", "ok", `${productosLocales.length.toLocaleString("es-MX")} productos disponibles en este equipo`, "LISTO");
    }

    resultadosBusqueda = productosLocales;

    setCarga(58, "Cargando vendedores...", "Consultando vendedores y rutas activas");
    setEstadoCarga("vendedores", "", "Consultando Firebase...", "Cargando");
    const totalVendedores = await cargarListaVendedores();
    if (!totalVendedores) throw new Error("No se encontraron vendedores activos para iniciar el traspaso.");
    setEstadoCarga("vendedores", "ok", `${totalVendedores} vendedor(es) activo(s) cargados`, "LISTO");

    setCarga(72, "Activando catálogo en vivo...", "Escuchando cambios de productos en Firebase");
    detenerCatalogoEnVivo = await iniciarCatalogoEnVivo({
      onCambios: async cambios => {
        resultadosBusqueda = await getAllProductos();
        console.info(`[Catálogo en vivo] ${cambios} cambio(s) aplicado(s) en IndexedDB`);
        if ($("modalProducto").style.display === "flex" && tieneLetras($("buscador").value)) {
          renderCoincidenciasProducto($("buscador").value);
        }
      },
      onEstado: ({ conectado }) => {
        actualizarEstadoCatalogoVivo(conectado);
        console.info(conectado ? "[Catálogo en vivo] conectado" : "[Catálogo en vivo] usando caché/local");
      },
      onError: err => {
        actualizarEstadoCatalogoVivo(false);
        console.warn("El catálogo en vivo no está disponible; la copia local sigue funcionando.", err);
      }
    });

    setCarga(86, "Restaurando captura...", "Revisando sesión de traspaso pendiente");
    restaurarSesion();
    renderTabla();
    actualizarResumenVendedor();

    setCarga(96, "Preparando pantalla...", "Flujo por modales listo");
    mostrarApp();
  } catch (err) {
    console.error(err);
    setEstadoCarga("catalogo", $("estadoCargaCatalogo")?.classList.contains("ok") ? "ok" : "error", $("detalleCargaCatalogo")?.textContent || "Error", $("estadoCargaCatalogo")?.classList.contains("ok") ? "LISTO" : "ERROR");
    setEstadoCarga("vendedores", $("estadoCargaVendedores")?.classList.contains("ok") ? "ok" : "error", $("detalleCargaVendedores")?.textContent || "Error", $("estadoCargaVendedores")?.classList.contains("ok") ? "LISTO" : "ERROR");
    mostrarErrorCarga(err.message || "No se pudo iniciar la aplicación.");
  }
}

window.addEventListener("beforeunload", () => {
  if (typeof detenerCatalogoEnVivo === "function") detenerCatalogoEnVivo();
});

document.addEventListener("DOMContentLoaded", init);
