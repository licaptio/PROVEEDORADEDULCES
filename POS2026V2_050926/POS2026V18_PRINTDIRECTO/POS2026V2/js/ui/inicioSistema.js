import {
  cargarCatalogo,
  actualizarCatalogoIncremental,
  cargarCatalogoFotos,
  obtenerCatalogo
} from "../catalogo/catalogo.js";
import {
  migrarLocalStorageAIndexedDB,
  obtenerProductos,
  obtenerFotos
} from "../catalogo/indexeddb.js";

function elementos() {
  return {
    overlay: document.getElementById("bloqueoInicio"),
    titulo: document.getElementById("inicioTitulo"),
    mensaje: document.getElementById("inicioMensaje"),
    progreso: document.getElementById("inicioProgreso"),
    porcentaje: document.getElementById("inicioPorcentaje"),
    detalle: document.getElementById("inicioDetalle"),
    spinner: document.querySelector(".inicio-spinner"),
    acciones: document.getElementById("inicioAcciones"),
    reintentar: document.getElementById("btnInicioReintentar"),
    offline: document.getElementById("btnInicioOffline")
  };
}

function estado(porcentaje, mensaje, lineas = []) {
  const e = elementos();
  e.mensaje.textContent = mensaje;
  e.progreso.style.width = `${porcentaje}%`;
  e.porcentaje.textContent = `${porcentaje}%`;
  e.detalle.innerHTML = lineas.join("");
}

function linea(tipo, texto) {
  const icono = tipo === "ok" ? "✓" : tipo === "aviso" ? "⚠" : "✕";
  return `<div class="${tipo}">${icono} ${texto}</div>`;
}

function esperarDecision(permiteOffline) {
  const e = elementos();
  e.acciones.classList.remove("oculto");
  e.offline.style.display = permiteOffline ? "" : "none";
  return new Promise(resolve => {
    e.reintentar.onclick = () => { e.acciones.classList.add("oculto"); resolve("reintentar"); };
    e.offline.onclick = () => { e.acciones.classList.add("oculto"); resolve("offline"); };
  });
}

async function prepararCatalogo(db, productosLocales) {
  const activosLocales = productosLocales.filter(p => p.activo !== false).length;

  while (true) {
    try {
      if (activosLocales > 0) {
        await cargarCatalogo(db, false, false);
        estado(48, "Buscando actualizaciones…", [
          linea("ok", `Catálogo local: ${activosLocales.toLocaleString("es-MX")} productos`)
        ]);
        await actualizarCatalogoIncremental(db, false);
      } else {
        estado(38, "Descargando catálogo inicial…", [
          linea("aviso", "Este equipo todavía no tiene catálogo local")
        ]);
        await cargarCatalogo(db, true, false);
      }

      const activos = obtenerCatalogo().filter(p => p.activo !== false).length;
      if (!activos) throw new Error("Firebase no devolvió productos activos");

      return { activos, cambios: Number(window.__ULTIMOS_CAMBIOS_CATALOGO || 0), firebase: true };
    } catch (err) {
      if (activosLocales > 0) {
        await cargarCatalogo(db, false, false);
        const decision = await mostrarErrorConCatalogo(activosLocales, err);
        if (decision === "offline") return { activos: activosLocales, cambios: 0, firebase: false };
      } else {
        await mostrarErrorSinCatalogo(err);
      }
    }
  }
}

async function mostrarErrorConCatalogo(total, err) {
  const e = elementos();
  e.titulo.textContent = "CATÁLOGO LOCAL DISPONIBLE";
  e.spinner.className = "inicio-spinner error";
  estado(55, "No se pudieron consultar actualizaciones", [
    linea("ok", `${total.toLocaleString("es-MX")} productos disponibles`),
    linea("aviso", "Puedes continuar trabajando sin conexión"),
    linea("error", err?.message || "Firebase no respondió")
  ]);
  const r = await esperarDecision(true);
  e.titulo.textContent = "PREPARANDO PROVSOFT POS";
  e.spinner.className = "inicio-spinner";
  return r;
}

async function mostrarErrorSinCatalogo(err) {
  const e = elementos();
  e.titulo.textContent = "NO SE PUDO DESCARGAR EL CATÁLOGO";
  e.spinner.className = "inicio-spinner error";
  estado(35, "El punto de venta no puede iniciar", [
    linea("error", "No existen productos guardados en este equipo"),
    linea("aviso", "Revisa internet y la configuración de Firebase"),
    linea("error", err?.message || "Firebase no respondió")
  ]);
  await esperarDecision(false);
  e.titulo.textContent = "PREPARANDO PROVSOFT POS";
  e.spinner.className = "inicio-spinner";
}

export async function prepararSistemaAntesDelLogin(db) {
  const e = elementos();
  e.overlay.classList.remove("saliendo");

  estado(8, "Preparando base local…");
  await migrarLocalStorageAIndexedDB();
  estado(22, "Cargando catálogo local…", [linea("ok", "Base IndexedDB preparada")]);

  const productosLocales = await obtenerProductos();
  const resultado = await prepararCatalogo(db, productosLocales);

  estado(76, "Preparando fotografías locales…", [
    linea("ok", `Catálogo: ${resultado.activos.toLocaleString("es-MX")} productos`),
    resultado.firebase
      ? linea("ok", `Actualización: ${resultado.cambios.toLocaleString("es-MX")} cambios`)
      : linea("aviso", "Modo offline con catálogo local")
  ]);

  const fotosLocales = await obtenerFotos();
  await cargarCatalogoFotos(db);

  estado(100, "Sistema listo", [
    linea("ok", `Catálogo: ${resultado.activos.toLocaleString("es-MX")} productos`),
    linea("ok", `Fotografías locales: ${fotosLocales.length.toLocaleString("es-MX")}`),
    resultado.firebase ? linea("ok", "Conexión Firebase correcta") : linea("aviso", "Trabajando sin conexión")
  ]);

  e.spinner.className = "inicio-spinner listo";
  await new Promise(resolve => setTimeout(resolve, 650));
  document.getElementById("loginScreen").style.display = "";
  e.overlay.classList.add("saliendo");
  setTimeout(() => e.overlay.remove(), 500);
  return resultado;
}
