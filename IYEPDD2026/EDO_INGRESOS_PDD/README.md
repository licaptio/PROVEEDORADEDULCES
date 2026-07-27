# Estado financiero — Ingresos v2

Esta versión consulta y muestra simultáneamente:

- El mes seleccionado.
- El acumulado anual del año seleccionado.
- Contado y crédito en ambos periodos.

## Funciones SQL requeridas

- `public.obtener_ingresos_mensuales(p_anio integer, p_mes integer)`
- `public.obtener_ingresos_anuales(p_anio integer)`

## Configuración

La conexión está en:

`assets/js/config.js`

## Estructura

- `index.html`: estructura visual.
- `assets/css/styles.css`: diseño.
- `assets/js/config.js`: conexión.
- `assets/js/utils.js`: formatos.
- `assets/js/api.js`: llamadas RPC mensuales y anuales.
- `assets/js/ui.js`: renderizado.
- `assets/js/app.js`: eventos y carga paralela.
- `server.py`: servidor local.

## Ejecución

```bash
python server.py
```

Después abre:

`http://localhost:8000`

## Nota

El frontend no clasifica conceptos ni calcula impuestos. Los importes proceden de las
funciones SQL. Solo suma los registros ya calculados de contado y crédito para mostrar
los encabezados generales de cada periodo.


## Cambio v3: acumulado anual sin timeout

La aplicación ya no llama `obtener_ingresos_anuales`, porque procesar todos los
conceptos del año en una sola sentencia puede superar el `statement_timeout`.

Ahora consulta `obtener_ingresos_mensuales` por cada mes, en lotes de tres, y
acumula los resultados ya calculados. Los cálculos fiscales siguen en PostgreSQL;
el navegador únicamente suma los doce resúmenes mensuales.


## Corrección v4

- Se corrigieron los identificadores de los resúmenes mensual y anual.
- Se agregó un favicon embebido para evitar el error 404 de `/favicon.ico`.
- La interfaz ahora reporta claramente si falta algún elemento HTML.
