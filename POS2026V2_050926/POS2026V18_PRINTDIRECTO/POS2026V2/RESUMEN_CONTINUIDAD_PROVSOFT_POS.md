# RESUMEN DE CONTINUIDAD — PROVSOFT POSPDD26

Fecha del corte de desarrollo: 6 de septiembre de 2026  
Entrega: V14 documental (funcionalidad acumulada hasta V13)  
Tecnología: HTML, CSS, JavaScript ES Modules, Firebase Firestore e IndexedDB.

Este archivo es la guía oficial para retomar el proyecto. Antes de realizar cambios futuros se debe leer completo y trabajar sobre la versión acumulativa más reciente.

## 1. Estado general

El POS ya permite preparar el catálogo antes del login, iniciar sesión, vender desde catálogo, escanear códigos, buscar por varias palabras, cobrar con distintas formas de pago, trabajar con cola offline, mandar y recuperar ventas en espera, cancelar ventas, reimprimir tickets no cortados y generar cortes por usuario.

La operación todavía no incluye inventario, aplicación Android nativa, ticket ESC/POS terminado para 58 mm, historial de ventas terminado ni depósitos como módulo independiente.

## 2. Funciones terminadas

### Arranque protegido antes del login

Archivo principal: `js/ui/inicioSistema.js`

- Bloquea toda la aplicación con una pantalla animada mientras se prepara.
- Migra información anterior de localStorage a IndexedDB.
- Abre y prepara la base local.
- Carga el catálogo existente de IndexedDB.
- Consulta cambios incrementales en Firebase.
- Verifica que existan productos activos antes de mostrar el login.
- Muestra productos, cambios descargados, fotografías locales y estado de conexión.
- Primera instalación sin catálogo y sin Firebase: bloquea el acceso y ofrece Reintentar.
- Si ya hay catálogo local y falla Firebase: permite continuar offline con advertencia.
- Las fotografías remotas continúan en segundo plano y no retrasan el login.

Flujo actual:

1. Abrir programa.
2. Preparar IndexedDB.
3. Cargar catálogo local.
4. Descargar cambios de Firebase.
5. Verificar productos activos.
6. Preparar fotografías locales.
7. Mostrar login.

### Inicio de sesión

Archivo: `js/auth/login.js`

- Consulta usuarios activos en la colección `usuarios_ruta`.
- Restaura la última sesión desde IndexedDB.
- Conserva el usuario logueado para ventas, espera, cancelaciones, reimpresión y cortes.
- El encabezado operativo muestra solamente Usuario y Folio.
- Ruta, caja y cliente fueron retirados del encabezado.

### IndexedDB y funcionamiento local

Archivo: `js/catalogo/indexeddb.js`

Base: `POSPDD26_DB`, versión 3.

Almacenes actuales:

- `productos`: catálogo normalizado.
- `meta`: fechas y control de sincronización.
- `productos_fotos_meta`: metadatos de fotografías.
- `ventas_pendientes`: cola de ventas por sincronizar.
- `datos_locales`: sesión, configuración, folios y respaldos operativos.

localStorage ya no es el almacenamiento principal. Solamente se conserva una migración automática para datos creados por versiones anteriores.

### Catálogo incremental económico

Archivo: `js/catalogo/catalogo.js`

- La primera carga descarga el catálogo completo si IndexedDB está vacío.
- Las siguientes cargas consultan únicamente productos con `updatedAt` mayor al último valor guardado.
- `updatedAt` debe ser Timestamp real de Firestore.
- `actualizadoEn` se conserva como dato auxiliar, pero no controla la sincronización.
- Los productos con `activo=false` dejan de participar en los índices de venta.
- Para detectar una baja, Firebase también debe actualizar `updatedAt` cuando cambia `activo`.
- Reconoce los campos reales `codigoBarra`, `concepto`, `precioPublico`, `mayoreo`, `medioMayoreo`, `ivaTasa`, `iepsTasa`, `codigosEquivalentes`, `costoSinImpuesto`, `departamento`, comisiones y datos SAT.

### Fotografías en segundo plano

- Usa la colección `productos_fotos_meta`.
- Carga primero las fotografías ya guardadas en IndexedDB.
- Descarga cambios remotos en segundo plano.
- Las fotografías no bloquean el login ni la venta.
- La vista del producto puede mostrar las fotografías disponibles y su contador.

