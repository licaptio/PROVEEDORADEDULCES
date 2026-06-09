APP: Reporte semanal de pagos a proveedores - PROVEEDORA

Estructura:
/assets/logo.JFIF
/css/*.css
/js/*.js
index.html

Configuración obligatoria:
1) Abrir js/config.js
2) Colocar SUPABASE_URL
3) Colocar SUPABASE_ANON_KEY

Tabla base esperada:
public.pagos_proveedor

La app consulta por fecha_pago y exporta Excel con 3 hojas:
- Resumen
- Facturas pagadas
- Pagos manuales

Pagos manuales:
Se guardan en la misma tabla usando la estructura actual:
- rfc_emisor = SIN_RFC o RFC capturado
- proveedor_nombre = proveedor/concepto
- banco = banco capturado
- fecha_pago = fecha capturada
- importe_pagado = importe capturado
- total_facturas = importe capturado
- total_ajustes = 0
- facturas_info = []
- ajustes = []
- comprobante_raw = referencia/comprobante
- notas = concepto/notas

La app detecta pago manual cuando facturas_info viene vacío.
