PROVSOFT - CONCILIADOR DE UUID
==============================

OBJETIVO
Compara UUID entre:
1. public.metadata_ingresos
2. public.ingresos_pdd

MUESTRA
- UUID que están en metadata pero faltan en ingresos.
- UUID que están en ingresos pero faltan en metadata.
- UUID que coinciden en ambas tablas.
- UUID duplicados dentro de cualquiera de las tablas.
- Diferencias de importe cuando el UUID coincide.
- Exportación CSV de la vista activa.

INSTALACION
1. Abre assets/js/config.js.
2. Coloca supabaseUrl y supabaseAnonKey de tu proyecto.
3. Conserva la estructura de carpetas.
4. Ejecuta mediante servidor local, Firebase Hosting o tu hosting habitual.

IMPORTANTE
No abras index.html únicamente con doble clic si el navegador bloquea módulos ES.
Puedes usar Live Server de VS Code o publicar la carpeta.

TABLAS/CAMPOS ESPERADOS
metadata_ingresos:
- id, uuid_cfdi, rfc_receptor, nombre_receptor, fecha_emision,
  fecha_cancelacion, monto, estatus, efecto_comprobante,
  periodo_anio, periodo_mes

ingresos_pdd:
- id, uuid_cfdi, fecha, periodo_mes, periodo_anio, tipo_factura,
  rfc_receptor, razon_social_receptor, folio, serie, subtotal,
  total, metodo_pago, total_iva, total_ieps

SEGURIDAD
La anon key queda visible en navegador. Debes proteger las tablas mediante RLS.


ACTUALIZACIÓN:
- La conciliación se ejecuta por ejercicio anual completo.
- Se eliminó el resumen superior porque repetía los conteos mostrados en las pestañas.
