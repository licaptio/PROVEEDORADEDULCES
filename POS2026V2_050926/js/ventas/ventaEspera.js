import { db } from "../firebase/config.js";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  carrito,
  calcularTotales,
  limpiarCarrito,
  reemplazarCarrito,
  limpiarBitacoraCancelacionesPartidas,
  limpiarBitacoraCambiosCantidad
} from "../carrito/carrito.js";

import { getUsuarioLogueado } from "../auth/login.js";
import { obtenerRutaVentaPorUsuario, obtenerSegmentosVentas } from "../config/usuariosVentas.js";
import { toast } from "../ui/toast.js";
import { pintarProximoFolio } from "../ui/folioVisible.js";
import { guardarVentaEnEsperaFirestore, cancelarVentaFirestore } from "./guardarVenta.js";
import { guardarDatoLocal } from "../catalogo/indexeddb.js";
import { seleccionarMotivoCancelacion } from "./motivosCancelacion.js";

const ROLES_AUTORIZADOS_ESPERA = [
  "ADMIN",
  "ADMINISTRADOR",
  "SUPERVISOR",
  "GERENTE"
];
const PASSWORD_SUPERVISOR_CANCELAR = "MADERO690*";

export function iniciarVentaEnEspera() {
  const btn = document.getElementById("btnVentaEspera");
  if (!btn) return;

  btn.addEventListener("click", mandarVentaEnEspera);
}

async function mandarVentaEnEspera() {
  if (!carrito.length) {
    toast("No hay productos para mandar a espera.");
    return;
  }

  const motivoSeleccionado = await pedirMotivoVentaEspera();
  if (!motivoSeleccionado) return;

  const motivo = motivoSeleccionado.texto;
  const motivoCodigo = motivoSeleccionado.codigo;

  const supervisor = await pedirAutorizacionSupervisor();
  if (!supervisor) {
    toast("Autorización rechazada.");
    return;
  }

  const confirmar = confirm(
    `¿Mandar esta venta a espera?\n\nMotivo: ${motivo}\nAutoriza: ${supervisor.nombre || supervisor.usuario || "SUPERVISOR"}`
  );
  if (!confirmar) return;

  try {
    toast("Guardando venta en espera...");

    const tot = calcularTotales();
    const detalle = carrito.map(x => ({ ...x }));
    const usuario = getUsuarioLogueado();

    const ventaBase = {
      cliente: "PÚBLICO EN GENERAL",
      cliente_info: {
        id: null,
        nombre: "PÚBLICO EN GENERAL",
        rfc: "XAXX010101000"
      },
      subtotal: tot.subtotal,
      iva: tot.iva,
      ieps: tot.ieps,
      impuestos: tot.impuestos,
      total: tot.total,
      descuento_porcentaje: 0,
      descuento_monto: 0,
      costo_total: 0,
      utilidad_total: 0,
      margen_porcentaje: 0,
      comision_total: 0,
      cantidad_articulos: tot.piezas,
      cantidad_renglones: detalle.length,
      recibido: 0,
      cambio: 0,
      detalle,
      motivo_espera: motivo,
      motivo_espera_codigo: motivoCodigo,
      autorizado_por: supervisor.nombre || supervisor.usuario || "SUPERVISOR",
      autorizacion_espera: {
        autorizado: true,
        autorizado_por_id: supervisor.id || null,
        autorizado_por_nombre: supervisor.nombre || supervisor.usuario || "SUPERVISOR",
        autorizado_por_usuario: supervisor.usuario || null,
        autorizado_por_rol: supervisor.rol || supervisor.tipo || "SUPERVISOR",
        fecha_autorizacion_local_iso: new Date().toISOString(),
        motivo,
        motivo_codigo: motivoCodigo,
        solicitado_por_id: usuario?.id || null,
        solicitado_por_nombre: usuario?.nombre || usuario?.usuario || null,
        solicitado_por_usuario: usuario?.usuario || null
      }
    };

    const venta = await guardarVentaEnEsperaFirestore(ventaBase);

    await guardarDatoLocal("ultimaVentaEnEsperaPOS", {
      documento_id: venta.documento_id,
      folio: venta.folio,
      estado_venta: venta.estado_venta,
      total: venta.resumen_financiero?.total || venta.total || 0
    });

    limpiarCarrito();
    limpiarBitacoraCancelacionesPartidas();
    limpiarBitacoraCambiosCantidad();
    await pintarProximoFolio();

    toast(`Venta enviada a espera: ${venta.folio}`);
  } catch (err) {
    console.error("Error mandando venta en espera:", err);
    toast("Error al mandar venta en espera.");
  }
}

