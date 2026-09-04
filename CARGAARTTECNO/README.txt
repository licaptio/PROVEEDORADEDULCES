PROVSOFT - MIGRADOR MANUAL DESDE CHROME
=======================================

QUÉ HACE
--------

1. Abres index.html mediante un servidor web.
2. Seleccionas articulos.txt.
3. Seleccionas precant.txt.
4. Seleccionas equiv.txt.
5. Presionas "Procesar catálogo".
6. Descarga el catálogo de Firestore una sola vez.
7. Compara la información en memoria.
8. Actualiza solamente los cambios.
9. Vacía los tres archivos seleccionados a 0 bytes cuando todo termina correctamente.


CONFIGURACIÓN FIREBASE
----------------------

Edita:

assets/js/firebase-config.js

y reemplaza las claves de ejemplo por tus claves reales.


IMPORTANTE PARA CHROME
----------------------

La API de selección y escritura de archivos funciona en:

- Chrome actualizado.
- Edge actualizado.
- HTTPS.
- localhost.

No conviene abrir index.html directamente con file:// porque los módulos JS y permisos pueden ser bloqueados.

Puedes abrir la carpeta con un servidor sencillo.

Ejemplo con Python:

python -m http.server 8000

Después abre:

http://localhost:8000


SEGURIDAD
---------

Los archivos solamente se vacían después de que:

- termina la lectura;
- termina la comparación;
- terminan las escrituras de Firebase;
- no ocurrió ningún error.

Si el proceso falla antes, los archivos no se vacían.


ESTRUCTURA
----------

index.html
assets/
  css/
    app.css
  js/
    app.js
    procesador.js
    firebase-config.js

VERSIÓN AHORRO FIREBASE + CENTINELA
-----------------------------------

Esta versión está conectada con la app SALIDA ABARROTES PDD V32.

Cuando este migrador modifica realmente uno o más documentos de /productos:

1. Cada producto modificado conserva su actualizadoEn.
2. Al terminar TODO el proceso se actualiza UNA SOLA VEZ el documento:

   almacenes/abarrotespdd/configuracion/catalogo_version

3. Se incrementa el campo version con increment(1).
4. Se guarda actualizadoEn con serverTimestamp().
5. La app de salidas recibe el aviso y ejecuta su sincronización incremental.

Si los TXT no producen cambios reales, el centinela NO se modifica.

AHORRO ADICIONAL
-----------------

La versión anterior podía escribir productos que no tenían cambios reales sólo para
actualizar catalogoVerificadoEn. Esta versión ya no hace esas escrituras. La comparación
se hace en memoria y un producto sin cambios no genera escritura ni aviso a los teléfonos.

El catálogo completo se sigue leyendo una vez al iniciar el proceso porque esta herramienta
necesita comparar los TXT contra los documentos existentes antes de decidir qué modificar.
