export function formatoMoneda(valor) {
  return Number(valor || 0).toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN"
  });
}

export function formatoFecha(fecha) {
  if (!fecha) return "";
  return new Date(fecha).toLocaleString("es-MX");
}

export function diasDesde(fecha) {
  if (!fecha) return 0;
  const inicio = new Date(fecha);
  const hoy = new Date();
  return Math.floor((hoy - inicio) / 86400000);
}

export function serieFolio(f) {
  return [f.serie, f.folio].filter(Boolean).join("-") || f.foliotecnopro || "";
}

export function renderInicio(stats) {
  return `
    <div class="hero">
      <div>
        <h2>Control de facturas en observación</h2>
        <p>Marca, documenta y libera facturas sin alterar el CFDI original.</p>
      </div>
    </div>

    <div class="cards-3">
      <div class="stat-card">
        <span>Facturas observadas</span>
        <strong>${stats.total}</strong>
      </div>
      <div class="stat-card">
        <span>Monto observado</span>
        <strong>${formatoMoneda(stats.monto)}</strong>
      </div>
      <div class="stat-card">
        <span>Más antigua</span>
        <strong>${stats.maxDias} días</strong>
      </div>
    </div>

    <div class="panel">
      <h3>Flujo del módulo</h3>
      <div class="steps">
        <div>1. Buscar UUID</div>
        <div>2. Confirmar factura</div>
        <div>3. Marcar / notar / liberar</div>
        <div>4. Revisar reporte</div>
      </div>
    </div>
  `;
}

export function renderBuscar() {
  return `
    <div class="search-screen">
      <div class="search-box">
        <h2>Buscar factura por UUID</h2>
        <p>Pega el UUID del CFDI para iniciar seguimiento.</p>
        <input id="uuidInput" placeholder="UUID CFDI">
        <button id="btnBuscarUUID" class="btn primary">Buscar factura</button>
      </div>
    </div>
  `;
}

export function renderFacturaEncontrada(f) {
  return `
    <h2>Información encontrada</h2>
    <p>Confirma que sea la factura correcta.</p>

    <div class="modal-grid">
      <div><b>Proveedor</b><span>${f.razon_social_emisor || ""}</span></div>
      <div><b>RFC</b><span>${f.rfc_emisor || ""}</span></div>
      <div><b>Total</b><span>${formatoMoneda(f.total)}</span></div>
      <div><b>Fecha</b><span>${formatoFecha(f.fecha)}</span></div>
      <div class="full"><b>UUID</b><span>${f.uuid_cfdi}</span></div>
    </div>

    <button id="btnAbrirFactura" class="btn primary">Abrir factura</button>
  `;
}

