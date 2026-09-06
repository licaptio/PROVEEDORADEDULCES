import { db } from "../firebase/config.js";
import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { toast } from "../ui/toast.js";
import { guardarDatoLocal, obtenerDatoLocal } from "../catalogo/indexeddb.js";

const STORAGE_KEY = "POS_CONFIG_IMPRESION";
let configCache = null;
const ROLES_AUTORIZADOS_IMPRESION = [
  "ADMIN",
  "ADMINISTRADOR",
  "SUPERVISOR",
  "GERENTE"
];

export function obtenerConfigImpresion() {
  return configCache || { modo: detectarModoDefault(), impresoraWindows: "", copias: 1 };
}

function detectarModoDefault() {
  const ua = navigator.userAgent || "";
  return /Android/i.test(ua) ? "RAWBT" : "WINDOWS";
}

async function cargarConfigImpresion() {
  configCache = await obtenerDatoLocal(STORAGE_KEY, null);
}

async function guardarConfigImpresion(config) {
  configCache = config;
  await guardarDatoLocal(STORAGE_KEY, config);
}

export function iniciarConfiguracionImpresoras() {
  cargarConfigImpresion().catch(err => console.warn("No se pudo cargar configuración de impresión:", err));
  const btn = document.getElementById("btnConfigImpresoras");
  if (!btn) return;

  btn.addEventListener("click", abrirConfigImpresorasConAutorizacion);
}

async function abrirConfigImpresorasConAutorizacion() {
  const supervisor = await pedirAutorizacionConfigImpresion();
  if (!supervisor) {
    toast("Configuración de impresión no autorizada");
    return;
  }

  mostrarModalConfigImpresion(supervisor);
}

async function pedirAutorizacionConfigImpresion() {
  const credenciales = await mostrarModalCredencialesImpresion();
  if (!credenciales) return null;

  const usuario = String(credenciales.usuario || "").trim();
  const password = String(credenciales.password || "").trim();

  if (!usuario || !password) {
    alert("Captura usuario y contraseña de administrador/supervisor.");
    return null;
  }

  try {
    const q = query(
      collection(db, "usuarios_ruta"),
      where("usuario", "==", usuario),
      where("password", "==", password),
      where("activo", "==", true)
    );

    const snap = await getDocs(q);
    if (snap.empty) {
      alert("Usuario o contraseña incorrectos.");
      return null;
    }

    const data = snap.docs[0].data();
    const rol = String(data.rol || data.tipo || "").toUpperCase();

    if (!ROLES_AUTORIZADOS_IMPRESION.includes(rol)) {
      alert("El usuario no tiene permiso para configurar impresoras.");
      return null;
    }

    return {
      id: snap.docs[0].id,
      ...data,
      rol
    };
  } catch (err) {
    console.error("Error autorizando configuración de impresión:", err);
    alert("No se pudo validar el usuario en Firebase.");
    return null;
  }
}

function mostrarModalCredencialesImpresion() {
  return new Promise(resolve => {
    document.getElementById("modalAutorizaImpresion")?.remove();

    const modal = document.createElement("div");
    modal.id = "modalAutorizaImpresion";
    modal.className = "modal visible";

    modal.innerHTML = `
      <div class="modal-contenido" style="max-width:420px;">
        <h2>Autorizar impresoras</h2>
        <p>Solo ADMIN, ADMINISTRADOR, SUPERVISOR o GERENTE pueden cambiar esta configuración.</p>

        <label>Usuario</label>
        <input id="impAuthUsuario" type="text" autocomplete="off">

        <label>Contraseña</label>
        <input id="impAuthPassword" type="password" autocomplete="off">

        <div class="modal-acciones">
          <button type="button" id="btnAutorizarImp">Autorizar</button>
          <button type="button" id="btnCancelarAutorizarImp">Cancelar</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const cerrar = valor => {
      modal.remove();
      resolve(valor);
    };

    document.getElementById("btnAutorizarImp")?.addEventListener("click", () => {
      cerrar({
        usuario: document.getElementById("impAuthUsuario")?.value || "",
        password: document.getElementById("impAuthPassword")?.value || ""
      });
    });

    document.getElementById("btnCancelarAutorizarImp")?.addEventListener("click", () => cerrar(null));
    document.getElementById("impAuthPassword")?.addEventListener("keydown", e => {
      if (e.key === "Enter") document.getElementById("btnAutorizarImp")?.click();
    });

    setTimeout(() => document.getElementById("impAuthUsuario")?.focus(), 50);
  });
}

function mostrarModalConfigImpresion(supervisor) {
  document.getElementById("modalConfigImpresion")?.remove();

  const cfg = obtenerConfigImpresion();

  const modal = document.createElement("div");
  modal.id = "modalConfigImpresion";
  modal.className = "modal visible";

  modal.innerHTML = `
    <div class="modal-contenido" style="max-width:520px;">
      <h2>Configuración de impresión</h2>
      <p>Selecciona el modo para este dispositivo.</p>

      <label style="display:flex;gap:10px;align-items:center;font-weight:900;margin:12px 0;">
        <input type="radio" name="modoImpresion" value="RAWBT" ${cfg.modo === "RAWBT" ? "checked" : ""}>
        Android / RawBT
      </label>

      <label style="display:flex;gap:10px;align-items:center;font-weight:900;margin:12px 0;">
        <input type="radio" name="modoImpresion" value="WINDOWS" ${cfg.modo === "WINDOWS" ? "checked" : ""}>
        PC Windows / window.print()
      </label>

      <label>Nombre impresora Windows / referencia</label>
      <input id="inputImpresoraWindows" type="text" value="${escapar(cfg.impresoraWindows || "")}" placeholder="Ej. EPSON TM-T20III">

      <label>Copias</label>
      <input id="inputCopiasTicket" type="number" min="1" max="3" value="${Number(cfg.copias || 1)}">

      <div style="font-size:13px;color:#555;margin-top:10px;">
        Nota: Chrome no permite elegir impresora directa sin diálogo. En PC se usa la impresora predeterminada o el cuadro de impresión de Windows.
      </div>

      <div class="modal-acciones">
        <button type="button" id="btnGuardarConfigImp">Guardar</button>
        <button type="button" id="btnCancelarConfigImp">Cancelar</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("btnCancelarConfigImp")?.addEventListener("click", () => modal.remove());

  document.getElementById("btnGuardarConfigImp")?.addEventListener("click", async () => {
    const modo = document.querySelector("input[name='modoImpresion']:checked")?.value || "RAWBT";
    const copias = Math.min(3, Math.max(1, Number(document.getElementById("inputCopiasTicket")?.value || 1)));

    const nuevo = {
      modo,
      impresoraWindows: document.getElementById("inputImpresoraWindows")?.value || "",
      copias,
      fecha_configuracion: new Date().toISOString(),
      autorizado_por: {
        id: supervisor.id || null,
        nombre: supervisor.nombre || supervisor.usuario || null,
        usuario: supervisor.usuario || null,
        rol: supervisor.rol || null
      }
    };

    await guardarConfigImpresion(nuevo);
    modal.remove();
    toast(`Impresión configurada: ${modo}`);
  });
}

function escapar(texto) {
  return String(texto || "").replace(/[&<>\"]/g, s => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;"
  }[s]));
}
