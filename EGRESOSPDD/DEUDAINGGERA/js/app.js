import {
  observarSesion,
  login,
  logout
} from "./auth.js";

import {
  buscarFacturaPorUUID,
  cargarHistorial,
  insertarHistorial,
  marcarFactura,
  actualizarNotaFactura,
  desmarcarFactura,
  listarObservadas
} from "./api.js";

import {
  renderInicio,
  renderBuscar,
  renderFacturaEncontrada,
  renderEditor,
  renderObservadas,
  renderReporte,
  calcularStats
} from "./visor.js";

let facturaActual = null;
let historialActual = [];
let observadas = [];

const loader = document.getElementById("loader");
const app = document.getElementById("app");
const toast = document.getElementById("toast");
const modal = document.getElementById("modal");
const modalContenido = document.getElementById("modalContenido");

const vistas = {
  inicio: document.getElementById("vistaInicio"),
  buscar: document.getElementById("vistaBuscar"),
  editor: document.getElementById("vistaEditor"),
  observadas: document.getElementById("vistaObservadas"),
  reporte: document.getElementById("vistaReporte")
};

document.addEventListener("DOMContentLoaded", prepararAuth);

async function iniciarApp() {
  await pausa(700);
  await refrescarObservadas();

  vistas.inicio.innerHTML = renderInicio(calcularStats(observadas));
  vistas.buscar.innerHTML = renderBuscar();
  vistas.observadas.innerHTML = renderObservadas(observadas);
  vistas.reporte.innerHTML = renderReporte(observadas);

  enlazarEventosGlobales();

  loader.classList.add("oculto");
  app.classList.remove("oculto");
}

function enlazarEventosGlobales() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => cambiarVista(btn.dataset.view));
  });

  document.getElementById("cerrarModal").addEventListener("click", cerrarModal);

document.body.addEventListener("click", async e => {
  if (e.target.id === "btnBuscarUUID") await buscarUUID();

  if (e.target.id === "btnAbrirFactura") {
    cerrarModal();
    await abrirFacturaActual();
  }

  if (e.target.id === "btnMarcar") await accionMarcar();
  if (e.target.id === "btnNota") await accionNota();
  if (e.target.id === "btnDesmarcar") await accionDesmarcar();

  if (e.target.id === "btnExcelObservadas") {
    generarExcelObservadas();
  }

  if (e.target.classList.contains("chip")) {
    document.getElementById("notaInput").value = e.target.dataset.motivo;
  }

  const row = e.target.closest(".tabla-row");
  if (row) {
    await buscarYEditar(row.dataset.uuid);
  }
});
  

  document.body.addEventListener("keydown", async e => {
    if (e.key === "Enter" && e.target.id === "uuidInput") {
      await buscarUUID();
    }
  });
}

function cambiarVista(nombre) {
  Object.values(vistas).forEach(v => v.classList.add("oculto"));

  if (nombre === "inicio") vistas.inicio.classList.remove("oculto");
  if (nombre === "buscar") vistas.buscar.classList.remove("oculto");
  if (nombre === "observadas") vistas.observadas.classList.remove("oculto");
  if (nombre === "reporte") vistas.reporte.classList.remove("oculto");

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("activo", btn.dataset.view === nombre);
  });

  const titulo = document.getElementById("tituloVista");
  const subtitulo = document.getElementById("subtituloVista");

  const textos = {
    inicio: ["Control de Facturas en Observación", "Módulo de seguimiento y trazabilidad"],
    buscar: ["Buscar factura", "Captura UUID CFDI"],
    observadas: ["Facturas observadas", "Listado de facturas pendientes de confirmar"],
    reporte: ["Reporte", "Resumen de facturas en observación"]
  };

  titulo.textContent = textos[nombre]?.[0] || "";
  subtitulo.textContent = textos[nombre]?.[1] || "";
}

