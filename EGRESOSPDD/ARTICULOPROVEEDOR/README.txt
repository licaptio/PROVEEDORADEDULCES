ARTICULOPROVEEDOR - PAGINACION REAL / AHORRO SUPABASE
=====================================================

EJECUCION
1. Haz doble clic en EJECUTAR.bat.
2. Se inicia server.py en http://localhost:8000.
3. El navegador se abre automáticamente.

BUSQUEDA
- Usa la RPC public.buscar_facturas_por_concepto.
- Busca por descripción o por código/noIdentificacion.
- Mínimo 3 caracteres.
- Espera 500 ms después de escribir para evitar consultas por cada tecla.

PAGINACION REAL
- 40 resultados por página.
- Página 1 solicita únicamente los primeros 40 a PostgreSQL.
- Siguiente solicita los siguientes 40.
- Anterior consulta la página correspondiente, salvo que ya esté en caché local.
- La RPC devuelve total_resultados, usado para calcular el número real de páginas.

AHORRO DE SUPABASE
- No descarga cientos o miles de facturas para paginarlas en el navegador.
- No existe fallback que lea lotes completos de deuda_limpia_pdd.
- Caché en memoria de las últimas 30 combinaciones búsqueda+página.
- Si el usuario vuelve a una página ya consultada durante la misma sesión, no se repite la llamada RPC.
- No se hace prefetch de la página siguiente para evitar consumo innecesario.

REQUISITO EN SUPABASE
La función buscar_facturas_por_concepto debe aceptar:
  texto_busqueda text
  pagina integer
  limite integer

y devolver total_resultados.
