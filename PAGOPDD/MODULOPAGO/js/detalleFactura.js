import { sb } from './supabaseClient.js';
import { money, escapeHtml } from './ui.js';

const TABLA = 'deuda_limpia_pdd';
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const uuid = params.get('uuid');

function safe(v){
  return (v === null || v === undefined || v === 'null') ? '' : String(v);
}

function fechaBonita(fechaRaw){
  if(!fechaRaw) return '';
  const fecha = new Date(fechaRaw);
  if(Number.isNaN(fecha.getTime())) return safe(fechaRaw);
  return fecha.toLocaleString('es-MX', {
    year:'numeric', month:'short', day:'2-digit',
    hour:'2-digit', minute:'2-digit'
  });
}

function toast(msg, error=false){
  const t = $('toast');
  t.textContent = msg;
  t.style.background = error ? '#b00020' : '#00416A';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

function obtenerConceptos(f){
  if(!Array.isArray(f.conceptos_detalle)) return [];

  return f.conceptos_detalle.map(c => {
    const traslados = Array.isArray(c.traslados) ? c.traslados : [];
    const iva = traslados
      .filter(t => String(t.impuesto) === '002')
      .reduce((a,t) => a + Number(t.importe || 0), 0);
    const ieps = traslados
      .filter(t => String(t.impuesto) === '003')
      .reduce((a,t) => a + Number(t.importe || 0), 0);

    const cantidad = Number(c.cantidad || 0);
    const unitario = Number(c.valorUnitario ?? c.costoUnitario ?? 0);
    const descuento = Number(c.descuento || 0);
    const subtotal = cantidad * unitario - descuento;

    return {
      cantidad,
      clave: safe(c.claveProdServ || c.codigoSAT || c.clave || ''),
      descripcion: safe(c.descripcion || ''),
      unitario,
      descuento,
      iva,
      ieps,
      subtotal
    };
  });
}

function timbreHTML(f){
  if(!Array.isArray(f.complementos) || !f.complementos.length){
    return '<p class="muted">No hay datos de timbrado.</p>';
  }

  const attrs = f.complementos[0]?.atributos || [];
  const busca = (nombre) => safe(attrs.find(a => a.nombre === nombre)?.valor);

  return `
    <div class="timbre-grid">
      <div>
        <p><b>UUID:</b> ${escapeHtml(safe(f.uuid_cfdi))}</p>
        <p><b>Fecha timbrado:</b> ${escapeHtml(busca('FechaTimbrado'))}</p>
        <p><b>RFC Prov. Cert.:</b> ${escapeHtml(busca('RfcProvCertif'))}</p>
        <p><b>No. certificado SAT:</b> ${escapeHtml(busca('NoCertificadoSAT'))}</p>
      </div>
      <div>
        <p><b>Uso CFDI:</b> ${escapeHtml(safe(f.uso_cfdi))}</p>
        <p><b>Método de pago:</b> ${escapeHtml(safe(f.metodo_pago))}</p>
        <p><b>Forma de pago:</b> ${escapeHtml(safe(f.forma_pago))}</p>
        <p><b>Tipo comprobante:</b> ${escapeHtml(safe(f.tipo_comprobante))}</p>
      </div>
    </div>`;
}

function fotosHTML(f){
  const fotos = [...new Set((Array.isArray(f.fotos) ? f.fotos : []).filter(Boolean))];
  if(!fotos.length) return '<p class="muted">No hay fotos registradas.</p>';

  return `<div class="fotos-grid">${fotos.map((url, i) => `
    <div class="foto-item">
      <img src="${escapeHtml(url)}" alt="Foto factura ${i + 1}">
      <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Abrir foto ${i + 1}</a>
    </div>`).join('')}</div>`;
}

function renderFactura(f){
  const conceptos = obtenerConceptos(f);
  const subtotal = conceptos.reduce((a,c) => a + (c.cantidad * c.unitario), 0);
  const totalDesc = conceptos.reduce((a,c) => a + c.descuento, 0);
  const totalIVA = conceptos.reduce((a,c) => a + c.iva, 0);
  const totalIEPS = conceptos.reduce((a,c) => a + c.ieps, 0);
  const ivaRet = Math.abs(Number(f.impuestos_retenidos?.iva || 0));
  const isrRet = Math.abs(Number(f.impuestos_retenidos?.isr || 0));

  const filas = conceptos.length ? conceptos.map(c => `
    <tr>
      <td class="num">${c.cantidad}</td>
      <td>${escapeHtml(c.clave)}</td>
      <td>${escapeHtml(c.descripcion)}</td>
      <td class="num">${money(c.unitario)}</td>
      <td class="num">${money(c.descuento)}</td>
      <td class="num">${money(c.iva)}</td>
      <td class="num">${money(c.ieps)}</td>
      <td class="num">${money(c.subtotal)}</td>
    </tr>`).join('') : `
    <tr><td colspan="8" style="text-align:center;padding:18px" class="muted">CFDI sin desglose de conceptos.</td></tr>`;

  $('subtituloDetalle').textContent = `${safe(f.razon_social_emisor || f.nombre_emisor)} · ${money(f.total)}`;

  $('contenedorDetalle').innerHTML = `
    <section class="grid-2">
      <div class="card box">
        <h2>Datos del emisor</h2>
        <p><b>RFC:</b> ${escapeHtml(safe(f.rfc_emisor))}</p>
        <p><b>Nombre:</b> ${escapeHtml(safe(f.nombre_emisor || f.razon_social_emisor))}</p>
        <p><b>Régimen fiscal:</b> ${escapeHtml(safe(f.regimen_fiscal_emisor))}</p>
      </div>
      <div class="card box">
        <h2>Datos del receptor</h2>
        <p><b>RFC:</b> ${escapeHtml(safe(f.rfc_receptor))}</p>
        <p><b>Nombre:</b> ${escapeHtml(safe(f.nombre_receptor))}</p>
        <p><b>Uso CFDI:</b> ${escapeHtml(safe(f.uso_cfdi))}</p>
      </div>
    </section>

    <section class="grid-3">
      <div class="card box">
        <h2>Factura</h2>
        <p><b>Serie:</b> ${escapeHtml(safe(f.serie))}</p>
        <p><b>Folio:</b> ${escapeHtml(safe(f.folio))}</p>
        <p><b>Fecha:</b> ${escapeHtml(fechaBonita(f.fecha))}</p>
        <div class="uuid-row">
          <b>UUID:</b>
          <span id="uuidText" class="uuid-text">${escapeHtml(safe(f.uuid_cfdi))}</span>
          <button id="btnCopiarUUID" class="btn-outline" type="button">📋 Copiar</button>
        </div>
      </div>

      <div class="card box">
        <h2>Total factura</h2>
        <div class="dato-fuerte">${money(f.total)}</div>
        <p class="muted">Total autoritativo del CFDI.</p>
      </div>

      <div class="card box">
        <h2>Folio Tecnopro</h2>
        <div class="folio-row">
          <input id="folioTecnopro" maxlength="7" value="${escapeHtml(safe(f.foliotecnopro))}" placeholder="Folio">
          <button id="btnGuardarFolio" class="btn" type="button">Guardar</button>
        </div>
      </div>
    </section>

    <section class="card box">
      <h2>Conceptos</h2>
      <div class="tabla-wrapper">
        <table>
          <thead>
            <tr>
              <th class="num">Cant</th>
              <th>Clave</th>
              <th>Descripción</th>
              <th class="num">Unitario</th>
              <th class="num">Descuento</th>
              <th class="num">IVA</th>
              <th class="num">IEPS</th>
              <th class="num">Subtotal</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
          <tfoot>
            <tr><td colspan="7" class="num"><b>Subtotal</b></td><td class="num"><b>${money(subtotal)}</b></td></tr>
            <tr><td colspan="7" class="num"><b>Descuento total</b></td><td class="num"><b>${money(totalDesc)}</b></td></tr>
            <tr><td colspan="7" class="num"><b>IVA</b></td><td class="num"><b>${money(totalIVA)}</b></td></tr>
            <tr><td colspan="7" class="num"><b>IEPS</b></td><td class="num"><b>${money(totalIEPS)}</b></td></tr>
            <tr><td colspan="7" class="num retencion">IVA retenido</td><td class="num retencion">${money(ivaRet)}</td></tr>
            <tr><td colspan="7" class="num retencion">ISR retenido</td><td class="num retencion">${money(isrRet)}</td></tr>
            <tr class="total-row"><td colspan="7" class="num">TOTAL NETO A PAGAR</td><td class="num">${money(f.total)}</td></tr>
          </tfoot>
        </table>
      </div>
    </section>

    <section class="card box">
      <h2>Timbrado</h2>
      ${timbreHTML(f)}
    </section>

    <section class="card box">
      <h2>Fotos de factura</h2>
      ${fotosHTML(f)}
    </section>
  `;

  $('btnCopiarUUID').addEventListener('click', async () => {
    try{
      await navigator.clipboard.writeText(safe(f.uuid_cfdi));
      toast('UUID copiado');
    }catch(_){
      toast('No se pudo copiar', true);
    }
  });

  $('btnGuardarFolio').addEventListener('click', async () => {
    const val = $('folioTecnopro').value.trim().substring(0, 7);
    if(!val){ toast('Folio vacío', true); return; }

    const { error } = await sb
      .from(TABLA)
      .update({ foliotecnopro: val })
      .eq('uuid_cfdi', f.uuid_cfdi);

    if(error){
      console.error(error);
      toast('Error al guardar folio', true);
      return;
    }
    toast('Folio Tecnopro guardado');
  });
}

async function cargarDetalle(){
  $('btnRegresar').addEventListener('click', () => history.back());

  if(!uuid){
    $('estadoCarga').innerHTML = 'No se recibió UUID en la URL.';
    return;
  }

  const { data, error } = await sb
    .from(TABLA)
    .select('*')
    .eq('uuid_cfdi', uuid)
    .single();

  if(error || !data){
    console.error(error);
    $('estadoCarga').innerHTML = 'No se encontró información de la factura.';
    return;
  }

  renderFactura(data);
  $('estadoCarga').classList.add('oculto');
  $('contenedorDetalle').classList.remove('oculto');
}

cargarDetalle();