async function buscarUUID() {
  const input = document.getElementById("uuidInput");
  const uuid = input.value.trim();

  if (!uuid) {
    mostrarToast("Coloca un UUID.");
    return;
  }

  mostrarCargaModal("Buscando factura...");

  const { data, error } = await buscarFacturaPorUUID(uuid);

  if (error) {
    cerrarModal();
    mostrarToast("Error al buscar factura.");
    return;
  }

  if (!data) {
    cerrarModal();
    mostrarToast("No se encontró factura con ese UUID.");
    return;
  }

  facturaActual = data;
  modalContenido.innerHTML = renderFacturaEncontrada(data);
}

async function buscarYEditar(uuid) {
  mostrarCargaModal("Cargando factura...");

  const { data, error } = await buscarFacturaPorUUID(uuid);

  if (error || !data) {
    cerrarModal();
    mostrarToast("No se pudo cargar factura.");
    return;
  }

  facturaActual = data;
  cerrarModal();
  await abrirFacturaActual();
}

async function abrirFacturaActual() {
  if (!facturaActual) return;

  mostrarCargaModal("Cargando historial...");

  const { data, error } = await cargarHistorial(facturaActual.uuid_cfdi);

  if (error) {
    cerrarModal();
    mostrarToast("Error al cargar historial.");
    return;
  }

  historialActual = data || [];
  vistas.editor.innerHTML = renderEditor(facturaActual, historialActual);

  cerrarModal();
  Object.values(vistas).forEach(v => v.classList.add("oculto"));
  vistas.editor.classList.remove("oculto");

  document.getElementById("tituloVista").textContent = "Edición de observación";
  document.getElementById("subtituloVista").textContent = facturaActual.uuid_cfdi;
}

async function accionMarcar() {
  const { usuario, nota } = leerFormularioAccion();

  if (!nota) {
    mostrarToast("Escribe el motivo de observación.");
    return;
  }

  mostrarCargaModal("Marcando factura...");

  const { error } = await marcarFactura(facturaActual, nota, usuario);

  if (error) {
    cerrarModal();
    mostrarToast("Error al marcar factura.");
    return;
  }

  await insertarHistorial(facturaActual, "MARCAR", nota, usuario);
  await recargarFacturaActual();
  cerrarModal();
  mostrarToast("Factura marcada en observación.");
}

async function accionNota() {
  const { usuario, nota } = leerFormularioAccion();

  if (!nota) {
    mostrarToast("Escribe una nota.");
    return;
  }

  mostrarCargaModal("Guardando nota...");

  const { error } = await actualizarNotaFactura(facturaActual, nota);

  if (error) {
    cerrarModal();
    mostrarToast("Error al guardar nota.");
    return;
  }

  await insertarHistorial(facturaActual, "NOTA", nota, usuario);
  await recargarFacturaActual();
  cerrarModal();
  mostrarToast("Nota agregada.");
}

async function accionDesmarcar() {
  const { usuario, nota } = leerFormularioAccion();
  const notaFinal = nota || "Factura confirmada.";

  mostrarCargaModal("Confirmando factura...");

  const { error } = await desmarcarFactura(facturaActual, notaFinal, usuario);

  if (error) {
    cerrarModal();
    mostrarToast("Error al confirmar factura.");
    return;
  }

  await insertarHistorial(facturaActual, "DESMARCAR", notaFinal, usuario);
  await recargarFacturaActual();
  cerrarModal();
  mostrarToast("Factura desmarcada / confirmada.");
}

function leerFormularioAccion() {
  return {
    usuario: document.getElementById("usuarioInput").value.trim() || "SIN USUARIO",
    nota: document.getElementById("notaInput").value.trim()
  };
}

async function recargarFacturaActual() {
  const { data } = await buscarFacturaPorUUID(facturaActual.uuid_cfdi);
  facturaActual = data;
  await abrirFacturaActual();
  await refrescarObservadas();
}