### Escáner y búsqueda automática multicoincidente

Archivos: `js/scanner/scanner.js` y `js/busqueda/busquedaManual.js`

- El campo principal sirve como escáner y buscador; se eliminó el botón separado de búsqueda manual.
- Un código exacto seguido de Enter agrega el producto directamente.
- Los códigos equivalentes se resuelven localmente y, cuando aplica, se consultan equivalencias remotas.
- Los códigos de báscula compatibles se interpretan por peso.
- Al escribir dos o más letras, el modal de búsqueda abre automáticamente después de 350 ms.
- El modal recibe el texto ya capturado.
- La búsqueda exige que coincidan todas las palabras, sin importar el orden.
- `C6` también coincide con textos guardados como `C/6`.
- Ejemplos válidos: `BIG COLA 3.3 C6`, `COLA 3.3 C6` y `BIG 3.3`.
- Los resultados se limitan a 80 productos y se ordenan por coincidencia.

### Carrito

- Agrega productos desde código exacto o resultado de búsqueda.
- Permite modificar cantidades.
- Reducir cantidades y eliminar partidas requiere autorización.
- Conserva bitácora de cancelación de partidas y cambios de cantidad.
- Calcula subtotal, impuestos, descuento, cantidad y total.
- Usa precios e impuestos del catálogo.

### Cobro y formas de pago

Archivo: `js/cobro/cobro.js`

Al presionar Cobrar, primero exige seleccionar:

- Efectivo.
- Tarjeta.
- Transferencia.
- Pago mixto.

Comportamiento:

- Efectivo: captura el importe recibido y calcula cambio.
- Tarjeta: asigna automáticamente el total exacto.
- Transferencia: asigna automáticamente el total exacto.
- Mixto: muestra Efectivo 1, Efectivo 2, Tarjeta y Transferencia.
- Calcula total de pagos, faltante y cambio.
- No confirma si el total recibido es insuficiente.
- El cambio solamente puede provenir del efectivo recibido.
- Guarda `metodo_pago` y el arreglo `pagos` en la venta.
- El descuento máximo configurado actualmente es 3% y requiere autorización.

### Ruta real de ventas

Archivo central: `js/config/usuariosVentas.js`

Todas las ventas reales se guardan en:

`CLIENTES/PDD031204KL5/VENTASV20261/{id_venta}`

Usan esa misma colección:

- Ventas cobradas.
- Ventas en espera.
- Recuperación de ventas.
- Cancelaciones.
- Cola offline.
- Reimpresión.
- Corte operativo.

Solamente un usuario marcado expresamente con `venta_prueba=true` usa la ruta de pruebas.

### Identificación por usuario; caja eliminada

- Las ventas guardan `usuarioId`, `usuarioLogin` y `usuarioNombre`.
- Cortes y reimpresión filtran por `usuarioLogin` del usuario conectado.
- Ventas en espera se muestran únicamente al usuario que las generó.
- La caja ya no se muestra, no se guarda en ventas nuevas y no se usa como filtro.
- La ruta puede conservarse como metadato y para organizar cortes, pero no aparece en el encabezado.

### Folios

- El folio identifica al usuario y la fecha.
- Firestore mantiene un contador por usuario y día.
- Si Firestore no responde, usa un consecutivo local de IndexedDB.
- El siguiente folio se muestra en el encabezado.

### Venta offline y sincronización manual

Archivos: `js/offline/ventasPendientes.js` y `js/offline/ventasPendientesUI.js`

- La venta se prepara y guarda localmente antes de imprimir.
- Si Firestore falla, queda en la cola `ventas_pendientes`.
- El menú incluye Ventas Pendientes y Sincronización.
- La pantalla muestra folio, fecha, usuario, total e intentos.
- El usuario puede reintentar manualmente todas las ventas pendientes.
- También existe reintento automático en segundo plano.
- Una venta se retira de la cola cuando Firestore confirma la sincronización.

### Indicador online/offline

Archivo: `js/ui/estadoConexion.js`

- Verde: internet y Firebase disponibles.
- Rojo: sin internet o sin comunicación con Firebase.
- Amarillo: verificando.
- Reacciona a los eventos online/offline del equipo.
- Verifica Firebase periódicamente con intervalo económico.

