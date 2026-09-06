import { money } from "../util/money.js";
import { toast } from "../ui/toast.js";
import { mostrarFotosPorCodigoLocal } from "../fotos/fotoProductoVista.js";
import { eliminarDatoLocal } from "../catalogo/indexeddb.js";

export let carrito = [];
export let bitacoraCancelacionesPartidas = [];
export let bitacoraCambiosCantidad = [];

const PASSWORD_SUPERVISOR_PARTIDA = "MADERO690*";
const PEDIR_PASSWORD_SI_CANTIDAD_MENOR = true;

function normalizarTasa(tasa) {
  const n = Number(tasa || 0);
  return n > 1 ? n / 100 : n;
}

export function obtenerBitacoraCancelacionesPartidas() {
  return bitacoraCancelacionesPartidas;
}

export function limpiarBitacoraCancelacionesPartidas() {
  bitacoraCancelacionesPartidas = [];
}
export function obtenerBitacoraCambiosCantidad() {
  return bitacoraCambiosCantidad;
}

export function limpiarBitacoraCambiosCantidad() {
  bitacoraCambiosCantidad = [];
}

export function agregarProducto(prod, cantidad = 1) {
  if (!prod) return;

  const existente = carrito.find(x => x.id === prod.id);
  const precio = Number(prod.precioPublico || prod.precio || 0);

  if (existente) {
    existente.cantidad += cantidad;
    existente.importe = +(existente.cantidad * existente.precioUnit).toFixed(2);
  } else {
    carrito.unshift({
      id: prod.id,
      codigo: prod.codigo || prod.codigoBarra || "",
      nombre: prod.nombre || prod.concepto || "SIN NOMBRE",

      cantidad,
      precioUnit: precio,
      importe: +(cantidad * precio).toFixed(2),

      ivaTasa: normalizarTasa(prod.ivaTasa),
      iepsTasa: normalizarTasa(prod.iepsTasa),

      costoUnit: Number(prod.costoUnit || prod.costoSinImpuesto || 0),

      departamento_id: prod.departamento_id || null,
      departamento: prod.departamento || null,

      comision_tipo: prod.comision_tipo || null,
      comision_valor: Number(prod.comision_valor || 0),

      permite_descuento: prod.permite_descuento !== false
    });
  }

  mostrarFotosPorCodigoLocal(
    prod.codigoBarra || prod.codigo || prod.id
  );

  renderCarrito();
}

export function eliminarProducto(id) {
  const item = carrito.find(x => String(x.id) === String(id));
  if (!item) return;

  const pass = prompt(
    `Supervisor requerido para cancelar partida:\n\n${item.nombre}\n${money(item.importe)}\n\nContraseña:`
  );

  if (pass !== PASSWORD_SUPERVISOR_PARTIDA) {
    toast("Contraseña incorrecta");
    return;
  }

  const motivo = prompt("Motivo de cancelación de partida:");

  if (!motivo || !motivo.trim()) {
    toast("Cancelación de partida sin motivo no permitida");
    return;
  }

  const confirmar = confirm(
    `¿Cancelar partida?\n\n${item.nombre}\nImporte: ${money(item.importe)}\nMotivo: ${motivo.trim()}`
  );

  if (!confirmar) {
    toast("Cancelación de partida abortada");
    return;
  }

  bitacoraCancelacionesPartidas.push({
    fecha_local_iso: new Date().toISOString(),
    codigo: item.codigo || null,
    nombre: item.nombre || "",
    cantidad: Number(item.cantidad || 0),
    precio_unit: Number(item.precioUnit || 0),
    importe: Number(item.importe || 0),
    motivo: motivo.trim()
  });

  carrito = carrito.filter(x => String(x.id) !== String(id));

  renderCarrito();

  toast("Partida cancelada");
}

