# ACTUALIZACIÓN CEREBRO DIGITAL - 13 FEB 2026

## Cambios Implementados:
1. **Corrección de URLs en Directorio**: Se ha centralizado la lógica para que las URLs apunten a la raíz del Master Engine (`index.html?id=ID`) en lugar de subcarpetas `/comuniones2026/`.
2. **Priorización de IDs de Firestore**: Se ha corregido el error de duplicidad donde eventos (como Javi y Daniela) mostraban el ID de "nora". Ahora se utiliza el ID real del documento de Firestore.
3. **Sincronización de Toggles**: El interruptor de "Elección de Menú" en el panel de administración ahora funciona correctamente, actualiza `giftSettingsData.menuVisible` y respeta los estilos CSS sin inline overrides.
4. **Build de Producción**: Se ha generado una nueva versión ofuscada en `dist/` y sincronizado en `SUBIR_A_APPS/`.

## Estado del Proyecto:
- **Savepoint Local**: Creado en `_BACKUPS_Y_PRUEBAS_/COPIA DE SEGURIDAD/SAVE_POINT_CORREGIDO_13_FEB.zip`.
- **Despliegue**: Los archivos en `SUBIR_A_APPS/` están listos para ser subidos vía FTP.
