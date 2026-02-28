# Tareas Pendientes: Incidencia Basecode

## Problema Actual
En la versión de **Basecode**, desde el creador de apps (Superweb):
1. **Botón "Publicar App":** No hace nada al hacer clic.
2. **Botón "Link":** Muestra un error o no carga la URL correcta especificando el dominio (`basecode.es`).

## Causa Probable
- Los scripts encargados de estas funciones (`js/creador.js` u otros) están ofuscados/minificados y parece que las funciones globales como `guardarEvento` o `copiarLink` no se están exponiendo correctamente (o hay un error de JS silencioso deteniendo la ejecución debido a variables o dominios quemados en el código minificado).
- Hay que revisar el archivo fuente de `creador.js` (antes de la minificación) para aplicar las lógicas de dominio dinámico (`basecode.es/mi_primera_comunion/`).

## Próximos pasos
Para la siguiente sesión, reanudaremos desofuscando o recuperando la versión legible de `creador.js` para corregir la inyección del dominio y la acción de los botones.
