import { db, collection, query, where, getDocs, addDoc, orderBy } from "./firebase.js";
import { openDB, saveProductos, saveProductoIndividual, getAllProductos, getProductoPorCodigo } from "./db-local.js";
import { iniciarCatalogoEnVivo } from "./catalogo-realtime.js";
import { buscarCoincidencias, tieneLetras } from "./search-engine.js";
import { crearFirma } from "./firma.js";

let carrito = [];
let resultadosBusqueda = [];
let vendedoresCargados = [];
let productoPendiente = null;
let indiceEdicionCantidad = null;
let cantidadEsBalanza = false;
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
  setCarga(100, "Sistema listo", "Vendedores y catálogo preparados");
  setTimeout(() => {
    $("pantallaCarga").style.display = "none";
    $("appPrincipal").style.display = "block";
    actualizarPaso(2);
    $("vendedorSelect").focus();
  }, 260);
}

function mostrarErrorCarga(msg) {
  setCarga(100, "No se pudo iniciar", msg || "Revise conexión o permisos de Firebase.");
}

function mostrarEstadoBusqueda(msg = "", tipo = "info") {
  const el = $("estadoBusquedaFirebase");
  el.textContent = msg;
  el.className = `estado-busqueda ${tipo}`;
  el.style.display = msg ? "block" : "none";
}

function actualizarPaso(paso) {
  const orden = [1, 2, 3, 5, 6];
  const vendedorSeleccionado = Boolean($("vendedorSelect")?.value);

  document.querySelectorAll(".step").forEach(el => {
    const valor = Number(el.dataset.step);
    el.classList.remove("active", "done");

    if (valor === 1) {
      el.classList.add("done");
      return;
    }

    if (valor === 2 && vendedorSeleccionado && paso !== 2) {
      el.classList.add("done");
      return;
    }

    const idxValor = orden.indexOf(valor);
    const idxPaso = orden.indexOf(paso);
    if (idxValor >= 0 && idxPaso >= 0 && idxValor < idxPaso) {
      el.classList.add("done");
    }

    if (valor === paso) el.classList.add("active");
  });

  const etiquetas = {
    2: "Paso 2 de 6 · Vendedor",
    3: "Paso 3/4 de 6 · Producto",
    5: "Paso 5 de 6 · Cantidad",
    6: "Paso 6 de 6 · Firmas"
  };
  if ($("textoPasoActual")) $("textoPasoActual").textContent = etiquetas[paso] || "Captura guiada";
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

function seleccionarProducto(data) {
  $("codigoSel").value = data.codigoBarra || "";
  $("conceptoSel").value = data.concepto || "";
  $("precioSel").value = Number(data.precioPublico || 0);
  $("preview").textContent = `${data.concepto || "Sin concepto"} · $${Number(data.precioPublico || 0).toFixed(2)}`;
}

function abrirCantidadProducto(producto, cantidadInicial = 1, { balanza = false, editarIndex = null } = {}) {
  productoPendiente = producto;
  indiceEdicionCantidad = editarIndex;
  cantidadEsBalanza = balanza;

  $("cantidadProductoNombre").textContent = producto?.concepto || "Sin concepto";
  $("cantidadProductoCodigo").textContent = `Código: ${producto?.codigoBarra || producto?.codigo || "—"}`;
  $("inputCantidadNombre").value = Number(cantidadInicial || 1);
  $("inputCantidadNombre").readOnly = balanza;
  $("tituloCantidad").textContent = editarIndex === null ? "Asignar cantidad" : "Editar cantidad";
  $("btnAceptarCantidad").textContent = editarIndex === null ? "Agregar al carrito" : "Guardar cantidad";
  $("notaCantidad").textContent = balanza
    ? "Cantidad detectada por código de balanza."
    : "Selecciona una cantidad rápida o captura manualmente.";

  document.querySelectorAll("#cantidadesRapidas button").forEach(btn => {
    btn.disabled = balanza;
    btn.style.opacity = balanza ? ".45" : "1";
  });

  $("modalCantidad").style.display = "flex";
  actualizarPaso(5);

  setTimeout(() => {
    $("inputCantidadNombre").focus();
    if (!balanza) $("inputCantidadNombre").select();
  }, 40);
}

function cerrarCantidad({ limpiarBusqueda = true } = {}) {
  $("modalCantidad").style.display = "none";
  $("inputCantidadNombre").readOnly = false;
  productoPendiente = null;
  indiceEdicionCantidad = null;
  cantidadEsBalanza = false;
  $("preview").textContent = "";
  if (limpiarBusqueda) $("buscador").value = "";
  actualizarPaso($("vendedorSelect").value ? 3 : 2);
  if ($("vendedorSelect").value) setTimeout(() => $("buscador").focus(), 30);
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

  persistirCarrito();
  renderTabla();
}

function persistirCarrito() {
  localStorage.setItem("carrito_traspaso", JSON.stringify(carrito));
}

function renderTabla() {
  const tabla = $("tabla");
  tabla.innerHTML = "";

  $("contadorArticulos").textContent = String(carrito.length);
  const totalUnidades = carrito.reduce((acc, item) => acc + Number(item.cantidad || 0), 0);
  $("contadorUnidades").textContent = totalUnidades.toLocaleString("es-MX", { maximumFractionDigits: 3 });

  const puedeFinalizar = Boolean($("vendedorSelect")?.value) && Boolean($("rutaId")?.value) && carrito.length > 0;
  $("btnTraspaso").disabled = !puedeFinalizar;

  if (!carrito.length) {
    tabla.innerHTML = `<tr><td colspan="5" class="tabla-vacia">Escanea o busca un producto para iniciar el traspaso.</td></tr>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  carrito.forEach((it, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="codigo-cell">${escapeHtml(it.codigo)}</td>
      <td>${escapeHtml(it.concepto)}</td>
      <td class="cantidad-cell">${Number(it.cantidad).toLocaleString("es-MX", { maximumFractionDigits: 3 })}</td>
      <td>$${Number(it.precio).toFixed(2)}</td>
      <td>
        <button class="btn-icon btn-editar" data-index="${i}" title="Editar cantidad" aria-label="Editar cantidad">✎</button>
        <button class="btn-icon btn-eliminar" data-index="${i}" title="Eliminar" aria-label="Eliminar">×</button>
      </td>`;
    fragment.appendChild(tr);
  });
  tabla.appendChild(fragment);
}