function pedirMotivoVentaEspera() {
  const motivos = [
    { codigo: "CLIENTE_OLVIDO_DINERO", texto: "Cliente olvidó dinero" },
    { codigo: "CANCELACION_LEJANA", texto: "Cancelación lejana" },
    { codigo: "CORRECCION_PARTIDA", texto: "Corrección de partida" },
    { codigo: "REVISION_PRECIO", texto: "Revisión de precio" },
    { codigo: "OTRO", texto: "Otro" }
  ];

  return new Promise(resolve => {
    const anterior = document.getElementById("modalMotivoVentaEspera");
    if (anterior) anterior.remove();

    const modal = document.createElement("div");
    modal.id = "modalMotivoVentaEspera";
    modal.className = "modal visible";

    modal.innerHTML = `
      <div class="modal-contenido modal-motivo-espera">
        <h2>Motivo para mandar a espera</h2>
        <p>Selecciona una opción. No se captura texto manual.</p>

        <div class="motivos-espera-grid">
          ${motivos.map(m => `
            <button type="button" class="btnMotivoEspera" data-codigo="${m.codigo}" data-texto="${m.texto}">
              ${m.texto}
            </button>
          `).join("")}
        </div>

        <div class="modal-acciones">
          <button type="button" id="btnCancelarMotivoEspera">Cancelar</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const cerrar = valor => {
      modal.remove();
      resolve(valor);
    };

    modal.querySelectorAll(".btnMotivoEspera").forEach(btn => {
      btn.addEventListener("click", () => {
        cerrar({
          codigo: btn.dataset.codigo,
          texto: btn.dataset.texto
        });
      });
    });

    document
      .getElementById("btnCancelarMotivoEspera")
      ?.addEventListener("click", () => cerrar(null));
  });
}

async function pedirAutorizacionSupervisor() {
  const credenciales = await mostrarModalAutorizacionSupervisor();
  if (!credenciales) return null;

  const usuario = String(credenciales.usuario || "").trim();
  const pass = String(credenciales.password || "").trim();

  if (!usuario || !pass) {
    alert("Captura usuario y contraseña de supervisor/admin.");
    return null;
  }

  try {
    const q = query(
      collection(db, "usuarios_ruta"),
      where("usuario", "==", usuario),
      where("password", "==", pass),
      where("activo", "==", true)
    );

    const snap = await getDocs(q);
    if (snap.empty) {
      alert("Usuario o contraseña de supervisor/admin incorrectos.");
      return null;
    }

    const data = snap.docs[0].data();
    const rol = String(data.rol || data.tipo || "").toUpperCase();

    if (!ROLES_AUTORIZADOS_ESPERA.includes(rol)) {
      alert("El usuario existe, pero no tiene permiso para mandar ventas a espera.");
      return null;
    }

    return {
      id: snap.docs[0].id,
      ...data,
      rol
    };
  } catch (err) {
    console.error("Error validando supervisor:", err);
    alert("No se pudo validar supervisor en Firebase.");
    return null;
  }
}

function mostrarModalAutorizacionSupervisor() {
  return new Promise(resolve => {
    const anterior = document.getElementById("modalAutorizaSupervisor");
    if (anterior) anterior.remove();

    const modal = document.createElement("div");
    modal.id = "modalAutorizaSupervisor";
    modal.className = "modal visible";

    modal.innerHTML = `
      <div class="modal-contenido modal-autoriza-supervisor">
        <h2>Autorización supervisor/admin</h2>
        <p>Usa un usuario activo del catálogo de Firebase con rol ADMIN, ADMINISTRADOR, SUPERVISOR o GERENTE.</p>

        <label>Usuario</label>
        <input id="inputSupervisorUsuario" type="text" autocomplete="off">

        <label>Contraseña</label>
        <input id="inputSupervisorPassword" type="password" autocomplete="off">

        <div class="modal-acciones">
          <button type="button" id="btnAutorizarSupervisor">Autorizar</button>
          <button type="button" id="btnCancelarAutorizaSupervisor">Cancelar</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const inputUsuario = document.getElementById("inputSupervisorUsuario");
    const inputPassword = document.getElementById("inputSupervisorPassword");

    const cerrar = valor => {
      modal.remove();
      resolve(valor);
    };

    document.getElementById("btnAutorizarSupervisor")?.addEventListener("click", () => {
      cerrar({
        usuario: inputUsuario?.value || "",
        password: inputPassword?.value || ""
      });
    });

    document.getElementById("btnCancelarAutorizaSupervisor")?.addEventListener("click", () => cerrar(null));

    inputPassword?.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        document.getElementById("btnAutorizarSupervisor")?.click();
      }
    });

    setTimeout(() => inputUsuario?.focus(), 50);
  });
}


