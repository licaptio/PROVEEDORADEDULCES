PROVSOFT RECORDATORIOS MODULAR V1.3 - IMAGENES

1. Ejecuta INICIAR_SERVIDOR.bat.
2. Pega texto normalmente.
3. Para capturas: Windows + Shift + S y después Ctrl + V dentro de la página.
4. También puedes arrastrar o seleccionar varias imágenes.

IMPORTANTE - STORAGE:
Copia el contenido de storage.rules en Firebase > Storage > Reglas y publica.
Estas reglas son temporales para desarrollo: permiten leer imágenes y subir solo archivos image/* menores de 10 MB dentro de recordatorios/.

Incluye:
- Ctrl+V para imágenes
- Arrastrar y soltar
- Selección múltiple
- Vista previa y eliminación antes de guardar
- Subida a Firebase Storage
- URLs guardadas en Firestore
- Miniaturas en listado
- Visor grande
- server.py e INICIAR_SERVIDOR.bat

CAMBIOS V1.4:
- La aplicación ocupa todo el ancho y alto disponible.
- Se eliminó la barra principal de desplazamiento en escritorio.
- Las listas usan desplazamiento interno con barra oculta.
- Las tarjetas ahora muestran solo un resumen compacto.
- Al hacer clic en una tarjeta se abre el contenido completo.
- El detalle muestra todas las imágenes y el mensaje íntegro.

CAMBIOS V1.5 - EDITOR MODAL:
- Clic en una tarjeta abre un modal de edición.
- La lista principal permanece sin cambios.
- Permite modificar fecha, hora y mensaje.
- Permite pegar, arrastrar y agregar nuevas imágenes.
- Permite quitar imágenes existentes.
- Guarda cambios en Firestore y Storage.
- Permite marcar el recordatorio como atendido.
- Confirma antes de cerrar cuando existen cambios sin guardar.
