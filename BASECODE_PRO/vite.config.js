import { defineConfig } from 'vite';
import javascriptObfuscator from 'vite-plugin-javascript-obfuscator';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
    // Configuración para mantener la estructura actual
    base: './', // CRÍTICO: Rutas relativas para que funcione en subcarpetas del hosting
    root: '.', // Raíz del proyecto
    publicDir: 'public', // Carpeta de archivos públicos (assets y módulos)

    plugins: [
        /* javascriptObfuscator({
            // Solo aplicar ofuscación en el build de producción
            include: [/\.js$/],
            exclude: [/node_modules/],
            options: {
                compact: true,
                controlFlowFlattening: false,
                deadCodeInjection: false,
                debugProtection: false,
                debugProtectionInterval: 0,
                disableConsoleOutput: true,
                identifierNamesGenerator: 'hexadecimal',
                log: false,
                numbersToExpressions: false,
                renameGlobals: false, // Mantener para evitar errores con funciones window.
                selfDefending: true,
                splitStrings: true,
                splitStringsChunkLength: 10,
                stringArray: true,
                stringArrayCallsTransform: true,
                stringArrayIndexShift: true,
                stringArrayRotate: true,
                stringArrayShuffle: true,
                stringArrayWrappersCount: 2,
                stringArrayWrappersType: 'variable',
                stringArrayThreshold: 0.75,
                transformObjectKeys: false,
                unicodeEscapeSequence: false
            }
        }) */
    ],

    build: {
        target: 'esnext',
        outDir: 'dist', // Carpeta de salida para producción
        emptyOutDir: true,
        sourcemap: false, // CRÍTICO: No generar mapas de código fuente

        // Mantener nombres de archivos originales
        rollupOptions: {
            input: {
                main: './index.html',
                superweb: './superweb.html',
                dashboard: './index_dashboard.html',
                superadmin: './super_admin.html',
                creador: './creador_eventos.html',
                directorio: './admin/directorio.html',
                acceso: './admin/acceso.html',
                fotografo: './acceso_fotografo.html',
                datos_evento: './datos_evento.html',
                datos_fotografo: './datos_fotografo.html',
                renombrar: './admin/util_renombrar.html'
            },
            output: {
                // Mantener estructura de carpetas
                entryFileNames: 'js/[name].js',
                chunkFileNames: 'js/[name].js',
                assetFileNames: (assetInfo) => {
                    const info = assetInfo.name;
                    if (info && info.endsWith('.css')) {
                        return 'css/[name][extname]';
                    }
                    return 'assets/[name][extname]';
                }
            }
        },

        // Configuración de minificación con Terser
        minify: 'terser',
        terserOptions: {
            compress: {
                // Eliminar console.log en producción
                drop_console: true,
                drop_debugger: true,
                pure_funcs: ['console.log', 'console.info', 'console.debug']
            },
            format: {
                // Mantener comentarios importantes
                comments: false
            }
        }
    },

    // Configuración del servidor de desarrollo
    server: {
        port: 5173,
        open: '/index.html?id=claudia-2026', // Abrir automáticamente con parámetro
        cors: true
    },

    // Preservar dependencias externas (Firebase, EmailJS, etc.)
    optimizeDeps: {
        exclude: []
    }
});
