let archivosSeleccionados = [];
let recordatoriosActuales = [];

let editorRecordatorio = null;
let editorImagenesExistentes = [];
let editorImagenesEliminadas = [];
let editorArchivosNuevos = [];
let editorSucio = false;

export function inicializarCapturaImagenes() {
  configurarZonaImagenes({
    zonaId: "zonaImagenes",
    inputId: "selectorImagenes",
    botonId: "btnSeleccionar",
    onFiles: agregarArchivosCreacion
  });

  configurarZonaImagenes({
    zonaId: "editorZonaImagenes",
    inputId: "editorSelectorImagenes",
    botonId: "editorBtnSeleccionar",
    onFiles: agregarArchivosEditor
  });

  document.addEventListener("paste", e => {
    const archivos = obtenerImagenesPortapapeles(e);
    if (!archivos.length) return;
    e.preventDefault();

    if (!editorModal.hidden) agregarArchivosEditor(archivos);
    else agregarArchivosCreacion(archivos);
  });
}

function configurarZonaImagenes({ zonaId, inputId, botonId, onFiles }) {
  const zona = document.getElementById(zonaId);
  const input = document.getElementById(inputId);
  const boton = document.getElementById(botonId);

  boton.addEventListener("click", e => {
    e.stopPropagation();
    input.click();
  });

  zona.addEventListener("click", e => {
    if (!e.target.closest("button")) input.click();
  });

  input.addEventListener("change", () => {
    onFiles([...input.files]);
    input.value = "";
  });

  zona.addEventListener("dragover", e => {
    e.preventDefault();
    zona.classList.add("dragging");
  });

  zona.addEventListener("dragleave", () => zona.classList.remove("dragging"));

  zona.addEventListener("drop", e => {
    e.preventDefault();
    zona.classList.remove("dragging");
    onFiles([...e.dataTransfer.files]);
  });
}

function obtenerImagenesPortapapeles(e) {
  return [...(e.clipboardData?.items || [])]
    .filter(item => item.kind === "file" && item.type.startsWith("image/"))
    .map(item => item.getAsFile())
    .filter(Boolean);
}

function filtrarImagenes(archivos) {
  return archivos.filter(a => a?.type?.startsWith("image/"));
}

function agregarArchivosCreacion(archivos) {
  archivosSeleccionados.push(...filtrarImagenes(archivos));
  renderizarPrevisualizacionesCreacion();
}

function renderizarPrevisualizacionesCreacion() {
  renderizarArchivosLocales("previsualizaciones", archivosSeleccionados, indice => {
    archivosSeleccionados.splice(indice, 1);
    renderizarPrevisualizacionesCreacion();
  });
}

function agregarArchivosEditor(archivos) {
  const validos = filtrarImagenes(archivos);
  if (!validos.length) return;
  editorArchivosNuevos.push(...validos);
  editorSucio = true;
  renderizarPrevisualizacionesEditor();
}

function renderizarPrevisualizacionesEditor() {
  const contenedor = document.getElementById("editorPrevisualizaciones");
  contenedor.innerHTML = "";

  editorImagenesExistentes.forEach((imagen, indice) => {
    const card = crearPreviewCard(imagen.url || imagen, "Imagen guardada");
    card.classList.add("existing-image");
    card.querySelector("button").addEventListener("click", e => {
      e.stopPropagation();
      editorImagenesEliminadas.push(imagen);
      editorImagenesExistentes.splice(indice, 1);
      editorSucio = true;
      renderizarPrevisualizacionesEditor();
    });
    card.querySelector("img").addEventListener("click", () => abrirVisor(imagen.url || imagen));
    contenedor.append(card);
  });

  editorArchivosNuevos.forEach((archivo, indice) => {
    const url = URL.createObjectURL(archivo);
    const card = crearPreviewCard(url, archivo.name || "Nueva imagen");
    card.classList.add("new-image");
    card.querySelector("img").addEventListener("load", () => URL.revokeObjectURL(url), { once: true });
    card.querySelector("button").addEventListener("click", e => {
      e.stopPropagation();
      editorArchivosNuevos.splice(indice, 1);
      editorSucio = true;
      renderizarPrevisualizacionesEditor();
    });
    contenedor.append(card);
  });
}

