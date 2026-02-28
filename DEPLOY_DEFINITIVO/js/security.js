/* --- SISTEMA DE SEGURIDAD SENTINEL --- */
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let dbInstance = null;
let eventId = null;

/**
 * Inicializa el sistema de protección y reporte.
 */
export const initSecurity = (db, id) => {
    dbInstance = db;
    eventId = id;

    // No bloquear en entorno de desarrollo local (localhost)
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) {
        console.log("🛡️ MODO LABORATORIO: Sentinel en espera (bloqueos desactivados).");
        return;
    }

    aplicarBloqueosInterfaz();
    iniciarDetectorConsola();
};

/**
 * Registra un intento de inspección en Firebase.
 */
const reportarIntento = async (tipo) => {
    if (!dbInstance || !eventId) return;
    try {
        await addDoc(collection(dbInstance, 'eventos', eventId, 'security_alerts'), {
            tipo: tipo,
            fecha: serverTimestamp(),
            dispositivo: navigator.userAgent,
            url: window.location.href,
            pantalla: `${window.innerWidth}x${window.innerHeight}`
        });
        console.warn("🛡️ SENTINEL: Intento detectado y almacenado.");
    } catch (e) {
        // Silencio si falla el reporte
    }
};

/**
 * Bloquea interacciones comunes para ver código.
 */
const aplicarBloqueosInterfaz = () => {
    document.addEventListener('contextmenu', e => {
        e.preventDefault();
        reportarIntento('CLICK_DERECHO');
        return false;
    });

    document.addEventListener('keydown', e => {
        if (e.keyCode === 123) { // F12
            e.preventDefault();
            reportarIntento('TECLA_F12');
            return false;
        }
        if ((e.ctrlKey || e.metaKey) && e.keyCode === 85) { // Ver código
            e.preventDefault();
            reportarIntento('VER_CODIGO_CTRL_U');
            return false;
        }
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74)) { // Consola
            e.preventDefault();
            reportarIntento('CONSOLA_SHORTCUT');
            return false;
        }
        if ((e.ctrlKey || e.metaKey) && e.keyCode === 83) { // Guardar página
            e.preventDefault();
            reportarIntento('GUARDAR_PAGINA_CTRL_S');
            return false;
        }
    });

    document.addEventListener('dragstart', e => {
        if (e.target.nodeName === 'IMG') e.preventDefault();
    });
};

/**
 * Detecta apertura de consola por redimensionamiento.
 */
const iniciarDetectorConsola = () => {
    const umbral = 160;
    const revisar = () => {
        const difAncho = window.outerWidth - window.innerWidth > umbral;
        const difAlto = window.outerHeight - window.innerHeight > umbral;
        if (difAncho || difAlto) {
            reportarIntento('CONSOLA_DETECTADA_DIMENSION');
        }
    };
    window.addEventListener('resize', revisar);
    setInterval(revisar, 3000);
};
