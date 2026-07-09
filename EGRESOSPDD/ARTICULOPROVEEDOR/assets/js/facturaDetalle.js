import { supabase } from './supabaseClient.js';
import { formatoFecha, formatoMoneda, limpiarHtml } from './utils.js';

export async function abrirDetalleFactura(id) {
  const contenedor = document.getElementById('detalleFactura');
  contenedor.innerHTML = '<div class="cargando">Cargando factura...</div>';

  const { data, error } = await supabase
    .from('deuda_limpia_pdd')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error(error);
    contenedor.innerHTML = '<div class="alerta-error">Error al cargar la factura.</div>';
    return;
  }

  const conceptos = normalizarConceptos(data.conceptos_detalle);
  const serieFolio = `${data.serie || ''}${data.serie ? '-' : ''}${data.folio || ''}` || 'SIN FOLIO';

  contenedor.innerHTML = `
    <article class="factura-card">
      <div class="factura-encabezado">
        <div>
          <div class="etiqueta">Factura</div>
          <h2>${limpiarHtml(serieFolio)}</h2>
          <div class="uuid">UUID: ${limpiarHtml(data.uuid_cfdi || '')}</div>
        </div>

        <div class="factura-total-box">
          <span>Total</span>
          <strong>${formatoMoneda(data.total)}</strong>
        </div>
      </div>

      <div class="factura-grid">
        <div class="dato">
          <span>Proveedor</span>
          <strong>${limpiarHtml(data.razon_social_emisor || '')}</strong>
        </div>
        <div class="dato">
          <span>RFC emisor</span>
          <strong>${limpiarHtml(data.rfc_emisor || '')}</strong>
        </div>
        <div class="dato">
          <span>Fecha factura</span>
          <strong>${formatoFecha(data.fecha)}</strong>
        </div>
        <div class="dato">
          <span>Fecha certificación</span>
          <strong>${limpiarHtml(data.fecha_certificacion || '')}</strong>
        </div>
        <div class="dato">
          <span>Forma de pago</span>
          <strong>${limpiarHtml(data.forma_pago || '')}</strong>
        </div>
        <div class="dato">
          <span>Moneda</span>
          <strong>${limpiarHtml(data.moneda || 'MXN')}</strong>
        </div>
      </div>

      <div class="seccion-titulo">
        <h3>Conceptos</h3>
        <span>${conceptos.length} concepto(s)</span>
      </div>

      <div class="tabla-wrap">
        <table class="tabla-conceptos">
          <thead>
            <tr>
              <th>Descripción</th>
              <th class="num">Cantidad</th>
              <th>Unidad</th>
              <th class="num">Valor unitario</th>
              <th class="num">Importe</th>
            </tr>
          </thead>
          <tbody>
            ${conceptos.map(c => `
              <tr>
                <td class="desc">${limpiarHtml(c.descripcion)}</td>
                <td class="num">${limpiarHtml(c.cantidad)}</td>
                <td>${limpiarHtml(c.unidad)}</td>
                <td class="num">${formatoMoneda(c.valorUnitario)}</td>
                <td class="num"><strong>${formatoMoneda(c.importe)}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="factura-resumen">
        <div><span>Subtotal</span><strong>${formatoMoneda(data.subtotal)}</strong></div>
        <div><span>Descuento</span><strong>${formatoMoneda(data.descuento)}</strong></div>
        <div><span>Total</span><strong>${formatoMoneda(data.total)}</strong></div>
      </div>
    </article>
  `;
}

function normalizarConceptos(valor) {
  const lista = Array.isArray(valor) ? valor : [];

  return lista.map(c => ({
    descripcion: c.descripcion || c.Descripcion || c.concepto || '',
    cantidad: c.cantidad ?? c.Cantidad ?? '',
    unidad: c.unidad || c.Unidad || c.claveUnidad || c.clave_unidad || '',
    valorUnitario: c.valorUnitario ?? c.ValorUnitario ?? c.valor_unitario ?? c.precio_unitario ?? 0,
    importe: c.importe ?? c.Importe ?? 0
  }));
}