async function refrescarObservadas() {
  const { data, error } = await listarObservadas();

  if (error) {
    observadas = [];
    return;
  }

  observadas = data || [];

  const contador = document.getElementById("contadorObservadas");
  if (contador) contador.textContent = `${observadas.length} observadas`;

  if (vistas.inicio) vistas.inicio.innerHTML = renderInicio(calcularStats(observadas));
  if (vistas.observadas) vistas.observadas.innerHTML = renderObservadas(observadas);
  if (vistas.reporte) vistas.reporte.innerHTML = renderReporte(observadas);
}

function mostrarCargaModal(texto) {
  modalContenido.innerHTML = `
    <div class="modal-loading">
      <div class="spinner"></div>
      <h2>${texto}</h2>
      <p>Espere un momento...</p>
    </div>
  `;
  modal.classList.remove("oculto");
}

function cerrarModal() {
  modal.classList.add("oculto");
}

function mostrarToast(texto) {
  toast.textContent = texto;
  toast.classList.remove("oculto");

  setTimeout(() => {
    toast.classList.add("oculto");
  }, 3000);
}

function pausa(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
const loginView = document.getElementById("loginView");

function prepararAuth() {
  observarSesion(async user => {
    if (!user) {
      loader.classList.add("oculto");
      app.classList.add("oculto");
      loginView.classList.remove("oculto");
      return;
    }

    loginView.classList.add("oculto");
    loader.classList.remove("oculto");
    await iniciarApp();
  });

  document.getElementById("btnLogin").addEventListener("click", hacerLogin);

  document.getElementById("loginPassword").addEventListener("keydown", async e => {
    if (e.key === "Enter") await hacerLogin();
  });

  document.getElementById("btnLogout").addEventListener("click", async () => {
    await logout();
    location.reload();
  });
}

async function hacerLogin() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  if (!email || !password) {
    mostrarToast("Coloca correo y contraseña.");
    return;
  }

  try {
    await login(email, password);
  } catch (err) {
    console.error(err);
    mostrarToast("Acceso no autorizado o contraseña incorrecta.");
  }
}

function generarExcelObservadas() {
  const datos = observadas.map(f => ({
    Fecha: (f.fecha || "").substring(0, 10),
    function generarExcelObservadas() {
  const datos = observadas.map(f => ({
    Fecha: (f.fecha || "").substring(0, 10),

    "Días Transcurridos": Math.max(
      0,
      Math.floor((new Date() - new Date(f.fecha)) / 86400000)
    ),

    UUID: f.uuid_cfdi || "",

    RFC: f.rfc_emisor || "",

    "Nombre Proveedor": f.razon_social_emisor || "",

    "Serie-Folio": [f.serie, f.folio].filter(Boolean).join("-"),

    Importe: Number(f.total || 0),

    "Físicamente": f.factura_fisicamente || "NO"
  }));

  const ws = XLSX.utils.json_to_sheet(datos);

  ws["!cols"] = [
    { wch: 14 },
    { wch: 18 },
    { wch: 40 },
    { wch: 18 },
    { wch: 45 },
    { wch: 25 },
    { wch: 15 },
    { wch: 12 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "FACTURAS_OBSERVADAS");
  XLSX.writeFile(wb, "FACTURAS_OBSERVADAS.xlsx");
}
    
UUID: f.uuid_cfdi || "",
RFC: f.rfc_emisor || "",
    "Nombre Proveedor": f.razon_social_emisor || "",
    "Serie-Folio": [f.serie, f.folio].filter(Boolean).join("-"),
    Importe: Number(f.total || 0),
    "Físicamente": f.factura_fisicamente || "NO"
  }));

  const ws = XLSX.utils.json_to_sheet(datos);

  ws["!cols"] = [
    { wch: 14 },
    { wch: 18 },
    { wch: 20 },
    { wch: 18 },
    { wch: 45 },
    { wch: 25 },
    { wch: 15 },
    { wch: 12 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "FACTURAS_OBSERVADAS");
  XLSX.writeFile(wb, "FACTURAS_OBSERVADAS.xlsx");
}

