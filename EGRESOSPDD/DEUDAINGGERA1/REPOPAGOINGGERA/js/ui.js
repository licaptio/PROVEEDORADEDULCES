function cambiarVista(id){
  document.querySelectorAll('.vista').forEach(v=>v.classList.remove('activa'));
  document.getElementById(id).classList.add('activa');
  document.querySelectorAll('.menu-item').forEach(b=>b.classList.remove('activo'));
  const btn=document.querySelector(`.menu-item[data-vista="${id}"]`);
  if(btn) btn.classList.add('activo');
}
function mostrarCarga(texto='Cargando información...'){
  document.getElementById('textoCarga').textContent=texto;
  document.getElementById('pantallaCarga').classList.remove('oculto');
}
function ocultarCargaConMinimo(){
  setTimeout(()=>document.getElementById('pantallaCarga').classList.add('oculto'), 900);
}
function renderResumen(pagos){
  const totalPagado=pagos.reduce((s,p)=>s+Number(p.importe_pagado||0),0);
  const totalFacturas=pagos.reduce((s,p)=>s+Number(p.total_facturas||0),0);
  const totalAjustes=pagos.reduce((s,p)=>s+Number(p.total_ajustes||0),0);
  document.getElementById('totalPagado').textContent=dinero(totalPagado);
  document.getElementById('totalFacturas').textContent=dinero(totalFacturas);
  document.getElementById('totalAjustes').textContent=dinero(totalAjustes);
  document.getElementById('numeroPagos').textContent=pagos.length;
  const bancos={};
  pagos.forEach(p=>{ const b=p.banco||'SIN BANCO'; bancos[b]??={pagos:0,total:0}; bancos[b].pagos++; bancos[b].total+=Number(p.importe_pagado||0); });
  const cont=document.getElementById('resumenBancos');
  cont.innerHTML=Object.keys(bancos).length ? Object.entries(bancos).map(([b,x])=>`
    <div class="card-banco"><h3>${escapeHtml(b)}</h3><small>Pagos: ${x.pagos}</small><div class="monto">${dinero(x.total)}</div></div>`).join('') : '<div class="sin-datos">Sin pagos en esta semana</div>';
}
function renderPagos(pagos){
  const q=normalizar(document.getElementById('buscarPagos').value);
  const filtrados=pagos.filter(p=>normalizar(`${p.banco} ${p.proveedor_nombre} ${p.rfc_emisor} ${p.notas} ${p.concepto_manual}`).includes(q));
  const cont=document.getElementById('contenedorPagos');
  if(!filtrados.length){ cont.innerHTML='<div class="sin-datos">Sin pagos para mostrar</div>'; return; }
  cont.innerHTML=filtrados.map(p=>{
    const manual=esPagoManual(p);
    return `<div class="pago-card" onclick="abrirDetallePago('${p.id}')">
      <strong>${escapeHtml(p.banco)}</strong>
      <span>${fechaMx(p.fecha_pago)}</span>
      <span>${escapeHtml(p.proveedor_nombre)}</span>
      <strong>${dinero(p.importe_pagado)}</strong>
      <span class="badge ${manual?'manual':'facturas'}">${manual?'MANUAL':'FACTURAS'}</span>
      <span>Ver detalle</span>
    </div>`;
  }).join('');
}
function abrirModal(id){ document.getElementById(id).classList.remove('oculto'); }
function cerrarModal(id){ document.getElementById(id).classList.add('oculto'); }