function renderizarArchivosLocales(contenedorId, archivos, onRemove) {
  const contenedor = document.getElementById(contenedorId);
  contenedor.innerHTML = "";

  archivos.forEach((archivo, indice) => {
    const url = URL.createObjectURL(archivo);
    const card = crearPreviewCard(url, archivo.name || "Captura pegada");
    card.querySelector("img").addEventListener("load", () => URL.revokeObjectURL(url), { once: true });
    card.querySelector("button").addEventListener("click", e => {
      e.stopPropagation();
      onRemove(indice);
    });
    contenedor.append(card);
  });
}

function crearPreviewCard(url, alt) {
  const card = document.createElement("div");
  card.className = "preview-card";

  const img = document.createElement("img");
  img.src = url;
  img.alt = alt;

  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = "remove-image";
  boton.textContent = "×";
  boton.title = "Quitar imagen";

  card.append(img, boton);
  return card;
}

export function obtenerArchivosSeleccionados() {
  return [...archivosSeleccionados];
}

export function limpiarImagenes() {
  archivosSeleccionados = [];
  renderizarPrevisualizacionesCreacion();
  selectorImagenes.value = "";
}

export function obtenerDatosFormulario() {
  return { fecha: fecha.value, hora: hora.value, contenido: contenido.value };
}

export function validarFormulario(datos, cantidadImagenes = archivosSeleccionados.length) {
  if (!datos.fecha) return "Seleccione la fecha de la alarma.";
  if (!datos.hora) return "Seleccione la hora de la alarma.";
  if (!datos.contenido.trim() && cantidadImagenes === 0) {
    return "Pegue un mensaje o agregue al menos una imagen.";
  }
  return "";
}

export function limpiarFormulario() {
  formRecordatorio.reset();
  limpiarImagenes();
  establecerFechaHoraPredeterminada();
}

export function establecerFechaHoraPredeterminada() {
  const ahora = new Date();
  ahora.setMinutes(ahora.getMinutes() + 10);
  const local = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000);
  fecha.value = local.toISOString().slice(0, 10);
  hora.value = local.toISOString().slice(11, 16);
}

export function mostrarMensaje(texto, tipo = "") {
  mensajeSistema.textContent = texto;
  mensajeSistema.className = `system-message ${tipo}`.trim();
}

export function mostrarMensajeEditor(texto, tipo = "") {
  editorMensaje.textContent = texto;
  editorMensaje.className = `system-message ${tipo}`.trim();
}

export function establecerGuardando(guardando, texto = "") {
  btnGuardar.disabled = guardando;
  btnGuardar.textContent = guardando ? (texto || "Guardando...") : "Guardar recordatorio";
}

export function establecerGuardandoEditor(guardando, texto = "") {
  btnGuardarEdicion.disabled = guardando;
  btnAtendido.disabled = guardando;
  btnGuardarEdicion.textContent = guardando ? (texto || "Guardando...") : "Guardar cambios";
}

export function mostrarEstadoConexion(texto, tipo = "") {
  estadoConexion.textContent = texto;
  estadoConexion.className = `connection ${tipo}`.trim();
}

