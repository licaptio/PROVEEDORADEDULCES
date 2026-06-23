let PAGOS_SEMANA = [];

async function cargarPagosSemana() {
  const { inicio, fin } = obtenerSemanaSeleccionada();

  document.getElementById("rangoSemanaTexto").textContent =
    `Semana del ${fechaMx(inicio)} al ${fechaMx(fin)}`;

  mostrarCarga("Consultando pagos de la semana...");

  try {
    PAGOS_SEMANA = await consultarPagos(inicio, fin);
    renderResumen(PAGOS_SEMANA);
    renderPagos(PAGOS_SEMANA);
  } catch (err) {
    console.error(err);
    toast("Error al consultar pagos. Revisa config.js y permisos Supabase.");
  } finally {
    ocultarCargaConMinimo();
  }
}

function abrirDetallePago(id) {
  const p = PAGOS_SEMANA.find(x => x.id === id);
  if (!p) return;

  const manual = esPagoManual(p);
  const facturas = asegurarArray(p.facturas_info);
  const ajustes = asegurarArray(p.ajustes);

  let html = `
    <div class="detalle-grid">
      <div class="detalle-item"><small>Banco</small><strong>${escapeHtml(p.banco)}</strong></div>
      <div class="detalle-item"><small>Fecha pago</small><strong>${fechaMx(p.fecha_pago)}</strong></div>
      <div class="detalle-item"><small>Proveedor</small><strong>${escapeHtml(p.proveedor_nombre)}</strong></div>
      <div class="detalle-item"><small>Importe pagado</small><strong>${dinero(p.importe_pagado)}</strong></div>
      <div class="detalle-item"><small>RFC</small><strong>${escapeHtml(p.rfc_emisor)}</strong></div>
      <div class="detalle-item"><small>Tipo</small><strong>${manual ? "PAGO MANUAL / SIN UUID" : "PAGO CON FACTURAS"}</strong></div>
      <div class="detalle-item"><small>Total facturas</small><strong>${dinero(p.total_facturas)}</strong></div>
      <div class="detalle-item"><small>Total ajustes</small><strong>${dinero(p.total_ajustes)}</strong></div>
    </div>
  `;

  if (manual) {
    html += `
      <h3>Concepto / notas</h3>
      <div class="bloque-notas">${escapeHtml(p.concepto_manual || p.notas || "")}</div>
    `;
  } else {
    html += `
      <h3>Facturas pagadas</h3>
      <div class="tabla-wrap">
        <table class="tabla">
          <thead>
            <tr>
              <th>Fecha factura</th>
              <th>UUID / UDI</th>
              <th>Serie</th>
              <th>Folio</th>
              <th>Total</th>
              <th>Desc. factura</th>
              <th>Neto factura</th>
            </tr>
          </thead>
          <tbody>
    `;

    html += facturas.map(f => {
      const uuid = f.uuid_cfdi || f.uuid || f.udi || f.UUID || "";
      const total = Number(f.importe_original || 0);
      const descuentoFactura = Number(f?.descuento?.monto || 0);
      const neto = Number(f.importe_final || (total - descuentoFactura));

      return `
        <tr>
          <td>${fechaMx(f.fecha)}</td>
          <td>${escapeHtml(uuid)}</td>
          <td>${escapeHtml(f.serie || "")}</td>
          <td>${escapeHtml(f.folio || "")}</td>
          <td class="texto-derecha">${dinero(total)}</td>
          <td class="texto-derecha">${dinero(descuentoFactura)}</td>
          <td class="texto-derecha">${dinero(neto)}</td>
        </tr>
      `;
    }).join("");

    html += `
          </tbody>
        </table>
      </div>
    `;

    const subtotalFacturas = facturas.reduce((s, f) => {
      return s + Number(f.importe_original || 0);
    }, 0);

    const descuentosFactura = facturas.reduce((s, f) => {
      return s + Number(f?.descuento?.monto || 0);
    }, 0);

    const netoFacturas = facturas.reduce((s, f) => {
      return s + Number(f.importe_final || 0);
    }, 0);

    const ajusteGlobal = Number(p.total_ajustes || 0);

    html += `
      <div class="resumen-detalle-pago">
        <div><span>Subtotal facturas</span><strong>${dinero(subtotalFacturas)}</strong></div>
        <div><span>Descuentos por factura</span><strong>${dinero(descuentosFactura)}</strong></div>
        <div><span>Neto facturas</span><strong>${dinero(netoFacturas)}</strong></div>
        <div><span>Descuento / ajuste global</span><strong>${dinero(ajusteGlobal)}</strong></div>
        <div class="total"><span>Total pagado</span><strong>${dinero(p.importe_pagado)}</strong></div>
      </div>
    `;

    if (ajustes.length) {
      html += `
        <h3>Ajustes globales</h3>
        <div class="tabla-wrap">
          <table class="tabla">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Nota</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              ${ajustes.map(a => `
                <tr>
                  <td>${escapeHtml(a.tipo || "")}</td>
                  <td>${escapeHtml(a.nota || "")}</td>
                  <td class="texto-derecha">${dinero(a.monto || 0)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    }
  }

  html += `
    <h3>Comprobante / referencia</h3>
    <div class="bloque-notas">${escapeHtml(p.comprobante_raw || "")}</div>
  `;

  if (p.notas && !manual) {
    html += `
      <h3>Notas</h3>
      <div class="bloque-notas">${escapeHtml(p.notas)}</div>
    `;
  }

  document.getElementById("detallePagoContenido").innerHTML = html;
  abrirModal("modalDetalle");
}
