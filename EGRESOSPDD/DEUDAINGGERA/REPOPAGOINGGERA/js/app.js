document.addEventListener('DOMContentLoaded', async ()=>{
  iniciarSupabase();
  cargarSelectorSemanas();
  document.querySelectorAll('.menu-item[data-vista]').forEach(b=>b.addEventListener('click',()=>cambiarVista(b.dataset.vista)));
  document.getElementById('selectorSemana').addEventListener('change', cargarPagosSemana);
  document.getElementById('btnRecargar').addEventListener('click', cargarPagosSemana);
  document.getElementById('btnPagoManual').addEventListener('click', abrirPagoManual);
  document.getElementById('btnMenuPagoManual').addEventListener('click', abrirPagoManual);
  document.getElementById('formPagoManual').addEventListener('submit', guardarPagoManual);
  document.getElementById('btnExportarExcel').addEventListener('click', exportarExcel);
  document.getElementById('buscarPagos').addEventListener('input', ()=>renderPagos(PAGOS_SEMANA));
  document.getElementById('btnGuardarConfig').addEventListener('click', ()=>{
    localStorage.setItem('provsoft_inicio_semana', document.getElementById('configInicioSemana').value);
    localStorage.setItem('provsoft_nombre_reporte', document.getElementById('configNombreReporte').value);
    cargarSelectorSemanas();
    toast('Configuración guardada');
  });
  mostrarCarga('Preparando reporte semanal...');
  await new Promise(r=>setTimeout(r,900));
  await cargarPagosSemana();
});