export function iniciarRecuperarVentasEnEspera() {
  const btn = document.getElementById("btnRecuperarVentaEspera");
  if (!btn) return;

  btn.addEventListener("click", abrirVentasEnEspera);
}

async function abrirVentasEnEspera() {
  try {
    toast("Buscando ventas en espera...");

    const ventas = await buscarVentasEnEsperaPendientes();

    if (!ventas.length) {
      alert("No hay ventas en espera pendientes.");
      return;
    }

    mostrarModalVentasEnEspera(ventas);
  } catch (err) {
    console.error("Error recuperando ventas en espera:", err);
    alert("No se pudieron cargar las ventas en espera.");
  }
}

async function buscarVentasEnEsperaPendientes() {
  const usuario = getUsuarioLogueado();
  const rutaVenta = obtenerRutaVentaPorUsuario(usuario);

  const ref = collection(
    db,
    ...obtenerSegmentosVentas(rutaVenta)
  );

  const q = query(
    ref,
    where("estado_venta", "in", ["EN_ESPERA", "REGRESADA_A_CAJA"]),
    where("cobrada", "==", false),
    where("eliminada", "==", false)
  );

  const snap = await getDocs(q);

  const ventas = [];
  snap.forEach(d => {
    const data = d.data();
    if (data.cancelada === true || data.eliminada === true || data.cobrada === true) return;
    if (String(data.usuarioLogin || "") !== String(usuario?.usuario || "")) return;
    ventas.push({ id: d.id, ...data });
  });

  ventas.sort((a, b) => String(b.fecha_local_iso || "").localeCompare(String(a.fecha_local_iso || "")));
  return ventas;
}