export function renderEditor(f, historial) {
  const estadoClass = f.en_observacion ? "danger" : "success";
  const estadoTxt = f.en_observacion ? "EN OBSERVACIÓN" : "NORMAL / CONFIRMADA";

  return `
    <div class="editor-grid">
      <section class="panel">
        <h2>Datos de factura</h2>

        <div class="data-grid">
          <div><b>UUID</b><span>${f.uuid_cfdi}</span></div>
          <div><b>Proveedor</b><span>${f.razon_social_emisor || ""}</span></div>
          <div><b>RFC</b><span>${f.rfc_emisor || ""}</span></div>
          <div><b>Fecha</b><span>${formatoFecha(f.fecha)}</span></div>
          <div><b>Total</b><span>${formatoMoneda(f.total)}</span></div>
          <div><b>Serie / Folio</b><span>${serieFolio(f)}</span></div>
          <div><b>Pagada</b><span>${f.factura_pagada || ""}</span></div>
          <div><b>Física</b><span>${f.factura_fisicamente || ""}</span></div>
        </div>
      </section>

      <section class="panel estado-panel">
        <span>Estado actual</span>
        <strong class="${estadoClass}">${estadoTxt}</strong>
        <p>${f.observacion_nota_actual || "Sin nota actual."}</p>
      </section>
    </div>

    <section class="panel">
      <h3>Acciones</h3>

      <div class="motivos">
        <button class="chip" data-motivo="DIFERENCIA IMPORTE">Diferencia importe</button>
        <button class="chip" data-motivo="XML FALTANTE">XML faltante</button>
        <button class="chip" data-motivo="PENDIENTE SAT">Pendiente SAT</button>
        <button class="chip" data-motivo="PENDIENTE PROVEEDOR">Pendiente proveedor</button>
        <button class="chip" data-motivo="PENDIENTE AUTORIZACIÓN">Pendiente autorización</button>
      </div>

      <input id="usuarioInput" value="GERARDO" placeholder="Usuario">
      <textarea id="notaInput" placeholder="Nota o motivo"></textarea>

      <div class="actions-row">
        <button id="btnMarcar" class="btn danger">Marcar observación</button>
        <button id="btnNota" class="btn warning">Agregar nota</button>
        <button id="btnDesmarcar" class="btn success">Desmarcar / confirmar</button>
      </div>
    </section>

    <section class="panel">
      <h3>Historial</h3>
      <div class="timeline">
        ${
          historial.length
          ? historial.map(renderHistorialItem).join("")
          : "<p>Sin movimientos registrados.</p>"
        }
      </div>
    </section>
  `;
}

function renderHistorialItem(item) {
  const clase = item.tipo_evento === "MARCAR"
    ? "rojo"
    : item.tipo_evento === "DESMARCAR"
      ? "verde"
      : "naranja";

  return `
    <div class="timeline-item ${clase}">
      <b>${item.tipo_evento}</b>
      <small>${formatoFecha(item.fecha_evento)} · ${item.usuario || ""}</small>
      <p>${item.nota || ""}</p>
    </div>
  `;
}

export function renderObservadas(lista) {
  if (!lista.length) {
    return `
      <div class="panel">
        <h2>Facturas en observación</h2>
        <p>No hay facturas observadas.</p>
      </div>
    `;
  }

  return `
    <div class="panel">
      <div class="tabla-toolbar">
        <div>
          <h2>Facturas en observación</h2>
          <small id="seleccionadasObservadas">Sin selección masiva</small>
        </div>

        <label class="check-todas">
          <input id="chkTodasObservadas" type="checkbox">
          Seleccionar todas
        </label>
      </div>

      <div class="tabla">
        <div class="tabla-head">
          <span></span>
          <span>Proveedor</span>
          <span>Fecha</span>
          <span>Total</span>
          <span>Días</span>
          <span>Nota</span>
        </div>

        ${lista.map(f => `
          <div class="tabla-row" data-uuid="${f.uuid_cfdi}" role="button" tabindex="0">
            <span class="check-cell">
              <input
                type="checkbox"
                class="chkFacturaObservada"
                value="${f.uuid_cfdi}"
                title="Seleccionar factura"
              >
            </span>
            <span>${f.razon_social_emisor || ""}</span>
            <span>${formatoFecha(f.fecha)}</span>
            <span>${formatoMoneda(f.total)}</span>
            <span>${diasDesde(f.observacion_fecha)}</span>
            <span>${f.observacion_nota_actual || ""}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

export function calcularStats(lista) {
  const total = lista.length;
  const monto = lista.reduce((acc, f) => acc + Number(f.total || 0), 0);
  const maxDias = lista.reduce((max, f) => Math.max(max, diasDesde(f.observacion_fecha)), 0);

  return { total, monto, maxDias };
}

export function renderReporte(lista) {
  return `
    <div class="panel">

      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        margin-bottom:20px;
      ">
        <h2>Facturas en observación</h2>

        <button
          id="btnExcelObservadas"
          class="btn success">
          Exportar Excel
        </button>
      </div>

      ${renderObservadas(lista)}

    </div>
  `;
}
 