### Ventas en espera y recuperación

Archivo: `js/ventas/ventaEspera.js`

- Permite mandar una venta a espera con motivo seleccionable y autorización de supervisor/admin.
- Guarda la venta en la colección real de ventas.
- Recuperar Venta está disponible desde el menú y con F7.
- Al recuperar, repone las partidas en el carrito.
- Al cobrar una venta recuperada, actualiza el mismo documento original; no crea una venta duplicada.
- El listado excluye ventas cobradas, canceladas o eliminadas.
- Cada venta en espera también puede cancelarse con autorización y motivo.

### Respaldo de venta interrumpida

Archivo: `js/ventas/ventaInterrumpidaLocal.js`

- Guarda un respaldo automático de la venta activa cada dos segundos.
- Si ocurre cierre, apagón o reinicio, manda la venta interrumpida a Ventas en Espera al abrir nuevamente.
- Si se interrumpe una venta previamente recuperada, regresa el documento original a espera.
- Al cobrar o cancelar se limpia el respaldo local.

### Cancelación de ventas

Archivos: `js/ventas/cancelarVenta.js` y `js/ventas/motivosCancelacion.js`

- La cancelación de la venta actual requiere tres pulsaciones, autorización y confirmación.
- Si la venta provenía de espera, cancela el documento original.
- Si era una captura nueva, guarda el movimiento cancelado para auditoría.
- La cancelación no borra evidencia: cambia el estado y conserva usuario, fecha y motivo.
- Limpia carrito, bitácoras, fotografía, respaldo local y marca de recuperación.
- Los motivos son botones seleccionables; no existe captura libre.

Motivos permitidos:

1. Cliente canceló la compra.
2. Cliente no completó el pago.
3. Error de captura.
4. Producto o cantidad incorrecta.
5. Precio incorrecto.

Firebase guarda `motivo_cancelacion` y `motivo_cancelacion_codigo`.

### Corte operativo

Archivo: `js/reportes/corte.js`

- Está disponible en el menú de tres puntos.
- Consulta únicamente ventas activas, no cortadas y del usuario conectado.
- Detecta ventas en espera/revisión y evita cerrar un corte inconsistente.
- Calcula tickets, total de ventas, impuestos, descuentos, artículos, costo, utilidad y margen.
- Desglosa Efectivo 1, Efectivo 2, Tarjeta y Transferencia.
- Efectivo a entregar suma únicamente Efectivo 1 y Efectivo 2.
- Incluye desglose por departamento y top 10 de artículos.
- Solicita tres confirmaciones antes de generar el corte.
- Guarda el corte en `TIENDAS/{ruta_usuario}/CORTES_POS` con datos del usuario.
- Marca como `cortado=true` los tickets incluidos.
- Puede imprimir el resumen mediante el sistema central de impresión.
- Ya no usa caja como filtro ni como campo del corte nuevo.

### Reimpresión de tickets

Archivo: `js/reportes/reimpresionTickets.js`

- Lista únicamente tickets activos, no cortados y del usuario conectado.
- Muestra folio, fecha, total y acción de reimpresión.
- Muestra el total acumulado de tickets pendientes de corte.
- Reimprime usando la configuración central de impresión.
- Ya no filtra por caja.

### Interfaz operativa

- Encabezado reducido a Usuario y Folio.
- Menú de tres puntos fijo en la esquina superior derecha.
- Indicador online/offline en la zona inferior derecha.
- Atajos: F7 Recuperar Venta, F8 Mandar a Espera y F9 Cobrar.
- Panel derecho con fotografía y totales.
- Logo de Proveedora como imagen predeterminada y marca de agua.

### Servidor local y ejecutable BAT

- `server.py` sirve la aplicación en `http://localhost:8000/index.html`.
- Abre automáticamente el navegador.
- Desactiva caché para facilitar pruebas y actualizaciones.
- Usa servidor con hilos y permite reutilizar el puerto.
- `INICIAR_POS.bat` busca primero `py -3` y después `python`.
- Si Python no está instalado, muestra instrucciones en pantalla.

### Impresión actualmente disponible

