export function renderCarrito(carrito, tbodyId = "tbody") {

  const tbody = document.getElementById(tbodyId);

  if (!tbody) return;

  tbody.innerHTML = "";

  carrito.forEach(item => {

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${item.nombre}</td>
      <td>${item.cantidad}</td>
      <td>$${Number(item.importe || 0).toFixed(2)}</td>
    `;

    tbody.appendChild(tr);

  });
}