export function renderizarRecordatorios(recordatorios) {
  recordatoriosActuales = recordatorios;

  if (!recordatorios.length) {
    resumen.innerHTML = '<span class="badge">0 pendientes</span>';
    listaRecordatorios.innerHTML = '<div class="empty">No hay recordatorios pendientes.</div>';
    return;
  }

  const ahora = new Date();
  let vencidos = 0, hoy = 0, proximos = 0;

  listaRecordatorios.innerHTML = recordatorios.map(r => {
    const f = r.fecha_programada.toDate();
    const misma = f.toDateString() === ahora.toDateString();
    let clase = "future";

    if (f < ahora && !misma) { clase = "overdue"; vencidos++; }
    else if (misma) { clase = "today"; hoy++; }
    else proximos++;

    const imagenes = (r.imagenes || []).map(im => im.url || im);
    const thumbs = imagenes.slice(0, 2)
      .map((url, i) => `<img src="${escAttr(url)}" alt="Imagen ${i + 1}">`)
      .join("");
    const cuentaImagenes = imagenes.length ? `${imagenes.length} img.` : "";

    return `
      <article class="reminder-card ${clase}" data-id="${escAttr(r.id)}" tabindex="0">
        <div class="reminder-head">
          <div>
            <h3 class="reminder-title">${esc(r.titulo || "Recordatorio")}</h3>
            <p class="reminder-meta">${f.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })} · ${esc(r.estado)}</p>
          </div>
          <span class="reminder-count">${cuentaImagenes}</span>
        </div>
        <div class="reminder-preview ${imagenes.length ? "" : "no-images"}">
          ${imagenes.length ? `<div class="compact-thumbs">${thumbs}</div>` : ""}
          <p class="reminder-message-summary">${esc(r.contenido || "Sin mensaje")}</p>
        </div>
      </article>`;
  }).join("");

  resumen.innerHTML = `
    <span class="badge">${recordatorios.length} pendientes</span>
    <span class="badge">${vencidos} vencidos</span>
    <span class="badge">${hoy} para hoy</span>
    <span class="badge">${proximos} próximos</span>`;

  document.querySelectorAll(".reminder-card").forEach(card => {
    const abrir = () => abrirEditor(card.dataset.id);
    card.addEventListener("click", abrir);
    card.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        abrir();
      }
    });
  });
}

export function inicializarEditor() {
  [editorFecha, editorHora, editorContenido].forEach(elemento => {
    elemento.addEventListener("input", () => { editorSucio = true; });
  });

  cerrarEditor.addEventListener("click", solicitarCerrarEditor);
  btnCancelarEdicion.addEventListener("click", solicitarCerrarEditor);

  editorModal.addEventListener("click", e => {
    if (e.target === editorModal) solicitarCerrarEditor();
  });

  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (!visor.hidden) visor.hidden = true;
    else if (!editorModal.hidden) solicitarCerrarEditor();
  });
}

function abrirEditor(id) {
  const r = recordatoriosActuales.find(item => item.id === id);
  if (!r) return;

  editorRecordatorio = r;
  editorImagenesExistentes = [...(r.imagenes || [])];
  editorImagenesEliminadas = [];
  editorArchivosNuevos = [];
  editorSucio = false;

  const fechaProgramada = r.fecha_programada.toDate();
  const local = new Date(fechaProgramada.getTime() - fechaProgramada.getTimezoneOffset() * 60000);

  editorId.value = r.id;
  editorTitulo.textContent = r.titulo || "Recordatorio";
  editorFecha.value = local.toISOString().slice(0, 10);
  editorHora.value = local.toISOString().slice(11, 16);
  editorContenido.value = r.contenido || "";
  mostrarMensajeEditor("");
  renderizarPrevisualizacionesEditor();

  editorModal.hidden = false;
  setTimeout(() => editorContenido.focus(), 50);
}

export function obtenerDatosEditor() {
  return {
    id: editorId.value,
    fecha: editorFecha.value,
    hora: editorHora.value,
    contenido: editorContenido.value,
    imagenesExistentes: [...editorImagenesExistentes],
    imagenesEliminadas: [...editorImagenesEliminadas],
    archivosNuevos: [...editorArchivosNuevos]
  };
}

export function marcarEditorLimpio() {
  editorSucio = false;
}

export function cerrarEditorForzado() {
  editorSucio = false;
  editorModal.hidden = true;
  editorRecordatorio = null;
  editorImagenesExistentes = [];
  editorImagenesEliminadas = [];
  editorArchivosNuevos = [];
}

function solicitarCerrarEditor() {
  if (editorSucio && !confirm("Hay cambios sin guardar. ¿Cerrar el editor?")) return;
  cerrarEditorForzado();
}

function abrirVisor(url) {
  imagenVisor.src = url;
  visor.hidden = false;
}

export function inicializarVisor() {
  cerrarVisor.addEventListener("click", () => visor.hidden = true);
  visor.addEventListener("click", e => {
    if (e.target === visor) visor.hidden = true;
  });
}

function esc(v) {
  return String(v).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[c]);
}

function escAttr(v) {
  return esc(v);
}