Archivos principales: `js/ticket/ticket.js`, `js/ticket/impresionUniversal.js` y `js/ticket/impresionConfig.js`.

- En PC usa `window.print()` y la impresora predeterminada de Windows.
- Puede trabajar con Chrome `--kiosk-printing` para impresión directa.
- Existe modo Android/RawBT como alternativa web.
- La configuración de impresoras requiere usuario con rol autorizado.
- Venta, reimpresión y corte usan el mismo sistema central.
- El ticket contiene negocio, domicilio, RFC, teléfono, folio, fecha, partidas, subtotal, descuento, impuestos, total, pagos, cambio, artículos y cajero.
- El formato actual de PC está orientado a ticket normal cercano a 80/88 mm.

## 3. Archivos que deben conocerse para continuar

- `index.html`: estructura inicial, bloqueo de arranque y carga de módulos.
- `js/app.js`: arranque general.
- `js/firebase/config.js`: credenciales Firebase que debe colocar el propietario.
- `js/config/usuariosVentas.js`: rutas reales y de prueba de ventas.
- `js/ui/inicioSistema.js`: preparación obligatoria previa al login.
- `js/auth/login.js`: sesión y usuario actual.
- `js/catalogo/catalogo.js`: catálogo incremental, índices y fotos.
- `js/catalogo/indexeddb.js`: almacenamiento local.
- `js/scanner/scanner.js`: escáner y disparo automático de búsqueda.
- `js/busqueda/busquedaManual.js`: búsqueda multicoincidente.
- `js/carrito/carrito.js`: partidas, cantidades y auditoría del carrito.
- `js/cobro/cobro.js`: cálculo fiscal, descuento, pagos y cobro.
- `js/ventas/guardarVenta.js`: construcción y sincronización de documentos.
- `js/ventas/ventaEspera.js`: espera, recuperación y cancelación desde espera.
- `js/ventas/ventaInterrumpidaLocal.js`: respaldo automático.
- `js/ventas/cancelarVenta.js`: cancelación de la captura actual.
- `js/ventas/motivosCancelacion.js`: motivos permitidos.
- `js/offline/ventasPendientes.js`: cola offline.
- `js/reportes/corte.js`: corte operativo.
- `js/reportes/reimpresionTickets.js`: reimpresión.
- `js/ticket/impresionUniversal.js`: salida central de impresión.
- `server.py` e `INICIAR_POS.bat`: ejecución local.

## 4. Configuración manual pendiente del propietario

Archivo: `js/firebase/config.js`

Actualmente `apiKey` conserva el valor de ejemplo `TU_API_KEY`. Debe reemplazarse con la configuración web real del proyecto Firebase. La región Firestore `nam5` pertenece al proyecto y no se escribe como parámetro en el código web.

Campos de catálogo necesarios para la sincronización:

- `updatedAt`: Timestamp de Firestore obligatorio para cambios incrementales.
- `activo`: booleano.
- `codigoBarra`.
- `concepto`.
- `precioPublico`.
- Tasas, costos, departamento y demás campos comerciales según existan.

## 5. Funciones visibles que todavía no están terminadas

- **Historial Ventas:** aparece en el menú, pero todavía no abre una pantalla funcional.
- **Botón independiente RawBT:** aparece como referencia, pero la selección funcional se realiza desde Impresoras.
- **Configuración Ticket:** el botón visible todavía no abre un editor completo del diseño.
- **Depósitos:** no existe un módulo independiente para registrar depósitos o retiros; solamente se guardan las formas de pago y se resumen en el corte.
- **Inventario:** no descuenta existencias ni impide ventas por stock; vende únicamente con el catálogo.
- **Clientes:** opera con Público en General; todavía no incluye selección completa de clientes.
- **Android nativo:** todavía no está convertido a APK/aplicación nativa.
- **ESC/POS 58 mm con logo:** pendiente para la futura versión móvil. RawBT existe como alternativa, pero no equivale al módulo Android nativo final.
- **Cámara como escáner:** existen archivos auxiliares, pero el flujo principal probado es el lector HID/campo de captura.
- **Histórico y panel administrativo de cancelaciones:** los datos quedan guardados, pero falta una pantalla de consulta específica.

## 6. Riesgos y deuda técnica conocida

### Seguridad prioritaria

