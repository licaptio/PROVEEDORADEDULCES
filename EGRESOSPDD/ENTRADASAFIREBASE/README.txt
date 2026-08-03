PROVSOFT - VISOR DE ENTRADAS DE ALMACÉN CENTRAL PDD

RUTA CONSULTADA:
/almacenes/ALMACENCENTRALPDD/entradas/{ID_DOCUMENTO}

CONFIGURACIÓN:
1. Abre assets/firebase-config.js
2. Sustituye los datos de firebaseConfig por los de tu proyecto.
3. Verifica que el usuario tenga permiso de lectura en Firestore.
4. Ejecuta INICIAR_APP.bat o abre una terminal y corre: python server.py

FUNCIONES:
- Lista todas las entradas del nodo.
- Selector por año y mes.
- Búsqueda por proveedor, folio, RFC o UUID.
- Resumen por proveedor.
- Tarjetas individuales por documento.
- Visor independiente con datos generales, conceptos, impuestos, fotos y JSON completo.

NOTA:
El filtro de fecha se realiza en el navegador para evitar depender de índices compuestos de Firestore.
