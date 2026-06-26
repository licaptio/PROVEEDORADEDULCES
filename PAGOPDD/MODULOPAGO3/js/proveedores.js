import { sb } from './supabaseClient.js';
import { estado } from './estado.js';
import { $, escapeHtml, toast } from './ui.js';
import { cargarFacturasProveedor } from './facturas.js';
import { mostrarPantalla } from './ui.js';

export async function cargarProveedores(){
  const { data, error } = await sb
    .from('deuda_limpia_pdd')
    .select('rfc_emisor, razon_social_emisor')
    .eq('factura_pagada','NO');

  if(error) throw error;

  const map = new Map();
  (data || []).forEach(r => {
    const rfc = String(r.rfc_emisor || '').trim();
    const name = String(r.razon_social_emisor || rfc).trim();
    if(rfc) map.set(rfc, name || rfc);
  });

  estado.proveedoresMap = map;
  estado.proveedores = [...map.entries()]
    .map(([rfc, nombre]) => ({ rfc, nombre }))
    .sort((a,b)=> a.nombre.localeCompare(b.nombre, 'es'));

  estado.proveedoresFiltrados = estado.proveedores;
  const metricProveedores = $('metricProveedores');
  if(metricProveedores) metricProveedores.textContent = estado.proveedores.length;
}

export function abrirModalProveedor(){
  $('modalProveedor').style.display = 'block';
  $('buscarProveedor').value = '';
  estado.proveedoresFiltrados = estado.proveedores;
  pintarListaProveedores();
  setTimeout(()=> $('buscarProveedor').focus(), 80);
}

export function cerrarModalProveedor(){
  $('modalProveedor').style.display = 'none';
}

export function filtrarProveedores(){
  const q = $('buscarProveedor').value.trim().toLowerCase();
  estado.proveedoresFiltrados = !q
    ? estado.proveedores
    : estado.proveedores.filter(p =>
        p.nombre.toLowerCase().includes(q) || p.rfc.toLowerCase().includes(q)
      );
  pintarListaProveedores();
}

export function pintarListaProveedores(){
  const box = $('listaProveedores');
  if(!estado.proveedoresFiltrados.length){
    box.innerHTML = '<div class="proveedor-item"><small>No hay proveedores con ese filtro.</small></div>';
    return;
  }
  box.innerHTML = estado.proveedoresFiltrados.map(p => `
    <div class="proveedor-item" onclick="seleccionarProveedor('${escapeHtml(p.rfc)}')">
      <div><b>${escapeHtml(p.nombre)}</b><br><small>${escapeHtml(p.rfc)}</small></div>
      <small>Seleccionar →</small>
    </div>
  `).join('');
}

export async function seleccionarProveedor(rfc){
  estado.rfcProveedor = rfc;
  estado.proveedorNombre = estado.proveedoresMap.get(rfc) || rfc;
  cerrarModalProveedor();
  $('headerStatus').textContent = estado.proveedorNombre;
  $('proveedorSeleccionadoLabel').textContent = `${estado.proveedorNombre} · ${estado.rfcProveedor}`;
  await cargarFacturasProveedor(rfc);
  mostrarPantalla('pantallaFacturas');
  toast('Proveedor cargado');
}

window.abrirModalProveedor = abrirModalProveedor;
window.cerrarModalProveedor = cerrarModalProveedor;
window.filtrarProveedores = filtrarProveedores;
window.seleccionarProveedor = seleccionarProveedor;