- El login consulta contraseñas en texto directo dentro de Firestore; debe migrarse a Firebase Authentication o a hashes validados en un backend seguro.
- La autorización local de partidas, cancelación y descuento utiliza una clave fija dentro del JavaScript descargable por el navegador.
- Las reglas de seguridad de Firestore deben impedir que un usuario modifique ventas de otro usuario o eleve su rol desde el cliente.
- Los permisos administrativos deben centralizarse; no deben depender únicamente de ocultar botones.

### Aspectos técnicos

- `enableIndexedDbPersistence` está deprecado en la versión actual del SDK; conviene migrar posteriormente a la configuración moderna de caché de Firestore.
- Las consultas compuestas de corte y reimpresión pueden requerir índices de Firestore.
- Las rutas antiguas mencionadas en archivos auxiliares deben considerarse legado; la ruta real vigente es la definida en `js/config/usuariosVentas.js`.
- Deben realizarse pruebas físicas de impresión, recuperación tras apagón, cola offline y varios usuarios antes de producción.
- La sincronización incremental depende de que todos los cambios de catálogo actualicen correctamente `updatedAt`.

## 7. Reglas funcionales vigentes

1. Cuando aparece el login, el catálogo indispensable ya debe estar disponible.
2. Las fotografías nunca deben bloquear la operación.
3. Las ventas reales deben escribirse en `CLIENTES/PDD031204KL5/VENTASV20261`.
4. Venta, corte, reimpresión y espera se identifican por el usuario logueado, no por caja.
5. Una venta cancelada conserva auditoría, pero no vuelve a aparecer como recuperable.
6. Una venta recuperada debe cobrar o cancelar el documento original, sin duplicarlo.
7. Una venta debe quedar local antes de imprimir o intentar sincronizar.
8. La búsqueda por palabras debe exigir todas las coincidencias sin importar el orden.
9. El POS vende desde catálogo; el control de inventario se implementará después.
10. El ticket móvil 58 mm y la aplicación Android nativa se implementarán en una etapa posterior.

## 8. Pruebas recomendadas para la siguiente sesión

1. Colocar la configuración Firebase real.
2. Arrancar en equipo nuevo con IndexedDB vacío y conexión disponible.
3. Arrancar con catálogo local y sin internet.
4. Buscar `BIG COLA 3.3 C6`, `COLA 3.3 C6`, `BIG 3.3` y `SABRIS`.
5. Escanear códigos normales, equivalentes y etiqueta de báscula.
6. Cobrar una venta con cada tipo de pago y una venta mixta.
7. Cortar internet antes de confirmar una venta y verificar la cola.
8. Mandar una venta a espera, recuperarla y cobrarla.
9. Recuperar otra venta y cancelarla; confirmar que ya no aparezca.
10. Cerrar el navegador con una venta activa y comprobar recuperación automática.
11. Reimprimir un ticket no cortado.
12. Generar un corte y confirmar que solamente incluya al usuario conectado.
13. Probar impresión real en la Epson/impresora predeterminada.

## 9. Validación de esta entrega

Antes de generar el ZIP se validan:

- Sintaxis de todos los archivos JavaScript con Node.
- Existencia de importaciones locales.
- Balance de llaves CSS.
- Compilación de `server.py`.
- Integridad del archivo ZIP.

Fin del resumen de continuidad.

## Actualización V17 - Impresión Windows directa/universal
- En Windows, `INICIAR_POS.bat` inicia el servidor y `server.py` intenta abrir Chrome o Edge con `--kiosk-printing`.
- `window.print()` se envía sin diálogo a la impresora PREDETERMINADA de Windows.
- Funciona igual si la impresora usa driver EPSON/Windows o `Generic / Text Only` por puerto paralelo.
- Configuración de impresión ahora contempla: `WINDOWS_DIRECTO`, `WINDOWS_DIALOGO` y `RAWBT`.
- Se agregó selección de ancho 58 mm / 80 mm por dispositivo.
- Compatibilidad hacia atrás: una configuración antigua `WINDOWS` se interpreta como `WINDOWS_DIRECTO`.
- Limitación web: Chrome/Edge no permiten seleccionar por nombre la impresora desde JavaScript; para múltiples impresoras simultáneas se requerirá un puente local/Electron.