export function actualizarCantidad(id, nuevaCantidad) {
  const item = carrito.find(x => String(x.id) === String(id));
  if (!item) return;

  const cantidadAnterior = Number(item.cantidad || 0);
  const cantidadNueva = Number(nuevaCantidad);

  if (!cantidadNueva || cantidadNueva <= 0) {
    eliminarProducto(id);
    return;
  }

  if (cantidadNueva === cantidadAnterior) {
    renderCarrito();
    return;
  }

  const esReduccion = cantidadNueva < cantidadAnterior;

  if (PEDIR_PASSWORD_SI_CANTIDAD_MENOR && esReduccion) {
    const pass = prompt(
      `Supervisor requerido para reducir cantidad:\n\n${item.nombre}\nCantidad actual: ${cantidadAnterior}\nCantidad nueva: ${cantidadNueva}\n\nContraseña:`
    );

    if (pass !== PASSWORD_SUPERVISOR_PARTIDA) {
      toast("Contraseña incorrecta");
      renderCarrito();
      return;
    }
  }

  let motivo = "";

  if (esReduccion) {
    motivo = prompt("Motivo de reducción de cantidad:");

    if (!motivo || !motivo.trim()) {
      toast("Reducción sin motivo no permitida");
      renderCarrito();
      return;
    }
  } else {
    motivo = "Aumento de cantidad";
  }

  const importeAnterior = Number(item.importe || 0);

  item.cantidad = cantidadNueva;
  item.importe = +(item.cantidad * item.precioUnit).toFixed(2);

  bitacoraCambiosCantidad.push({
    fecha_local_iso: new Date().toISOString(),
    codigo: item.codigo || null,
    nombre: item.nombre || "",
    cantidad_anterior: cantidadAnterior,
    cantidad_nueva: cantidadNueva,
    diferencia: +(cantidadNueva - cantidadAnterior).toFixed(2),
    tipo_cambio: esReduccion ? "REDUCCION" : "AUMENTO",
    requiere_supervisor: esReduccion,
    precio_unit: Number(item.precioUnit || 0),
    importe_anterior: +importeAnterior.toFixed(2),
    importe_nuevo: Number(item.importe || 0),
    motivo: motivo.trim()
  });

  renderCarrito();

  toast("Cantidad modificada");
}
function abrirModalCantidad(id) {
  const item = carrito.find(x => String(x.id) === String(id));
  if (!item) return;

  document.getElementById("modalCantidadPOS")?.remove();

  const modal = document.createElement("div");
  modal.id = "modalCantidadPOS";

  modal.innerHTML = `
    <div style="
      position:fixed;
      inset:0;
      z-index:99999;
      background:rgba(0,0,0,.45);
      display:flex;
      align-items:center;
      justify-content:center;
    ">
      <div style="
        width:420px;
        background:white;
        border-radius:20px;
        box-shadow:0 18px 45px rgba(0,0,0,.45);
        overflow:hidden;
      ">
        <div style="
          background:#8b0000;
          color:white;
          padding:16px;
          font-size:24px;
          font-weight:900;
          text-align:center;
        ">
          CAMBIAR CANTIDAD
        </div>

        <div style="
          padding:22px;
          display:flex;
          flex-direction:column;
          gap:14px;
        ">
          <div style="font-size:16px;font-weight:800;">
            ${item.nombre}
          </div>

          <div style="font-size:15px;">
            Actual: <strong>${item.cantidad}</strong>
          </div>

          <input
            id="inputNuevaCantidad"
            type="number"
            min="0"
            step="0.01"
            value="${item.cantidad}"
            style="
              height:58px;
              font-size:28px;
              font-weight:900;
              text-align:center;
              border:2px solid #aaa;
              border-radius:12px;
              outline:none;
            "
          >

          <div style="
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:12px;
          ">
            <button id="btnCerrarModalCantidad" style="
              height:52px;
              background:#777;
              color:white;
              border:none;
              border-radius:12px;
              font-size:18px;
              font-weight:900;
            ">
              Cancelar
            </button>

            <button id="btnAceptarModalCantidad" style="
              height:52px;
              background:#8b0000;
              color:white;
              border:none;
              border-radius:12px;
              font-size:18px;
              font-weight:900;
            ">
              Aceptar
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const input = document.getElementById("inputNuevaCantidad");

  document
    .getElementById("btnCerrarModalCantidad")
    .addEventListener("click", () => modal.remove());

  document
    .getElementById("btnAceptarModalCantidad")
    .addEventListener("click", () => {
      actualizarCantidad(id, input.value);
      modal.remove();
    });

  setTimeout(() => {
    input.focus();
    input.select();
  }, 80);
}

export function limpiarCarrito() {
  carrito = [];
  eliminarDatoLocal("POS_VENTA_ACTUAL_LOCAL");
  eliminarDatoLocal("POS_VENTA_ACTUAL_LOCAL_HASH");
  renderCarrito();
}

export function reemplazarCarrito(nuevoCarrito = []) {
  carrito = Array.isArray(nuevoCarrito)
    ? nuevoCarrito.map(x => ({ ...x }))
    : [];
  renderCarrito();
}

export function calcularTotales() {
  let subtotal = 0;
  let iva = 0;
  let ieps = 0;

  carrito.forEach(it => {
    const importe = Number(it.importe || 0);
    const ivaTasa = normalizarTasa(it.ivaTasa);
    const iepsTasa = normalizarTasa(it.iepsTasa);

    let base = importe;

    if (iepsTasa > 0 && ivaTasa > 0) {
      base = importe / (1 + iepsTasa + ivaTasa * (1 + iepsTasa));
    } else if (iepsTasa > 0) {
      base = importe / (1 + iepsTasa);
    } else if (ivaTasa > 0) {
      base = importe / (1 + ivaTasa);
    }

    const iepsCalc = +(base * iepsTasa).toFixed(2);
    const ivaCalc = +((base + iepsCalc) * ivaTasa).toFixed(2);

    it.base = +base.toFixed(2);
    it.ivaTasa = ivaTasa;
    it.iepsTasa = iepsTasa;
    it.iva_calculado = ivaCalc;
    it.ieps_calculado = iepsCalc;

    subtotal += base;
    iva += ivaCalc;
    ieps += iepsCalc;
  });

  const subtotalFinal = +subtotal.toFixed(2);
  const ivaFinal = +iva.toFixed(2);
  const iepsFinal = +ieps.toFixed(2);
  const impuestos = +(ivaFinal + iepsFinal).toFixed(2);
  const total = +(subtotalFinal + impuestos).toFixed(2);

  return {
    subtotal: subtotalFinal,
    iva: ivaFinal,
    ieps: iepsFinal,
    impuestos,
    total,
    piezas: carrito.reduce((s, x) => s + Number(x.cantidad || 0), 0)
  };
}

export function renderCarrito() {
  const tbody = document.getElementById("tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  carrito.forEach(it => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${it.codigo}</td>
<td>
  <div class="cantidad-control">
    <span class="cantidad-texto">${it.cantidad}</span>
    <button
      class="btn-cantidad"
      data-id="${it.id}"
      title="Cambiar cantidad"
    >
      ✎
    </button>
  </div>
</td>

      <td>${it.nombre}</td>
      <td>${money(it.precioUnit)}</td>
      <td>${money(it.importe)}</td>
      <td>
        <button class="btn-eliminar" data-id="${it.id}">×</button>
      </td>
    `;

    tbody.appendChild(tr);
  });

tbody.querySelectorAll(".btn-cantidad").forEach(btn => {
  btn.addEventListener("click", e => {
    abrirModalCantidad(e.currentTarget.dataset.id);
  });
});

  tbody.querySelectorAll(".btn-eliminar").forEach(btn => {
    btn.addEventListener("click", e => {
      eliminarProducto(e.target.dataset.id);
    });
  });

  renderTotales();
}

export function renderTotales() {
  const tot = calcularTotales();

  document.getElementById("lblSubtotal").textContent = money(tot.subtotal);
  document.getElementById("lblImpuestos").textContent = money(tot.impuestos);
  document.getElementById("lblTotal").textContent = money(tot.total);

  const lblCantidad = document.getElementById("lblCantidad");
  if (lblCantidad) lblCantidad.textContent = tot.piezas;

  const lblDescuento = document.getElementById("lblDescuento");
  if (lblDescuento) lblDescuento.textContent = money(0);
}

export function obtenerCarrito() {
  return carrito;
}
