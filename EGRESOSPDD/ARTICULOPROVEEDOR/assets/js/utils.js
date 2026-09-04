export const formatoFecha=f=>new Date(f).toLocaleDateString('es-MX');
export const formatoMoneda=v=>Number(v||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
export const limpiarHtml=t=>String(t||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