function abrirModalBusqueda(consultaInicial = "") {
  $("modalResultados").style.display = "flex";
  $("busquedaNombre").value = consultaInicial;
  renderCoincidencias(consultaInicial);
  actualizarPaso(3);
  setTimeout(() => {
    $("busquedaNombre").focus();
    const largo = $("busquedaNombre").value.length;
    $("busquedaNombre").setSelectionRange(largo, largo);
  }, 30);
}

function cerrarModalBusqueda({ limpiar = true } = {}) {
  $("modalResultados").style.display = "none";
  if (limpiar) $("buscador").value = "";
  actualizarPaso($("vendedorSelect").value ? 3 : 2);
  if ($("vendedorSelect").value) $("buscador").focus();
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
      <span class="resultado-meta">Código: ${escapeHtml(prod.codigoBarra || "")}</span>
      <span class="resultado-precio">$${Number(prod.precioPublico || 0).toFixed(2)}</span>`;
    div.addEventListener("click", () => {
      seleccionarProducto(prod);
      cerrarModalBusqueda({ limpiar: false });
      abrirCantidadProducto(prod, 1);
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
  if (!valorOriginal || !$("vendedorSelect").value) return;

  if (tieneLetras(valorOriginal)) {
    resultadosBusqueda = await getAllProductos();
    abrirModalBusqueda(valorOriginal);
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

  mostrarEstadoBusqueda();
  let encontrado = await getProductoPorCodigo(codigo);

  if (!encontrado) {
    mostrarEstadoBusqueda("No está en catálogo local. Consultando Firebase...", "aviso");
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
  abrirCantidadProducto(encontrado, cantidadInicial, { balanza: esBalanza });
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
  vendedoresCargados = [];

  snap.forEach(doc => {
    const d = doc.data();
    const vendedor = { id: doc.id, nombre: d.nombre || doc.id, rutaId: d.rutaId || "" };
    vendedoresCargados.push(vendedor);

    const opt = document.createElement("option");
    opt.value = vendedor.id;
    opt.dataset.nombre = vendedor.nombre;
    opt.dataset.ruta = vendedor.rutaId;
    opt.textContent = vendedor.rutaId ? `${vendedor.nombre} · ${vendedor.rutaId}` : vendedor.nombre;
    select.appendChild(opt);
  });

  return vendedoresCargados.length;
}

function actualizarVendedorSeleccionado() {
  const select = $("vendedorSelect");
  const opt = select.selectedOptions[0];
  const hayVendedor = Boolean(select.value);
  const ruta = opt?.dataset.ruta || "";
  const vendedorValido = hayVendedor && Boolean(ruta);
  const nombre = opt?.dataset.nombre || opt?.textContent || "";

  $("rutaId").value = ruta;
  $("nombreVendedorResumen").textContent = hayVendedor ? nombre : "Sin vendedor seleccionado";
  $("rutaVendedorResumen").textContent = hayVendedor ? (ruta || "FALTA rutaId en Firebase") : "Selecciona para continuar";
  $("resumenVendedor").classList.toggle("empty", !vendedorValido);

  $("seccionCaptura").classList.toggle("locked-card", !vendedorValido);
  $("seccionCaptura").setAttribute("aria-disabled", String(!vendedorValido));
  $("buscador").disabled = !vendedorValido;
  $("seccionVendedor").classList.toggle("active-card", !vendedorValido);
  $("seccionCaptura").classList.toggle("active-card", vendedorValido);

  actualizarPaso(vendedorValido ? 3 : 2);
  renderTabla();

  if (vendedorValido) setTimeout(() => $("buscador").focus(), 80);
}

function cargarRutasReimpresion() {
  const rutas = [...new Set(vendedoresCargados.map(v => v.rutaId).filter(Boolean))].sort();
  const opciones = [`<option value="">Seleccione ruta</option>`];
  for (const ruta of rutas) opciones.push(`<option value="${escapeHtml(ruta)}">${escapeHtml(ruta)}</option>`);

  // Conserva compatibilidad si no hay vendedores cargados o las rutas antiguas no aparecen.
  if (!rutas.includes("Almacen_Ruta_1")) opciones.push(`<option value="Almacen_Ruta_1">Almacén Ruta 1</option>`);
  if (!rutas.includes("Almacen_Ruta_2")) opciones.push(`<option value="Almacen_Ruta_2">Almacén Ruta 2</option>`);
  $("rutaReimpresion").innerHTML = opciones.join("");
}

async function guardarTraspasoFinal(nombreEntrega, nombreRecibe, firmaEntregaB64, firmaRecibeB64, ventanaImpresion = null) {
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

  const urlImpresion = `impresion_traspaso.html?id=${encodeURIComponent(docRef.id)}&ruta=${encodeURIComponent(rutaId)}`;
  if (ventanaImpresion && !ventanaImpresion.closed) ventanaImpresion.location.href = urlImpresion;
  else window.open(urlImpresion, "_blank");

  carrito = [];
  renderTabla();
  localStorage.removeItem("carrito_traspaso");
  actualizarPaso(3);
  $("buscador").value = "";
  setTimeout(() => $("buscador").focus(), 80);
  alert("Traspaso guardado correctamente. Se abrió la impresión.");
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

  $("menuReimpresion").addEventListener("click", () => {
    cerrarMenu();
    cargarRutasReimpresion();
    $("listaReimpresion").innerHTML = `<div class="resultado-vacio">Selecciona una ruta para consultar.</div>`;
    $("modalReimpresion").style.display = "flex";
  });
}

function configurarEventos() {
  configurarMenu();

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
    if (!tieneLetras(valor)) return;

    timerBusquedaTexto = setTimeout(async () => {
      resultadosBusqueda = await getAllProductos();
      abrirModalBusqueda($("buscador").value.trim());
    }, 260);
  });

  $("busquedaNombre").addEventListener("input", e => renderCoincidencias(e.target.value));
  $("busquedaNombre").addEventListener("keydown", e => {
    if (e.key === "Escape") cerrarModalBusqueda();
  });
  $("cerrarModal").addEventListener("click", () => cerrarModalBusqueda());
  $("modalResultados").addEventListener("click", e => {
    if (e.target === $("modalResultados")) cerrarModalBusqueda();
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
      persistirCarrito();
      renderTabla();
      if ($("vendedorSelect").value) actualizarPaso(3);
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

    if (indiceEdicionCantidad !== null) {
      carrito[indiceEdicionCantidad].cantidad = nuevaCantidad;
      persistirCarrito();
      renderTabla();
    } else if (productoPendiente) {
      agregarProductoAlCarrito(productoPendiente, nuevaCantidad);
    }

    cerrarCantidad();
  });

  $("btnCancelarCantidad").addEventListener("click", () => cerrarCantidad());
  $("modalCantidad").addEventListener("click", e => {
    if (e.target === $("modalCantidad")) cerrarCantidad();
  });

  $("vendedorSelect").addEventListener("change", actualizarVendedorSeleccionado);

  $("btnTraspaso").addEventListener("click", () => {
    const vendedorId = $("vendedorSelect").value;
    const rutaId = $("rutaId").value;
    if (!vendedorId) return alert("Seleccione un vendedor");
    if (!rutaId) return alert("Este vendedor no tiene rutaId asignado");
    if (!carrito.length) return alert("Agregue productos antes de finalizar el traspaso");

    const opt = $("vendedorSelect").selectedOptions[0];
    $("nombreRecibePaso2").value = opt ? (opt.dataset.nombre || opt.textContent) : "";
    $("modalEntrega").style.display = "flex";
    actualizarPaso(6);
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

  $("cerrarReimpresion").addEventListener("click", () => $("modalReimpresion").style.display = "none");
  $("modalReimpresion").addEventListener("click", e => {
    if (e.target === $("modalReimpresion")) $("modalReimpresion").style.display = "none";
  });

  $("rutaReimpresion").addEventListener("change", async e => {
    const rutaId = e.target.value.trim();
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
        btn.className = "reimpresion-item";
        btn.innerHTML = `
          <b>${escapeHtml(new Date(d.fecha).toLocaleString("es-MX"))}</b>
          <span>${escapeHtml(d.vendedorNombre || "Sin vendedor")} · ${(d.items || []).length} artículo(s)</span>
          <em>IMPRIMIR →</em>`;
        btn.addEventListener("click", () => {
          window.open(`impresion_traspaso.html?id=${encodeURIComponent(doc.id)}&ruta=${encodeURIComponent(rutaId)}`, "_blank");
        });
        contenedor.appendChild(btn);
      });
    } catch (err) {
      contenedor.innerHTML = `<div class="resultado-vacio error-text">${escapeHtml(err.message)}</div>`;
    }
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      $("menuApp").classList.remove("open");
      if ($("modalResultados").style.display === "flex") cerrarModalBusqueda();
      else if ($("modalReimpresion").style.display === "flex") $("modalReimpresion").style.display = "none";
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
        if ($("modalResultados").style.display === "flex") renderCoincidencias($("busquedaNombre").value);
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

    setCarga(86, "Restaurando captura...", "Revisando carrito pendiente");
    const guardado = localStorage.getItem("carrito_traspaso");
    if (guardado) {
      try { carrito = JSON.parse(guardado) || []; } catch { carrito = []; }
      if (carrito.length) {
        $("barraSesion").style.display = "block";
        $("barraSesion").textContent = `Sesión anterior recuperada · ${carrito.length} artículo(s)`;
      }
    }

    renderTabla();
    actualizarVendedorSeleccionado();
    setCarga(96, "Preparando pantalla...", "Flujo guiado listo");
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