function mostrarModalVentasEnEspera(ventas) {
  const existente = document.getElementById("modalVentasEnEspera");
  if (existente) existente.remove();

  const modal = document.createElement("div");
  modal.id = "modalVentasEnEspera";
  modal.className = "modal visible";

  const filas = ventas.map(v => {
    const total = Number(v?.resumen_financiero?.total || 0).toLocaleString("es-MX", {
      style: "currency",
      currency: "MXN"
    });

    return `
      <div class="venta-espera-item">
        <div>
          <strong>${v.folio || v.id}</strong><br>
          <small>${v.fecha_txt || v.fecha_local_iso || ""}</small><br>
          <small>Motivo: ${v.motivo_espera || "VENTA EN ESPERA"}</small>
        </div>
        <div class="venta-espera-total">${total}</div>
        <button type="button" class="btnRecuperarVentaEsperaItem" data-id="${v.id}">
          Recuperar
        </button>
        <button type="button" class="btnCancelarVentaEsperaItem" data-id="${v.id}">
          Cancelar
        </button>
      </div>
    `;
  }).join("");

  modal.innerHTML = `
    <div class="modal-contenido modal-ventas-espera">
      <h2>Ventas en Espera</h2>
      <div class="ventas-espera-lista">
        ${filas}
      </div>
      <div class="modal-acciones">
        <button type="button" id="btnCerrarVentasEnEspera">Cerrar</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("btnCerrarVentasEnEspera")?.addEventListener("click", () => modal.remove());

  modal.querySelectorAll(".btnRecuperarVentaEsperaItem").forEach(btn => {
    btn.addEventListener("click", async () => {
      const venta = ventas.find(v => String(v.id) === String(btn.dataset.id));
      if (!venta) return;

      await recuperarVentaEnEspera(venta);
      modal.remove();
    });
  });

  modal.querySelectorAll(".btnCancelarVentaEsperaItem").forEach(btn => {
    btn.addEventListener("click", async () => {
      const venta = ventas.find(v => String(v.id) === String(btn.dataset.id));
      if (!venta) return;

      const pass = prompt(`Contraseña supervisor para cancelar ${venta.folio || venta.id}:`);
      if (pass !== PASSWORD_SUPERVISOR_CANCELAR) {
        toast("Contraseña incorrecta");
        return;
      }

      const motivoSeleccionado = await seleccionarMotivoCancelacion(
        `Cancelar ${venta.folio || venta.id}`
      );
      if (!motivoSeleccionado) return;

      if (!confirm(
        `¿Cancelar definitivamente ${venta.folio || venta.id}?\n\nMotivo: ${motivoSeleccionado.texto}`
      )) return;

      try {
        btn.disabled = true;
        btn.textContent = "Cancelando...";
        await cancelarVentaFirestore(
          venta.id,
          motivoSeleccionado.texto,
          motivoSeleccionado.codigo
        );

        const restantes = ventas.filter(v => String(v.id) !== String(venta.id));
        modal.remove();

        if (restantes.length) {
          mostrarModalVentasEnEspera(restantes);
        } else {
          alert("No hay más ventas en espera pendientes.");
        }

        toast("Venta en espera cancelada");
      } catch (err) {
        console.error("Error cancelando venta en espera:", err);
        btn.disabled = false;
        btn.textContent = "Cancelar";
        toast("No se pudo cancelar la venta en espera");
      }
    });
  });
}

async function recuperarVentaEnEspera(venta) {
  if (carrito.length) {
    const ok = confirm("Hay una venta capturada en pantalla. ¿Reemplazarla por la venta en espera?");
    if (!ok) return;
  }

  const detalle = Array.isArray(venta.detalle) ? venta.detalle : [];
  if (!detalle.length) {
    alert("La venta seleccionada no tiene partidas.");
    return;
  }

  const usuario = getUsuarioLogueado();
  const rutaVenta = obtenerRutaVentaPorUsuario(usuario);

  const ref = doc(db, ...obtenerSegmentosVentas(rutaVenta), venta.id);

  await updateDoc(ref, {
    estado_venta: "REGRESADA_A_CAJA",
    bloqueada_por_admin: false,
    fecha_regreso_caja: serverTimestamp(),
    recuperada_por: usuario?.nombre || usuario?.usuario || "SIN USUARIO"
  });

  reemplazarCarrito(detalle);

  await guardarDatoLocal("ventaEnEsperaRecuperadaPOS", {
    documento_id: venta.id,
    folio: venta.folio || null,
    estado_venta: "REGRESADA_A_CAJA"
  });

  toast(`Venta recuperada: ${venta.folio || venta.id}`);
}
