import { catalogo } from "../catalogo/catalogo.js";
import { agregarProducto } from "../carrito/carrito.js";
import { money } from "../util/money.js";
import { toast } from "../ui/toast.js";

function normalizar(txt) {
  return String(txt || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.\/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buscarFlexible(texto) {
  const palabras = normalizar(texto).split(" ").filter(Boolean);
  if (!palabras.length) return [];

  return catalogo
    .map(prod => {
      const base = normalizar(`${prod.codigo || ""} ${prod.nombre || ""}`);
      const baseCompacta = base.replace(/[^a-z0-9]/g, "");
      let score = 0;

      const coincidencias = palabras.map(p => {
        const palabraCompacta = p.replace(/[^a-z0-9]/g, "");
        const coincide = base.includes(p) || (
          palabraCompacta.length > 0 && baseCompacta.includes(palabraCompacta)
        );

        if (coincide) score += base.includes(p) ? 120 : 100;
        return coincide;
      });

      const coincidenTodas = coincidencias.every(Boolean);
      if (coincidenTodas) score += 600;
      if (base.includes(normalizar(texto))) score += 300;

      return { prod, score, coincidenTodas };
    })
    .filter(x => x.coincidenTodas)
    .sort((a, b) => b.score - a.score)
    .slice(0, 80)
    .map(x => x.prod);
}

export function abrirBusquedaManual(textoInicial = "") {
  document.getElementById("pantallaBusquedaManual")?.remove();

  const modal = document.createElement("div");
  modal.id = "pantallaBusquedaManual";

  modal.innerHTML = `
    <div style="
      position:fixed;
      inset:0;
      z-index:99999;
      background:rgba(0,0,0,.35);
      display:flex;
      align-items:center;
      justify-content:center;
    ">
      <div style="
        width:72vw;
        height:64vh;
        background:white;
        border:5px solid #990000;
        border-radius:28px;
        box-shadow:0 18px 45px rgba(0,0,0,.45);
        padding:22px;
        display:flex;
        flex-direction:column;
      ">

        <div style="
          display:flex;
          align-items:center;
          justify-content:space-between;
          margin-bottom:14px;
        ">
          <h1 style="
            margin:0;
            font-size:42px;
            font-weight:900;
            color:#000;
          ">
            BUSCAR PRODUCTO
          </h1>

          <button id="cerrarBusquedaManual" style="
            width:58px;
            height:52px;
            border:none;
            border-radius:12px;
            background:#111;
            color:white;
            font-size:32px;
            font-weight:900;
            cursor:pointer;
          ">×</button>
        </div>

        <input
          id="inputBusquedaManual"
          type="text"
          placeholder="Ej. BIG 3.3 / COLA C/6 / C/6 COLA BIG"
          autocomplete="off"
          style="
            height:58px;
            font-size:28px;
            padding:0 18px;
            border:2px solid #aaa;
            border-radius:10px;
            outline:none;
            margin-bottom:14px;
          "
        >

        <div id="listaBusquedaManual" style="
          flex:1;
          overflow-y:auto;
          border-top:1px solid #ddd;
        ">
          <div style="
            height:100%;
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:24px;
            color:#777;
          ">
            Teclea para buscar productos
          </div>
        </div>

      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const input = document.getElementById("inputBusquedaManual");
  const lista = document.getElementById("listaBusquedaManual");
  const cerrar = document.getElementById("cerrarBusquedaManual");

  cerrar.onclick = cerrarModal;

  input.addEventListener("input", () => {
    const texto = input.value.trim();

    if (texto.length < 2) {
      lista.innerHTML = `
        <div style="height:100%;display:flex;align-items:center;justify-content:center;font-size:24px;color:#777;">
          Teclea para buscar productos
        </div>
      `;
      return;
    }

    const resultados = buscarFlexible(texto);

    if (!resultados.length) {
      lista.innerHTML = `
        <div style="height:100%;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:800;color:#777;">
          Sin coincidencias
        </div>
      `;
      return;
    }

    lista.innerHTML = "";

    resultados.forEach(prod => {
      const item = document.createElement("div");

      item.style.cssText = `
        display:grid;
        grid-template-columns:140px 1fr 140px;
        gap:14px;
        align-items:center;
        padding:14px 10px;
        border-bottom:1px solid #ddd;
        cursor:pointer;
        font-size:20px;
      `;

      item.innerHTML = `
        <strong>${prod.codigo || ""}</strong>
        <div style="font-weight:800;">${prod.nombre || ""}</div>
        <strong style="text-align:right;color:#990000;font-size:24px;">
          ${money(prod.precioPublico)}
        </strong>
      `;

      item.onclick = () => {
        agregarProducto(prod, 1);
        toast("Producto agregado");
        cerrarModal();
      };

      lista.appendChild(item);
    });
  });

  if (textoInicial) {
    input.value = String(textoInicial).trim();
    input.dispatchEvent(new Event("input"));
  }

  function cerrarModal() {
    modal.remove();
    document.getElementById("buscador")?.focus();
  }

  setTimeout(() => input.focus(), 80);
}
