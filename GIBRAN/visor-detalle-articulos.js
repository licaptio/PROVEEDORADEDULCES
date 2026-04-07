import { obtenerVentasRuta } from "./firebase.js";

document.getElementById("btnCargar").addEventListener("click", cargar);

function rangoDia(fecha) {
  const [y,m,d] = fecha.split("-").map(Number);
  return {
    inicio: new Date(y, m-1, d, 0,0,0),
    fin: new Date(y, m-1, d, 23,59,59)
  };
}

async function cargar() {
  const fecha = document.getElementById("fecha").value;
  const rutaId = document.getElementById("ruta").value;

  if (!fecha) return alert("Selecciona fecha");

  const { inicio, fin } = rangoDia(fecha);
  const ventas = await obtenerVentasRuta(rutaId, inicio, fin);

  pintarDetalle(ventas);
}

function pintarDetalle(ventas) {
  const tbody = document.getElementById("tabla");
  tbody.innerHTML = "";

  let totalDia = 0;
  let totalIVA = 0;
  let totalIEPS = 0;

  ventas.forEach(v => {
    if (!Array.isArray(v.detalle)) return;

    v.detalle.forEach(item => {

      const importe = Number(item.importe || 0);
      const iva = Number(item.iva_calculado || 0);
      const ieps = Number(item.ieps_calculado || 0);
      const totalLinea = importe + iva + ieps;

      totalDia += totalLinea;
      totalIVA += iva;
      totalIEPS += ieps;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${new Date(v.fecha.seconds * 1000).toLocaleTimeString()}</td>
        <td>${v.folio}</td>
        <td>${item.cantidad}</td>
        <td>${item.nombre}</td>
        <td>$${Number(item.precio_unit).toFixed(2)}</td>
        <td>$${importe.toFixed(2)}</td>
        <td>$${iva.toFixed(2)}</td>
        <td>$${ieps.toFixed(2)}</td>
        <td>$${totalLinea.toFixed(2)}</td>
      `;
      tbody.appendChild(tr);
    });
  });

  document.getElementById("totalDia").textContent = totalDia.toFixed(2);
  document.getElementById("totalIVA").textContent = totalIVA.toFixed(2);
  document.getElementById("totalIEPS").textContent = totalIEPS.toFixed(2);
}
