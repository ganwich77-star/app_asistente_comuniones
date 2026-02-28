// Importaciones de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, deleteDoc, setDoc, getDoc, getDocs, runTransaction, deleteField } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getStorage, ref, uploadString, getDownloadURL, uploadBytes } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

// Importaciones de componentes
import { initAdmin } from './components/admin.js';
import { initSecurity } from './security.js';

// Importar la configuración generada
import { config } from './config.js';
import { getCurrentBrand } from './brands.js';

const BRAND = getCurrentBrand();

// --- CAPTURA DE ID DEL EVENTO ---
const getEventIdFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('id')) return params.get('id');
    const path = window.location.pathname;
    const parts = path.split('/').filter(p => p && !p.includes('.'));
    const lastFolder = parts[parts.length - 1];
    const systemFolders = ['apps', 'admin', 'modulos', 'js', 'assets', 'css', 'img'];
    if (lastFolder && !systemFolders.includes(lastFolder)) return lastFolder;
    return 'demo';
};
let EVENT_ID = getEventIdFromUrl();

// --- CONFIGURACIÓN DE FIREBASE ---
const app = initializeApp(config.firebase);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Activar sistema de seguridad Sentinel
initSecurity(db, EVENT_ID);


signInAnonymously(auth).catch((error) => {
    console.error("Error al iniciar sesión de forma anónima:", error);
    if (error.code === 'auth/api-key-not-valid') {
        alert("⚠️ ERROR DE CONFIGURACIÓN:\n\nLa 'apiKey' en js/config.js es incorrecta.\n\nEdita el archivo js/config.js y pon tu API Key real de Firebase.");
    }
});

export { db, auth };

// --- CONSTANTES Y VARIABLES GLOBALES ---
let APP_ID = config.app.id; // Changed to let for dynamic update
// El nombre del protagonista se usará dinámicamente desde config.protagonista.nombre
let PROTAGONISTA = ""; // Se actualizará en applyHydration
let vendorsList = [];
let currentReviewIndex = 0;
let reviewInterval = null;
let galleryListenerUnsubscribe = null; // Para almacenar la función de desuscripción del listener de la galería
let photosToDelete = []; // Para almacenar los IDs de las fotos a borrar

let isGuestDeleteMode = false;
let guestsToDelete = [];
let urgencyInterval = null;

// --- CARGADOR DE MÓDULOS ---
const cargarModulo = async (id, url) => {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Error al cargar ${url}: ${response.statusText}`);
        const html = await response.text();
        const container = document.getElementById(id);
        if (container) {
            container.innerHTML = html;
        }
    } catch (error) {
        console.error(error);
    }
};

const cargarModulos = () => {
    const modulos = [
        { id: 'mod-nav', url: 'modulos/nav.html' },
        { id: 'mod-asistencia', url: 'modulos/asistencia.html' },
        { id: 'mod-galeria', url: 'modulos/galeria.html' },
        { id: 'mod-regalo', url: 'modulos/regalo.html' },
        { id: 'mod-admin', url: 'modulos/admin.html' },
        { id: 'mod-map', url: 'modulos/map.html' }
    ];

    Promise.all(modulos.map(m => cargarModulo(m.id, m.url)))
        .then(async () => { // Async to wait for hydration
            console.log("Módulos cargados.");

            // HYDRATION: Cargar datos del evento dinámico de Firestore
            if (EVENT_ID && EVENT_ID !== 'demo') {
                await hydrateConfigFromFirestore(EVENT_ID);
            }

            populateStaticData(); // <-- LLAMAMOS A LA NUEVA FUNCIÓN AQUÍ
            replacePlaceholders(); // Reemplazar placeholders como {{PROTAGONISTA}}
            inicializarComponentes();
            handleNavigation(); // Ejecutar navegación tras cargar

            // ==========================================
            // 🛠️ MODO DESARROLLO LOCAL (PARA PRUEBAS)
            // ==========================================
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            // MODO LABORATORIO DESACTIVADO PARA PRODUCCIÓN
            /*
            if (isLocal) {
                console.log("🛠️ MODO LABORATORIO: Desbloqueando App y abriendo Admin...");

                // 1. Desbloquear visualmente y lógicamente
                document.body.classList.remove('locked');
                document.body.classList.add('unlocked');
                isUnlocked = true;

                // 2. Silenciar todos los audios por defecto
                document.querySelectorAll('audio').forEach(a => {
                    a.muted = true;
                    a.volume = 0;
                    a.pause();
                });

                // 3. Ocultar la capa de intro/música si existe
                const introLayer = document.getElementById('music-container');
                if (introLayer) introLayer.style.display = 'none';

                // 4. Mostrar navegación
                const modNav = document.getElementById('mod-nav');
                if (modNav) modNav.style.display = 'block';

                // 5. Auto-abrir Panel Admin tras carga
                setTimeout(() => {
                    const p = document.getElementById('admin-panel');
                    if (p) {
                        p.classList.remove('hidden');
                        p.style.display = 'block';
                        p.scrollIntoView();
                        window.loadAdminData();
                    }
                    const welcome = document.getElementById('admin-welcome-screen');
                    if (welcome) welcome.style.display = 'none';
                    const pinModal = document.getElementById('pin-modal');
                    if (pinModal) pinModal.style.display = 'none';
                }, 800);
            }
            */
        });
};

const hydrateConfigFromFirestore = async (eventId) => {
    try {
        console.log(`💧 Hidratando app con datos del evento: ${eventId}`);
        const urlParams = new URLSearchParams(window.location.search);
        const isPreview = urlParams.get('preview') === 'true';
        let eventSnap = null;

        // PRIORIDAD MÁXIMA PARA LIVE PREVIEW: localStorage
        if (isPreview) {
            const localData = localStorage.getItem(`preview_data_${eventId}`);
            if (localData) {
                console.log("🚀 Usando datos de Live Preview (localStorage)");
                const data = JSON.parse(localData);
                applyHydration(data);
                return;
            }
        }

        eventSnap = await getDoc(doc(db, "eventos", eventId));

        // FALLBACK 1: Registros temporales
        if (!eventSnap.exists()) {
            console.log("🔍 No encontrado en 'eventos', buscando en _internal_temp...");
            eventSnap = await getDoc(doc(db, "_internal_temp", eventId));
        }

        // FALLBACK 2: Colección principal definida por la marca
        if (!eventSnap.exists()) {
            console.log(`🔍 Buscando en colección de marca: ${BRAND.firebaseCollection}...`);
            eventSnap = await getDoc(doc(db, BRAND.firebaseCollection, eventId));
        }

        // FALLBACK 3: Búsqueda por slug/id guardado como campo en el documento
        if (!eventSnap.exists()) {
            console.log(`🔍 Intentando búsqueda por campo slug/id en ${BRAND.firebaseCollection}...`);
            const { getDocs: _getDocs, collection: _col, query: _q, where: _w } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");

            const slugQuery = _q(_col(db, BRAND.firebaseCollection), _w("slug", "==", eventId));
            const slugSnap = await _getDocs(slugQuery);
            if (!slugSnap.empty) {
                eventSnap = slugSnap.docs[0];
                console.log("✅ Encontrado por slug:", eventSnap.id);
            } else {
                const idQuery = _q(_col(db, BRAND.firebaseCollection), _w("id", "==", eventId));
                const idSnap = await _getDocs(idQuery);
                if (!idSnap.empty) {
                    eventSnap = idSnap.docs[0];
                    console.log("✅ Encontrado por campo id:", eventSnap.id);
                }
            }
        }

        // FALLBACK 4: Búsqueda FUZZY por nombre normalizado (para URLs ya compartidas como ?id=leyreydaira)
        // Normaliza: minúsculas + sin tildes + sin guiones/espacios/underscores → compara con ID del doc
        if (!eventSnap.exists()) {
            console.log(`🔍 Búsqueda fuzzy por nombre normalizado en ${BRAND.firebaseCollection}...`);
            const { getDocs: _getDocs2, collection: _col2 } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
            const allSnap = await _getDocs2(_col2(db, BRAND.firebaseCollection));

            // Normalizar el ID de la URL: todo junto, sin separadores, sin tildes, minúsculas
            const normalize = (s) => s.toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]/g, ""); // elimina guiones, espacios, underscores, etc.

            const urlNorm = normalize(eventId);

            for (const docSnap of allSnap.docs) {
                const docId = docSnap.id;
                const data = docSnap.data();
                // Comparar con el ID del documento normalizado
                if (normalize(docId) === urlNorm) {
                    eventSnap = docSnap;
                    console.log("✅ Encontrado por fuzzy match en doc ID:", docId);
                    break;
                }
                // También comparar con el nombre del protagonista normalizado (ej: "Leyre y Idaira" → "leyreeidaira")
                const nombre = (data.photagonistName || data.protagonistName || data.nombre || '');
                const apellido = (data.protagonistLastName || '');
                const nombreCompleto = nombre + apellido;
                if (normalize(nombreCompleto) === urlNorm || normalize(nombre) === urlNorm) {
                    eventSnap = docSnap;
                    console.log("✅ Encontrado por fuzzy match en nombre:", nombre);
                    break;
                }
            }
        }

        if (eventSnap && eventSnap.exists()) {
            const data = eventSnap.data();
            applyHydration(data);
        } else {
            console.warn(`No se encontró el evento ${eventId} en ninguna colección.`);
            if (eventId !== 'demo') {
                window.showCustomAlert("El evento solicitado no existe o no ha sido activado todavía.", "🔍");
                config.protagonista.nombre = "No encontrado";
                populateStaticData();
            }
        }
    } catch (error) {
        console.error("❌ Error hidratando configuración:", error);
    }
};

/**
 * Aplica los datos cargados a la configuración global (config)
 */
const applyHydration = (data) => {
    console.log("💧 Aplicando hidratación:", data);

    // Limpiar fotos por defecto de Nora antes de aplicar las nuevas
    config.media.introFotos = [];

    // IMPORTANTE: Desuscribir galería si existía para resuscribirse con el nuevo APP_ID
    if (galleryListenerUnsubscribe) {
        galleryListenerUnsubscribe();
        galleryListenerUnsubscribe = null;
    }

    APP_ID = data.slug || EVENT_ID;
    config.app.title = data.appTitle || data.eventTitle || `${data.photagonistName || data.protagonistName || data.nombre || 'Mi'} - Mi Primera Comunión`;

    // 2. Protagonista (compatibilidad con fotagonistName, protagonistName y nombre)
    const nombreProtag = data.photagonistName || data.protagonistName || data.nombre || '';
    const apellidoProtag = data.protagonistLastName || data.apellidos || '';
    config.protagonista.nombre = nombreProtag + (apellidoProtag ? ' ' + apellidoProtag : '');
    config.protagonista.subtitulo = data.eventSubtitle || config.protagonista.subtitulo;
    PROTAGONISTA = config.protagonista.nombre; // Sincronizar variable global
    window.PROTAGONISTA = PROTAGONISTA; // Asegurar disponibilidad global

    // 3. Evento
    // Intentamos parsear la fecha si viene como string ISO
    if (data.eventDate) {
        config.evento.fecha = data.eventDate;
    }
    config.evento.fechaTexto = data.eventDateText || config.evento.fechaTexto;

    // 4. Lugares (Ceremonia)
    if (data.ceremony) {
        config.evento.ceremonia.nombre = data.ceremony.place || config.evento.ceremonia.nombre;
        config.evento.ceremonia.hora = data.ceremony.time || config.evento.ceremonia.hora;
        config.evento.ceremonia.lugar = data.ceremony.location || config.evento.ceremonia.lugar;
        config.evento.ceremonia.mapsUrl = data.ceremony.mapsUrl || config.evento.ceremonia.mapsUrl;
    }

    // 5. Lugares (Banquete)
    if (data.banquet) {
        config.evento.banquete.nombre = data.banquet.place || config.evento.banquete.nombre;
        config.evento.banquete.hora = data.banquet.time || config.evento.banquete.hora;
        config.evento.banquete.lugar = data.banquet.location || config.evento.banquete.lugar;
        config.evento.banquete.mapsUrl = data.banquet.mapsUrl || config.evento.banquete.mapsUrl;
    }

    // 6. Multimedia (Fotos Intro)
    // Prioridad 1: Array introPhotos. Prioridad 2: Campos individuales introFoto1, 2, 3.
    let rawPhotos = [];
    if (data.introPhotos && Array.isArray(data.introPhotos) && data.introPhotos.length > 0) {
        rawPhotos = data.introPhotos;
    } else {
        // FALLBACK a campos individuales (Formulario de cliente)
        if (data.introFoto1 || data.foto1) rawPhotos.push(data.introFoto1 || data.foto1);
        if (data.introFoto2 || data.foto2) rawPhotos.push(data.introFoto2 || data.foto2);
        if (data.introFoto3 || data.foto3) rawPhotos.push(data.introFoto3 || data.foto3);
    }

    if (rawPhotos.length > 0) {
        // --- CORRECCIÓN FINAL POST-MIGRACIÓN ---
        let photos = [...rawPhotos]; // Create a mutable copy
        const officialBucket = "asistente-digital-comuniones.firebasestorage.app";

        for (let i = 0; i < photos.length; i++) {
            let found = photos[i];
            if (found && typeof found === 'string') {
                const isRelative = !found.startsWith('http');
                const isOldBucket = found.includes('comunion-nora-2026');

                if (isRelative || isOldBucket) {
                    const path = found.includes('/o/') ? found.split('/o/')[1].split('?')[0] : found.replace(/\//g, '%2F');
                    const pathEncoded = path.includes('%2F') ? path : path.replace(/\//g, '%2F');

                    // Extraer TOKEN si existe
                    const tokenMatch = found.match(/token=([^&]+)/);
                    const token = tokenMatch ? tokenMatch[1] : null;

                    let newUrl = `https://firebasestorage.googleapis.com/v0/b/${officialBucket}/o/${pathEncoded}?alt=media`;
                    if (token) newUrl += `&token=${token}`;

                    photos[i] = newUrl;
                    console.warn(`🔄 Foto redirigida en App con token: ${photos[i]}`);
                }
            }
        }
        const filledPhotos = photos.filter(Boolean); // Filter out any null/undefined entries

        // Evitar meter fotos de Nora (demo) en registros de clientes
        // Si faltan fotos, repetimos la primera del propio registro para rellenar los 3 slots
        const finalPhotos = [...filledPhotos];
        while (finalPhotos.length > 0 && finalPhotos.length < 3) {
            finalPhotos.push(filledPhotos[0]);
        }

        if (finalPhotos.length > 0) {
            config.media.introFotos = finalPhotos;
        }
    }

    // 7. Extras (Padres) y Música
    config.extra = {
        parentName: data.parentName || data.nombre_padre || data.familia || config.extra?.parentName || '',
        parentDNI: (data.parentDNI || data.dni || data.dniPadre || data.dni_padre || config.extra?.parentDNI || '').toString().trim()
    };

    // Aplicar música personalizada si existe
    if (data.audio && data.audio.fondo) {
        config.media.audio.fondo = data.audio.fondo;
        const bgMusic = document.getElementById('bg-music-src');
        if (bgMusic) {
            bgMusic.src = data.audio.fondo;
            document.getElementById('bg-music').load();
        }
    }

    console.log("✅ Configuración actualizada correctamente.", config);
    populateStaticData(); // FORZAR ACTUALIZACIÓN DE LA UI CON LOS NUEVOS DATOS
};

/**
 * Gestiona la entrada en el campo de teléfono de notificaciones,
 * mostrando una confirmación para guardar el número automáticamente.
 */
const handleNotificationPhoneInput = (event) => {
    const input = event.target;
    const phoneRegex = /^\+?\d{9,15}$/; // Permite números con prefijo internacional
    const currentValue = input.value.trim();

    // Usar un "debounce" para no lanzar la confirmación con cada tecla
    clearTimeout(input.phoneCheckTimeout);
    input.phoneCheckTimeout = setTimeout(async () => {
        // Solo actuar si el número es válido y no es el que ya está confirmado
        if (phoneRegex.test(currentValue) && input.dataset.confirmedValue !== currentValue) {

            const confirmation = confirm(`¿Confirmar el número ${currentValue} para recibir notificaciones por WhatsApp?`);

            if (confirmation) {
                try {
                    window.showCustomAlert("Guardando número...", "⏳");

                    const notificationsToggle = document.getElementById('admin-notifications-toggle');
                    const isToggleActive = notificationsToggle ? notificationsToggle.classList.contains('active') : false;

                    const dataToSave = { notificationPhone: currentValue };

                    // Si el usuario confirma un número, activamos las notificaciones por él.
                    if (notificationsToggle && !isToggleActive) {
                        dataToSave.notificationsVisible = true;
                        notificationsToggle.classList.add('active'); // Actualizar visualmente
                    }

                    await setDoc(doc(db, 'eventos', EVENT_ID, 'settings', 'configuracion'), dataToSave, { merge: true });

                    // Guardar el valor confirmado para no volver a preguntar por el mismo número
                    input.dataset.confirmedValue = currentValue;
                    window.showCustomAlert("¡Número confirmado! Recibirás un WhatsApp por cada nuevo invitado.", "✅");

                } catch (error) {
                    console.error("Error al guardar el teléfono de notificación:", error);
                    window.showCustomAlert("Hubo un error al guardar el número. Inténtalo de nuevo.", "❌");
                }
            }
        }
    }, 800); // Esperar 800ms de inactividad antes de validar
};
window.handleNotificationPhoneInput = handleNotificationPhoneInput;

/**
 * Reestructura el panel de administración una vez que los módulos HTML están cargados.
 * Esto evita problemas de timing y asegura que los elementos existan antes de manipularlos.
 */
/**
 * REESTRUCTURACIÓN ELIMINADA: Ahora el HTML es estático en modulos/admin.html para mayor estabilidad.
 */
const restructureAdminPanel = () => {
    console.log("🛠️ El panel ya es estático, no se requiere reestructuración.");
};

/**
 * Rellena todos los elementos estáticos del DOM con los datos de config.js.
 * Se ejecuta después de que todos los módulos HTML han sido cargados.
 */
const populateStaticData = () => {
    console.log("✅ Rellenando la página con los datos de config.js...");
    // Actualizar el título de la página
    const titleEl = document.getElementById('app-title');
    if (titleEl) titleEl.innerText = config.app.title;

    // Actualizar la sección de inicio
    // Lógica inteligente para nombre y título
    const nameEl = document.getElementById('protagonista-nombre');
    const subtitleEl = document.getElementById('protagonista-subtitulo');

    if (nameEl && config.protagonista.nombre) {
        const name = config.protagonista.nombre;
        nameEl.innerText = name;

        // 0. Limpieza de clases que interfieren con el tamaño
        nameEl.classList.remove('text-7xl', 'md:text-9xl');
        nameEl.style.lineHeight = '1.1';
        nameEl.style.width = '100%';
        nameEl.style.display = 'block';
        nameEl.style.margin = '0 auto';
        nameEl.style.padding = '0 5px';

        // 1. Detección de Plural para el Título
        const isPlural = / (y|e|&|and) /i.test(name) || name.includes(',');

        if (subtitleEl) {
            let currentSubtitle = subtitleEl.innerText;
            let baseText = currentSubtitle.replace(/^(Mi|Nuestra)\s+/i, '');
            if (!baseText) baseText = "Primera Comunión";
            subtitleEl.innerText = (isPlural ? "Nuestra " : "Mi ") + baseText;
        }

        // 2. Ajuste Dinámico de Tamaño (Fit Text) Agresivo
        const adjustSize = () => {
            if (!nameEl.parentElement) return;

            const maxWidth = nameEl.parentElement.offsetWidth * 0.95;
            let fontSize = 120; // Empezamos grande (aprox 7.5rem)

            // FIX: Medir con inline-block para no tener ancho 100% artificialmente
            nameEl.style.whiteSpace = 'nowrap';
            nameEl.style.display = 'inline-block';
            nameEl.style.width = 'auto'; // Permitir que el ancho sea el del contenido
            nameEl.style.fontSize = fontSize + 'px';

            // Optimización eliminada para permitir nombres grandes
            // if (name.length > 15) fontSize = 80;

            // Reducción iterativa
            while ((nameEl.scrollWidth > maxWidth) && fontSize > 16) {
                fontSize -= 2;
                nameEl.style.fontSize = fontSize + 'px';
            }

            // Restaurar layout para centrado
            nameEl.style.display = 'block';
            nameEl.style.width = '100%';
            nameEl.classList.remove('opacity-0');

            // --- AJUSTE SUBTÍTULO (Modo Estrecho y Una Línea) ---
            if (subtitleEl) {
                subtitleEl.style.whiteSpace = 'nowrap';
                subtitleEl.style.display = 'inline-block';
                subtitleEl.style.width = 'auto';
                subtitleEl.style.maxWidth = 'none';

                // Ancho objetivo: 90% del ancho del nombre
                let targetWidth = nameEl.scrollWidth * 0.9;
                // Validar no superar contenedor
                if (targetWidth > maxWidth) targetWidth = maxWidth * 0.9;

                let subFontSize = 40;
                subtitleEl.style.fontSize = subFontSize + 'px';

                // Reducir fuente hasta que quepa
                while ((subtitleEl.scrollWidth > targetWidth) && subFontSize > 10) {
                    subFontSize -= 1;
                    subtitleEl.style.fontSize = subFontSize + 'px';
                }

                subtitleEl.style.display = 'block';
                subtitleEl.style.width = '100%';
                subtitleEl.style.margin = '0 auto 2rem auto';
            }
        };

        nameEl.classList.add('opacity-0');
        setTimeout(() => {
            adjustSize();
            setTimeout(adjustSize, 300);
        }, 0);

        const resizeObserver = new ResizeObserver(() => {
            adjustSize();
        });
        resizeObserver.observe(nameEl.parentElement);

        // Pluralizar texto "Toca mi corazón" si hay múltiples protagonistas
        const startInstructionEl = document.getElementById('start-instruction');
        if (startInstructionEl) {
            const hasMultipleProtagonists = name.includes(' y ') || name.includes(' Y ') || name.includes(' e ') || name.includes(' E ');
            startInstructionEl.innerText = hasMultipleProtagonists ? 'Toca nuestro corazón' : 'Toca mi corazón';
            // Mostrar el texto después de actualizarlo (eliminar parpadeo)
            startInstructionEl.classList.remove('opacity-0');
        }
    } else {
        document.getElementById('protagonista-subtitulo').innerText = config.protagonista.subtitulo;
    }
    document.getElementById('evento-fecha-texto').innerText = config.evento.fechaTexto;

    // Actualizar las fotos de introducción
    const photoCards = [
        document.getElementById('photo-card-1'),
        document.getElementById('photo-card-2'),
        document.getElementById('photo-card-3')
    ];
    photoCards.forEach((card, index) => {
        if (!card) return;
        const img = card.querySelector('img');
        const url = config.media.introFotos[index];
        if (url && img) {
            img.src = url;
            card.onclick = () => window.zoomPhoto(url);
        }
    });

    // Actualizar fuentes de audio y forzar recarga
    const bgMusic = document.getElementById('bg-music');
    const sfxHeartbeat = document.getElementById('sfx-heartbeat');
    const sfxKey = document.getElementById('sfx-key');
    const sfxShutter = document.getElementById('sfx-shutter');

    document.getElementById('bg-music-src').src = config.media.audio.fondo;
    bgMusic.load();

    document.getElementById('sfx-heartbeat-src').src = config.media.audio.latido;
    sfxHeartbeat.load();

    document.getElementById('sfx-key-src').src = config.media.audio.tecla;
    sfxKey.load();

    document.getElementById('sfx-shutter-src').src = config.media.audio.camara;
    sfxShutter.load();

    // Actualizar la sección del modal de Bizum
    document.getElementById('bizum-concept-protagonista').innerText = `Comunión de ${config.protagonista.nombre}`;

    // Actualizar la sección de lugares (¡LA CLAVE DEL PROBLEMA!)
    const ceremonySectionTitle = document.getElementById('ceremony-section-title');
    if (ceremonySectionTitle) ceremonySectionTitle.innerText = `⛪ Mi Ceremonia`; // Título genérico con icono
    const ceremonyName = document.getElementById('ceremony-name');
    if (ceremonyName) ceremonyName.innerText = config.evento.ceremonia.nombre; // Nombre específico del lugar de la ceremonia
    const ceremonyTime = document.getElementById('ceremony-time');
    if (ceremonyTime) ceremonyTime.innerText = config.evento.ceremonia.hora;
    const ceremonyLocation = document.getElementById('ceremony-location');
    if (ceremonyLocation) ceremonyLocation.innerText = config.evento.ceremonia.lugar; // Ubicación específica de la ceremonia
    const ceremonyMapBtn = document.getElementById('ceremony-map-btn');
    if (ceremonyMapBtn) ceremonyMapBtn.onclick = () => window.open(config.evento.ceremonia.mapsUrl, '_blank');

    const banquetSectionTitle = document.getElementById('banquet-section-title');
    if (banquetSectionTitle) banquetSectionTitle.innerText = `🍰 Mi Banquete`; // Título genérico con icono
    const banquetName = document.getElementById('banquet-name');
    if (banquetName) banquetName.innerText = config.evento.banquete.nombre; // Nombre específico del lugar del banquete
    const banquetTime = document.getElementById('banquet-time');
    if (banquetTime) banquetTime.innerText = config.evento.banquete.hora;
    const banquetLocation = document.getElementById('banquet-location');
    if (banquetLocation) banquetLocation.innerText = config.evento.banquete.lugar; // Ubicación específica del banquete
    const banquetMapBtn = document.getElementById('banquet-map-btn');
    if (banquetMapBtn) banquetMapBtn.onclick = () => window.open(config.evento.banquete.mapsUrl, '_blank');

    // Actualizar la sección del modal de Banco (Hucha)
    const bankModal = document.getElementById('bank-modal');
    if (bankModal && config.gift && config.gift.bank) {
        // El beneficiario y el IBAN ahora se cargan dinámicamente desde Firestore en loadSettings()
        document.getElementById('bank-concept').innerText = `Comunión de ${config.protagonista.nombre}`;
    }

    // --- DINAMIZAR MARCA (LOGO Y POWERED BY) ---
    const brandLogos = document.querySelectorAll('.footer-logo-style, #camera-intro-logo, #marketing-gift-form img');
    brandLogos.forEach(logo => {
        if (logo) logo.src = BRAND.logo;
    });

    const poweredByElements = document.querySelectorAll('footer p.text-\\[10px\\]');
    poweredByElements.forEach(el => {
        if (el.innerText.includes('Powered by')) {
            el.innerHTML = `Powered by <span class="font-bold text-emerald-700">${BRAND.name}</span>`;
        }
    });

    const sloganElement = document.querySelector('footer p.font-cursive');
    if (sloganElement && BRAND.id === 'basecode') {
        sloganElement.innerText = '"Basecode: Tu plataforma de eventos PRO"';
    }
};

const replacePlaceholders = () => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while (node = walker.nextNode()) {
        if (node.nodeValue.includes('{{PROTAGONISTA}}')) {
            node.nodeValue = node.nodeValue.replace(/{{PROTAGONISTA}}/g, config.protagonista.nombre);
        }
    }
};

const inicializarComponentes = () => {
    initAdmin(); // Inicializar panel de administración
    // if (window.loadAdminData) window.loadAdminData(); // MOVÍDO: Solo cargar al loguearse como admin
    if (window.loadGallery) window.loadGallery(); // Iniciar galería
    if (window.loadSettings) window.loadSettings(); // Iniciar configuración (IBAN/Bizum)
    if (document.querySelector('.review-item')) startReviewCarousel();
    applyAdminTextPatches();
    if (window.updateThemeIconState) window.updateThemeIconState();
};

/**
 * Aplica parches de texto específicos para el panel de administración.
 * Se puede llamar tanto en la carga inicial como en las actualizaciones de la vista previa.
 */
const applyAdminTextPatches = () => {
    // Cambia "Redes" por "Mis Redes y los Proveedores"
    const socialAccordionTrigger = document.querySelector('[onclick*="admin-social-section"]');
    if (socialAccordionTrigger) {
        const titleElement = socialAccordionTrigger.querySelector('h3, h4, span:not([id^="icon-"])');
        if (titleElement && titleElement.textContent.includes('Redes')) {
            titleElement.textContent = 'Mis Redes y los Proveedores';
        }
    }

    // Cambia "PERFILES SOCIALES" por "MIS PERFILES SOCIALES"
    const socialSectionContent = document.getElementById('admin-social-section');
    if (socialSectionContent) {
        const elements = socialSectionContent.querySelectorAll('h3, h4, h5, p, label, span');
        for (const el of elements) {
            if (el.textContent.trim().toUpperCase() === 'PERFILES SOCIALES') {
                el.textContent = 'MIS REDES SOCIALES';
                break;
            }
        }
    }
};
window.applyAdminTextPatches = applyAdminTextPatches; // Hacerla global para el script de index.html

const iniciarContador = () => {
    setInterval(() => {
        const target = new Date(config.evento.fecha).getTime();
        const now = new Date().getTime();
        const diff = target - now;
        if (diff > 0) {
            document.getElementById("days").innerText = Math.floor(diff / (1000 * 60 * 60 * 24)).toString().padStart(2, '0');
            document.getElementById("hours").innerText = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)).toString().padStart(2, '0');
            document.getElementById("minutes").innerText = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
        } else { /* Opcional: Mostrar "¡Es el día!" o similar cuando el contador llega a cero */ }
    }, 1000);
};

// --- LÓGICA DE INTRO Y MÚSICA ---
let isUnlocked = false;
let isPlaying = false;
let isAnimating = false;

async function toggleMusic() {
    const music = document.getElementById('bg-music');
    const heartbeat = document.getElementById('sfx-heartbeat');
    const btn = document.getElementById('music-toggle');
    const legalCheckbox = document.getElementById('legal-checkbox-inicio');

    if (isAnimating) return;

    // --- NUEVO: Verificar Aceptación Legal ---
    if (!isUnlocked && legalCheckbox && !legalCheckbox.checked) {
        window.showCustomAlert("Por favor, acepta la política de privacidad y los términos de uso para entrar.", "⚖️");

        // Destacar visualmente el checking
        const legalArea = document.getElementById('initial-legal-check');
        if (legalArea) {
            legalArea.classList.add('shake-anim');
            setTimeout(() => legalArea.classList.remove('shake-anim'), 500);
        }
        return;
    }

    if (!isUnlocked) {
        isAnimating = true;

        // Solución definitiva para audio en móvil:
        // Usamos 'await' para forzar a la aplicación a esperar a que el "desbloqueo"
        // del audio se complete ANTES de que cualquier otra animación intente usarlo.
        // Esto soluciona la "carrera" donde la animación empezaba antes de que el audio estuviera listo.
        const shutter = document.getElementById('sfx-shutter');
        const keySound = document.getElementById('sfx-key');
        const heartbeat = document.getElementById('sfx-heartbeat');
        try {
            if (shutter) {
                shutter.load(); // Asegurar que el audio está cargado antes del "desbloqueo"
                await shutter.play().catch(e => console.warn("Shutter pre-play blocked:", e));
                shutter.pause(); shutter.currentTime = 0;
            }
            if (keySound) {
                keySound.load(); // Asegurar que el audio está cargado antes del "desbloqueo"
                await keySound.play().catch(e => console.warn("KeySound pre-play blocked:", e));
                keySound.pause(); keySound.currentTime = 0;
            }
        } catch (error) {
            // Esto puede ocurrir si el navegador bloquea la reproducción automática sin interacción
            console.warn("No se pudo pre-calentar el audio, puede que no suene en móvil.", error);
        }

        // 2. Iniciar música de fondo en volumen 0
        if (music) {
            music.volume = 0;
            music.play().catch(e => console.log("Auto-play blocked", e));
        }

        // Asegurar que el latido suena durante la transición
        if (heartbeat) {
            heartbeat.volume = 1;
            heartbeat.play().catch(e => console.log("Heartbeat play blocked", e));
        }

        // 3. SECUENCIA DE CUENTA REGRESIVA Y AUDIO (Sincronizada más lenta)
        const countdownDisplay = document.getElementById('countdown-display');
        const musicDisplay = document.getElementById('music-display');
        const STEP_DURATION = 1500; // 1.5 segundos por número
        const duration = STEP_DURATION * 3; // 4.5 segundos total

        // Ocultar corazón y mostrar contenedor de cuenta
        if (musicDisplay) musicDisplay.classList.add('opacity-0');
        if (countdownDisplay) countdownDisplay.classList.remove('opacity-0', 'pointer-events-none');

        // Función para animar números
        const showNumber = (num) => {
            if (countdownDisplay) {
                countdownDisplay.innerText = num;
                countdownDisplay.classList.remove('pop-out');
                countdownDisplay.classList.remove('active');
                void countdownDisplay.offsetWidth; // Trigger reflow
                countdownDisplay.classList.add('active');

                if (navigator.vibrate) navigator.vibrate(50);

                setTimeout(() => {
                    countdownDisplay.classList.remove('active');
                    countdownDisplay.classList.add('pop-out');
                }, STEP_DURATION - 300);
            }
        };

        // Secuencia sincronizada
        // T=0: "3"
        showNumber("3");

        // Transición de Audio (Cross-fade)
        const intervalTime = 50;
        const steps = duration / intervalTime;
        let currentStep = 0;

        const fadeInterval = setInterval(() => {
            currentStep++;
            const progress = currentStep / steps;

            if (heartbeat) heartbeat.volume = Math.max(0, 1 - progress);
            if (music) music.volume = Math.min(1, progress);

            if (currentStep >= steps) {
                clearInterval(fadeInterval);
                if (heartbeat) {
                    heartbeat.pause();
                    heartbeat.currentTime = 0;
                }
            }
        }, intervalTime);

        // T=1.5s: "2"
        setTimeout(() => showNumber("2"), STEP_DURATION);

        // T=3.0s: "1"
        setTimeout(() => showNumber("1"), STEP_DURATION * 2);

        // T=4.5s: DESBLOQUEO
        await new Promise(resolve => setTimeout(resolve, duration));

        // Limpiar cuenta
        if (countdownDisplay) countdownDisplay.innerText = "";

        // 5. Finalización: Revelar la aplicación
        if (btn) btn.classList.remove('animate-heartbeat');
        document.body.classList.remove('locked');
        document.body.classList.add('unlocked');

        // Transformar botón a reproductor activo
        if (btn) {
            btn.classList.add('music-btn-active');
            btn.innerHTML = `<div class="vu-meter"><div class="vu-bar"></div><div class="vu-bar"></div><div class="vu-bar"></div><div class="vu-bar"></div><div class="vu-bar"></div></div>`;
        }

        // Mostrar navegación
        const modNav = document.getElementById('mod-nav');
        if (modNav) modNav.style.display = 'block';

        isUnlocked = true;
        isPlaying = true;
        isAnimating = false;

        // Guardar aceptación legal
        localStorage.setItem('legal_accepted', 'true');

        // Ocultar checking legal con suavidad
        const legalArea = document.getElementById('initial-legal-check');
        if (legalArea) legalArea.style.opacity = '0';

        // Iniciar carruseles internos si es necesario
        if (typeof startIntroPhotoCarousel === 'function') startIntroPhotoCarousel();

    } else {
        // Lógica de toggle normal (Pausa/Play)
        if (music.paused) {
            music.play().catch(e => console.log("Play blocked on resume", e));
            isPlaying = true;
            if (btn) btn.innerHTML = `<div class="vu-meter"><div class="vu-bar"></div><div class="vu-bar"></div><div class="vu-bar"></div><div class="vu-bar"></div><div class="vu-bar"></div></div>`;
        } else {
            music.pause();
            isPlaying = false;
            if (btn) btn.innerHTML = `<div class="pause-symbol"></div>`;
        }
    }
}
window.toggleMusic = toggleMusic; // Hacerla accesible globalmente

// --- FUNCIÓN DE MUTE/UNMUTE ---
let isMuted = false;

window.toggleMute = function () {
    const music = document.getElementById('bg-music');
    const heartbeat = document.getElementById('sfx-heartbeat');
    const muteIcon = document.getElementById('mute-icon-display');
    const muteBtn = document.getElementById('mute-toggle');

    isMuted = !isMuted;

    if (isMuted) {
        // Silenciar todos los audios
        if (music) music.volume = 0;
        if (heartbeat) heartbeat.volume = 0;
        if (muteIcon) muteIcon.textContent = '🔇';
        if (muteBtn) muteBtn.style.opacity = '0.5';
    } else {
        // Restaurar volumen
        if (music && isPlaying) music.volume = 1;
        if (heartbeat) heartbeat.volume = 1;
        if (muteIcon) muteIcon.textContent = '🔊';
        if (muteBtn) muteBtn.style.opacity = '1';
    }
};

// --- INICIO DE LA APP ---
document.addEventListener('DOMContentLoaded', () => {
    // LLAMADA 1: Rellenar inmediatamente lo que ya está en index.html
    populateStaticData();
    // Iniciar el contador de tiempo si el elemento existe
    if (document.getElementById('days')) {
        iniciarContador();
    }
    // Cargar el resto de módulos HTML dinámicos
    cargarModulos();

    const heartbeat = document.getElementById('sfx-heartbeat');
    if (heartbeat) {
        heartbeat.volume = 1;
        heartbeat.play().catch(e => console.warn("Autoplay de latido bloqueado (esperando interacción)", e));
    }

    // Detener música al salir de la app (cambiar de pestaña o minimizar)
    document.addEventListener('visibilitychange', () => {
        const music = document.getElementById('bg-music');
        const btn = document.getElementById('music-toggle');
        if (document.hidden && isPlaying) {
            music.pause();
            isPlaying = false;
            if (btn) {
                btn.innerHTML = `<div class="pause-symbol"></div>`;
            }
        }
    });
});

// Listener para el textarea de comentarios del lightbox para que crezca dinámicamente
document.addEventListener('DOMContentLoaded', () => {
    const commentInput = document.getElementById('lightbox-comment-input');
    if (commentInput) {
        commentInput.addEventListener('input', (event) => {
            const textarea = event.target;
            textarea.style.height = 'auto';
            textarea.style.height = (textarea.scrollHeight) + 'px';
        });
    }
});

window.addEventListener('hashchange', handleNavigation);

function handleNavigation() {
    // MODO SCROLL: No ocultamos nada.
    // Solo aseguramos que la barra de navegación se muestre si ya pasamos la intro.
    const modNav = document.getElementById('mod-nav');
    if (modNav && window.isUnlocked) {
        modNav.style.display = 'block';
    }
}

// --- FUNCIONES GLOBALES (Portadas de index copia 3) ---
// Variables globales de estado
let currentPin = "";
let currentSystemPin = "1111"; // Se actualizará desde Firebase si existe
let isAdminMode = false;
let adminListener = null; // Para controlar que no se duplique la escucha de datos
let galleryListener = null;
let galleryCurrentIndex = 0;
let galleryTotalPages = 0;
let allGuestsData = []; // Variable global para almacenar datos de invitados para reportes
let giftSettingsData = {
    iban: "",
    bizumPhone: "",
    beneficiary: "",
    bankName: "",
    menuVisible: true,
    attendanceVisible: true,
    menuPrice: 0,
    menuChildPrice: 0,
    menuPaymentVisible: false
};
let menuSettingsData = { enabled: true };
let currentPhotoIdForComment = null;
let giftAutoCloseTimeout;

// --- LÓGICA RSVP (NUEVA) ---
let menuData = { Carne: 0, Pescado: 0, Vegetariano: 0, Vegano: 0, SinGluten: 0, Infantil: 0 };

window.changeGuestValue = (type, delta) => {
    const el = document.getElementById(`count-${type}`);
    if (el) {
        let current = parseInt(el.innerText);
        el.innerText = Math.max(0, current + delta);
    }
};

window.toggleMenuDropdown = () => {
    const dropdown = document.getElementById('menu-dropdown');
    const header = dropdown.parentElement.querySelector('.dropdown-header');
    if (dropdown && header) {
        dropdown.classList.toggle('open');
        header.classList.toggle('activo');
    }
};


window.changeMenuUnit = (key, delta) => {
    // 1. Control interactivo: No permitir sumar más menús que invitados
    if (delta > 0) {
        const adults = parseInt(document.getElementById('count-adults')?.innerText || 0);
        const kids = parseInt(document.getElementById('count-kids')?.innerText || 0);
        const totalGuests = adults + kids;
        const currentMenus = Object.values(menuData).reduce((a, b) => a + b, 0);
        if (currentMenus >= totalGuests) {
            alert(`⚠️ Ya has seleccionado menú para los ${totalGuests} invitados.`);
            return;
        }
    }
    menuData[key] = Math.max(0, menuData[key] + delta);
    const el = document.getElementById(`unit-${key}`);
    if (el) el.innerText = menuData[key];
    window.updateDropdownLabel();
};

window.updateDropdownLabel = () => {
    let total = Object.values(menuData).reduce((a, b) => a + b, 0);
    const label = document.getElementById('dropdown-label');
    if (label) {
        label.innerHTML = total > 0
            ? `🍽️ <i>${total} platos seleccionados</i>`
            : '🍽️ Elige tu menú';
    }
};

window.handleRSVP = async () => {
    const nameInput = document.getElementById('guest-names');
    const adultsCount = document.getElementById('count-adults');
    const kidsCount = document.getElementById('count-kids');
    const commentsInput = document.getElementById('guest-comments');
    const submitBtn = document.getElementById('submit-btn');

    const name = nameInput ? nameInput.value.trim() : '';
    const adults = adultsCount ? parseInt(adultsCount.innerText) : 0;
    const kids = kidsCount ? parseInt(kidsCount.innerText) : 0;
    const comments = commentsInput ? commentsInput.value.trim() : '';

    if (!name) {
        window.showCustomAlert("Por favor, introduce tu nombre.", "✍️");
        return;
    }

    const totalGuests = adults + kids;
    const totalMenus = Object.values(menuData).reduce((a, b) => a + b, 0);

    // Restricción: Validar coincidencia exacta (ni más ni menos) SI el menú está habilitado
    if (menuSettingsData.enabled && totalMenus !== totalGuests) {
        window.showCustomAlert(`Tienes ${totalGuests} invitados pero has seleccionado ${totalMenus} menús. Por favor, selecciona un menú por persona.`, "🍽️");
        return;
    }

    // Si el menú está deshabilitado, enviamos un objeto vacío o indicativo
    const finalMenuData = menuSettingsData.enabled ? menuData : { disabled: true };

    if (submitBtn) {
        submitBtn.innerText = "Enviando...";
        submitBtn.disabled = true;
    }

    try {
        const guestPayload = {
            nombres: name,
            adultos: adults,
            niños: kids,
            menu: finalMenuData,
            comentarios: comments,
            fecha: new Date().toISOString(),
            status: 'unread'
        };

        await addDoc(collection(db, 'eventos', EVENT_ID, 'invitados'), guestPayload);

        // --- ENVIAR NOTIFICACIÓN POR EMAIL (PHP) ---
        try {
            const emailPayload = {
                ...guestPayload,
                eventName: config.app.title || "Evento"
            };

            fetch('send_mail.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(emailPayload)
            })
                .then(res => {
                    if (res.ok) console.log("📧 Email enviado al servidor");
                    else console.warn("⚠️ Error enviando email:", res.status);
                })
                .catch(err => console.warn("⚠️ No se pudo contactar con send_mail.php:", err));
        } catch (e) {
            console.error("Error preparando email:", e);
        }

        // Enviar notificación por WhatsApp al admin.
        // Esto lo hace el propio invitado al confirmar. La función se asegura
        // de que solo se envíe si el admin ha activado las notificaciones.
        sendWhatsAppNotification(guestPayload);

        const rsvpCard = document.querySelector('.card-rsvp');
        if (rsvpCard) {
            const rsvpHeader = document.getElementById('rsvp-header');
            const rsvpFormContent = document.getElementById('rsvp-form-content');

            if (rsvpHeader && rsvpFormContent) {
                // 1. Marcar como confirmado
                rsvpCard.classList.add('is-confirmed');

                // 2. Cambiar el header para que sea un desplegable
                rsvpHeader.innerHTML = `
                    <span class="titulo">¡Confirmado! ✅</span>
                    <span class="flecha-confirmado">▼</span>
                `;
                rsvpHeader.onclick = () => {
                    rsvpFormContent.classList.toggle('open');
                    const flecha = rsvpHeader.querySelector('.flecha-confirmado');
                    if (flecha) {
                        flecha.style.transform = rsvpFormContent.classList.contains('open') ? 'rotate(180deg)' : 'rotate(0deg)';
                    }
                };

                // 3. Colapsar el formulario
                rsvpFormContent.classList.remove('open');
            }

            // Deshabilitar todos los controles del formulario para hacerlo de solo lectura
            const controls = rsvpCard.querySelectorAll('input, textarea, button');
            controls.forEach(control => {
                control.disabled = true;
            });

            // Re-estilizar el botón de envío para que parezca confirmado
            submitBtn.innerText = "Confirmado";

            const rect = submitBtn.getBoundingClientRect();
            // Coordenadas normalizadas (0 a 1)
            const x = (rect.left + rect.width / 2) / window.innerWidth;
            const y = (rect.top + rect.height / 2) / window.innerHeight;

            const duration = 3000; // 3 segundos
            const end = Date.now() + duration;

            (function frame() {
                confetti({
                    particleCount: 5,
                    angle: 60,
                    spread: 55,
                    origin: { x: x, y: y },
                    colors: ['#10b981', '#34d399', '#fbbf24'] // Colores a juego (verdes y dorado)
                });
                confetti({
                    particleCount: 5,
                    angle: 120,
                    spread: 55,
                    origin: { x: x, y: y },
                    colors: ['#10b981', '#34d399', '#fbbf24']
                });

                if (Date.now() < end) {
                    requestAnimationFrame(frame);
                }
            }());
            document.getElementById('asistencia').scrollIntoView({ behavior: 'smooth' }); // Desplazarse a la sección de asistencia
        }
        window.showCustomAlert("¡Gracias! Tu asistencia ha sido confirmada.", "✅");
    } catch (error) {
        console.error("Error al enviar:", error);
        alert("Hubo un error al guardar. Inténtalo de nuevo.");
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = "Confirmar Asistencia";
        }
    }
};

/**
 * Reinicia los contadores y campos del formulario RSVP a su estado inicial.
 * Se llama al hacer clic en el botón principal "Confirmar asistencia".
 */
window.resetRSVPForm = () => {
    // No reiniciar si el formulario ya ha sido confirmado y está colapsado.
    const rsvpCard = document.querySelector('.card-rsvp');
    if (rsvpCard && rsvpCard.classList.contains('is-confirmed')) {
        return;
    }

    // Reiniciar contadores de invitados en el DOM
    const adultsCount = document.getElementById('count-adults');
    if (adultsCount) adultsCount.innerText = '0';
    const kidsCount = document.getElementById('count-kids');
    if (kidsCount) kidsCount.innerText = '0';

    // Reiniciar objeto de datos del menú y sus contadores en el DOM
    menuData = { Carne: 0, Pescado: 0, Vegetariano: 0, Vegano: 0, SinGluten: 0, Infantil: 0 };
    Object.keys(menuData).forEach(key => {
        const el = document.getElementById(`unit-${key}`);
        if (el) el.innerText = '0';
    });
    window.updateDropdownLabel(); // Actualizar el texto del desplegable de menú

    // Limpiar campos de texto
    if (document.getElementById('guest-names')) document.getElementById('guest-names').value = '';
    if (document.getElementById('guest-comments')) document.getElementById('guest-comments').value = '';
};

// --- LÓGICA ADMIN (DASHBOARD) ---
window.showGuestDetailModal = () => { document.getElementById('guest-detail-modal').style.display = 'flex'; };
window.closeGuestDetailModal = () => { document.getElementById('guest-detail-modal').style.display = 'none'; };

/**
 * Rellena el modal con los datos del invitado y lo muestra.
 * @param {object} guestData - Los datos completos del invitado.
 */
function populateAndShowGuestModal(guestData) {
    const menuIcons = { Carne: '🥩', Pescado: '🐟', Vegetariano: '🥗', Vegano: '🌱', SinGluten: '🌾', Infantil: '🍟' };

    // Rellenar información básica
    document.getElementById('guest-detail-name').innerText = guestData.nombres || 'Invitado';
    document.getElementById('guest-detail-adults').innerText = guestData.adultos || 0;
    document.getElementById('guest-detail-kids').innerText = guestData.niños || 0;
    document.getElementById('guest-detail-total').innerText = (guestData.adultos || 0) + (guestData.niños || 0);

    // Rellenar menú
    const menuContainer = document.getElementById('guest-detail-menu');
    menuContainer.innerHTML = ''; // Limpiar contenido previo

    // Lógica robusta para filtrar "disabled", "enabled" y valores no numéricos
    let hasValidMenu = false;
    if (guestData.menu) {
        Object.entries(guestData.menu)
            .filter(([key, value]) => {
                // Filtrar claves de sistema y asegurar que sea un número > 0
                return key !== 'disabled' && key !== 'enabled' && (parseInt(value) || 0) > 0;
            })
            .forEach(([key, value]) => {
                hasValidMenu = true;
                menuContainer.innerHTML += `
                    <div class="menu-item flex items-center gap-2">
                        <span>${menuIcons[key] || '🍽️'}</span>
                        <span>${value} ${key}</span>
                    </div>
                `;
            });
    }

    const menuSection = document.getElementById('guest-detail-menu-container');
    if (menuSection) {
        // Mostrar sección solo si hay platos válidos Y (opcional) si la config global lo permite.
        // Pero priorizamos mostrar la data si existe.
        menuSection.style.display = hasValidMenu ? 'block' : 'none';
    }

    // Rellenar observaciones
    const commentsContainer = document.getElementById('guest-detail-comments-container');
    const commentsEl = document.getElementById('guest-detail-comments');
    if (guestData.comentarios) {
        commentsEl.innerText = guestData.comentarios;
        commentsContainer.style.display = 'block';
    } else {
        commentsContainer.style.display = 'none';
    }

    // Mostrar el modal
    window.showGuestDetailModal();
}

/**
 * Gestiona el clic en una tarjeta de invitado.
 * Si está en modo borrado, selecciona/deselecciona.
 * Si no, abre una ventana emergente con los detalles.
 */
window.handleGuestClick = (guestId, element, guestData) => {
    if (isGuestDeleteMode) {
        element.classList.toggle('selected');
        if (guestsToDelete.includes(guestId)) {
            guestsToDelete = guestsToDelete.filter(id => id !== guestId);
        } else {
            guestsToDelete.push(guestId);
        }
    } else {
        // Al abrir el detalle, marcamos como leído individualmente
        if (guestData.status === 'unread') {
            window.markGuestAsRead(guestId);
        }
        populateAndShowGuestModal(guestData);
    }
};

/**
 * Prepara y abre una ventana de WhatsApp con los detalles de un nuevo invitado.
 * Esta función se dispara cuando el admin tiene la app abierta y un nuevo invitado confirma.
 * @param {object} guestData - Los datos del invitado que acaba de confirmar.
 */
const sendWhatsAppNotification = (guestData) => {
    // Solo enviar si las notificaciones están activas y hay un número
    if (!giftSettingsData.notificationsVisible || !giftSettingsData.notificationPhone) {
        // Salir silenciosamente si las notificaciones no están configuradas.
        // Esto evita mostrar alertas al invitado que está confirmando.
        console.warn("Notificación de WhatsApp no enviada: función desactivada o número no configurado.");
        return;
    }

    const notificationPhone = giftSettingsData.notificationPhone;
    let message = `🎉 ¡Nuevo invitado para ${PROTAGONISTA}!\n\n`;
    message += `*Nombre:* ${guestData.nombres}\n`;
    message += `*Asistentes:* ${guestData.adultos || 0} Adultos, ${guestData.niños || 0} Niños\n\n`;

    if (guestData.menu && Object.values(guestData.menu).some(v => v > 0)) {
        const menuItems = Object.entries(guestData.menu)
            .filter(([, value]) => value > 0)
            .map(([key, value]) => `- ${value} x ${key}`)
            .join('\n');

        if (menuItems) {
            message += `*Menú solicitado:*\n${menuItems}\n\n`;
        }
    }

    if (guestData.comentarios) {
        message += `*Observaciones:*\n${guestData.comentarios}\n`;
    }

    message += `\n---\n_Mensaje automático de la App de Comunión._`;

    const encodedMessage = encodeURIComponent(message);
    const phoneNumber = notificationPhone.replace(/[^0-9]/g, '');
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

    window.open(whatsappUrl, '_blank').focus();
};

// --- LÓGICA DE MÚSICA PERSONALIZADA (ADMIN) ---

let selectedMusicFile = null;

window.handleMusicSelection = (input) => {
    const file = input.files[0];
    if (!file) return;

    if (!file.type.includes('mpeg')) {
        window.showCustomAlert("Por favor, selecciona un archivo MP3 válido.", "❌");
        input.value = "";
        return;
    }

    selectedMusicFile = file;
    document.getElementById('music-upload-status').innerText = `🎵 ${file.name}`;
    const btn = document.getElementById('btn-save-music');
    if (btn) {
        btn.disabled = false;
        btn.classList.remove('opacity-50');
    }
};

window.uploadCustomMusic = async () => {
    if (!selectedMusicFile) return;

    const btn = document.getElementById('btn-save-music');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = "⏳ Subiendo...";
    }

    try {
        const musicRef = ref(storage, `eventos/${EVENT_ID}/musica_fondo.mp3`);
        await uploadBytes(musicRef, selectedMusicFile);
        const downloadUrl = await getDownloadURL(musicRef);

        // Guardar la URL en el registro del evento
        await setDoc(doc(db, "eventos", EVENT_ID), {
            audio: { fondo: downloadUrl }
        }, { merge: true });

        window.showCustomAlert("Música de fondo actualizada. Se aplicará al reiniciar la App.", "✅");

        // Actualizar reproductor local si es necesario
        const musicPlayer = document.getElementById('bg-music-src');
        if (musicPlayer) {
            musicPlayer.src = downloadUrl;
            document.getElementById('bg-music').load();
        }

    } catch (error) {
        console.error("Error al subir música:", error);
        window.showCustomAlert("Error al subir el archivo de música.", "❌");
    } finally {
        if (btn) {
            btn.innerHTML = "💾 Guardar Música";
            btn.disabled = false;
        }
    }
};

// --- LÓGICA DE QR DE LA APP (ADMIN) ---

window.generateAdminQR = () => {
    const qrContainer = document.getElementById('admin-qr-display');
    if (!qrContainer) return;

    const appUrl = `${window.location.origin}${window.location.pathname}?id=${EVENT_ID}`;
    qrContainer.innerHTML = "";
    new QRCode(qrContainer, {
        text: appUrl,
        width: 180,
        height: 180,
        colorDark: "#064e3b",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });
};

window.downloadAppQR = () => {
    const qrImg = document.querySelector('#admin-qr-display img');
    if (!qrImg) {
        window.showCustomAlert("Primero genera el código QR.", "⚠️");
        return;
    }

    const link = document.createElement('a');
    link.href = qrImg.src;
    link.download = `QR_Invitacion_${EVENT_ID}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.resetDefaultMusic = async () => {
    if (!confirm("¿Seguro que quieres eliminar la música personalizada y volver a la música por defecto?")) return;

    try {
        // Eliminar el campo audio.fondo de Firestore (pero manteniendo el resto del documento)
        const eventRef = doc(db, "eventos", EVENT_ID);
        await setDoc(eventRef, {
            audio: { fondo: deleteField() }
        }, { merge: true });

        window.showCustomAlert("Música restablecida. Se aplicará al reiniciar la App.", "✅");

        // Restaurar localmente
        const defaultAudio = 'assets/audio/inspire-375980.mp3';
        const musicPlayer = document.getElementById('bg-music-src');
        if (musicPlayer) {
            musicPlayer.src = defaultAudio;
            document.getElementById('bg-music').load();
        }
    } catch (error) {
        console.error("Error al resetear música:", error);
        window.showCustomAlert("Error al restablecer la música.", "❌");
    }
};

window.loadAdminData = () => {
    // Si ya estamos escuchando, no duplicamos
    if (adminListener) return;

    console.log("Iniciando listener de Admin Data...");
    // Escuchar cambios en la colección de invitados en tiempo real
    adminListener = onSnapshot(collection(db, 'eventos', EVENT_ID, 'invitados'), (snap) => {
        console.log("Datos recibidos de Firebase:", snap.size);

        // La lógica de notificación de nuevo invitado se ha movido a la función handleRSVP,
        // para que sea el propio invitado quien la envíe al confirmar.

        const list = document.getElementById('admin-list');
        const summary = document.getElementById('admin-summary');
        const mSum = document.getElementById('meal-summary');

        // Si no estamos en la pantalla de admin (o no se ha cargado el módulo), salimos
        if (!list || !summary || !mSum) {
            console.warn("⚠️ Elementos del panel de admin no encontrados en el DOM. Asegúrate de abrir el panel.");
            return;
        }

        // Generar QR si no existe todavía
        window.generateAdminQR();



        if (snap.empty) {
            list.innerHTML = "<p class='text-white/50 italic py-4'>No hay invitados registrados aún.</p>";
            // No retornamos para que los contadores se pongan a 0
        } else {
            list.innerHTML = "";
        }
        allGuestsData = []; // Limpiar array antes de repoblar
        let tA = 0, tN = 0, newCount = 0;
        let meals = { Carne: 0, Pescado: 0, Vegetariano: 0, Vegano: 0, SinGluten: 0, Infantil: 0 };

        snap.forEach(d => {
            const data = d.data();
            if (!data) return;

            tA += (parseInt(data.adultos) || 0);
            tN += (parseInt(data.niños) || 0);

            if (data.status === 'unread') newCount++;

            if (data.menu) {
                for (let k in data.menu) {
                    if (meals[k] !== undefined && data.menu[k]) {
                        meals[k] += (parseInt(data.menu[k]) || 0);
                    }
                }
            }

            // Guardar en variable global para reportes
            allGuestsData.push(data);

            // Renderizar elemento de la lista
            // Renderizar elemento de la lista
            // Renderizar elemento de la lista
            const div = document.createElement('div');
            div.className = "guest-item bg-white/5 p-4 rounded-xl mb-2 flex flex-wrap justify-between items-start border border-white/10";
            div.onclick = () => window.handleGuestClick(d.id, div, data);

            const menuIcons = { Carne: '🥩', Pescado: '🐟', Vegetariano: '🥗', Vegano: '🌱', SinGluten: '🌾', Infantil: '🍟' };

            let menuString = '';
            if (data.menu) {
                menuString = Object.entries(data.menu)
                    .filter(([key, value]) => key !== 'disabled' && key !== 'enabled' && (parseInt(value) || 0) > 0)
                    .map(([key, value]) => `<span>${menuIcons[key] || '🍽️'} ${value} ${key}</span>`)
                    .join('');
            }

            // LIMPIEZA TOTAL: Solo nombre y datos, SIN X ni iconos extra
            const topContent = `
                <div class="flex justify-between items-start w-full">
                    <div class="text-left">
                        <div class="font-bold text-white text-base">${data.nombres}</div>
                        <div class="text-xs text-[#CDB67E] font-semibold mt-1">${data.adultos} Adultos / ${data.niños} Niños</div>
                    </div>
                    <div class="text-right text-xs text-[#CDB67E] font-semibold flex flex-col items-end gap-1">
                        ${menuString}
                    </div>
                </div>
            `;

            const bottomContent = data.comentarios ? `<div class="mt-2 pt-2 border-t border-white/10 w-full text-xs italic text-slate-300 text-left">Comentario: ${data.comentarios}</div>` : '';

            div.innerHTML = topContent + bottomContent;
            if (data.status === 'unread') {
                div.classList.add('new-guest-highlight');
                div.style.borderLeft = '4px solid #10b981';
                div.style.background = 'rgba(16, 185, 129, 0.1)';
            }
            list.appendChild(div);
        });

        // Actualizar Badge de Notificación en Admin (CIRCULITO ROJO)
        const badge = document.getElementById('new-guests-badge');
        if (badge) {
            if (newCount > 0) {
                badge.innerText = newCount;
                badge.style.display = 'flex';
                badge.style.background = '#ef4444'; // Rojo vibrante
            } else {
                badge.style.display = 'none';
            }
        }

        // Renderizar Resumen General
        summary.innerHTML = `
            <div class="flex flex-col items-center">
                <span class="text-4xl font-bold text-white">${tA}</span>
                <span class="text-[10px] uppercase font-bold text-[#CDB67E]">Adultos</span>
            </div>
            <div class="flex flex-col items-center">
                <span class="text-4xl font-bold text-white">${tN}</span>
                <span class="text-[10px] uppercase font-bold text-[#CDB67E]">Niños</span>
            </div>
            <div class="flex flex-col items-center">
                <span class="text-4xl font-bold text-white">${tA + tN}</span>
                <span class="text-[10px] uppercase font-bold text-[#CDB67E]">Total</span>
            </div>
        `;

        // Renderizar Resumen de Menús
        mSum.innerHTML = "";
        const icons = { Carne: '🥩', Pescado: '🐟', Vegetariano: '🥗', Vegano: '🌱', SinGluten: '🌾', Infantil: '🍟' };
        for (let k in meals) {
            if (meals[k] > 0) { // Solo mostrar si hay pedidos
                mSum.innerHTML += `
                    <div class="bg-white/5 p-3 rounded-xl border border-white/10 flex flex-col items-center">
                        <span class="text-xl font-bold text-white">${meals[k]}</span>
                        <span class="text-[10px] uppercase text-[#CDB67E]">${icons[k]} ${k}</span>
                    </div>
                `;
            }
        }
    }, (error) => {
        console.error("Error escuchando datos de admin:", error);
        alert("Error de conexión con la base de datos. Revisa la consola.");
    });
};

/**
 * Marca un invitado específico como leído al abrir su detalle.
 */
window.markGuestAsRead = async (guestId) => {
    try {
        await setDoc(doc(db, 'eventos', EVENT_ID, 'invitados', guestId), { status: 'read' }, { merge: true });
        console.log(`Invitado ${guestId} marcado como leído.`);
    } catch (error) {
        console.error("Error al marcar invitado como leído:", error);
    }
};

window.markAllGuestsAsRead = async () => {
    try {
        const unreadGuests = allGuestsData.filter(g => g.status === 'unread');
        if (unreadGuests.length === 0) {
            window.showCustomAlert("No hay notificaciones nuevas.", "💡");
            return;
        }

        window.showCustomAlert("Marcando como leídos...", "⏳");
        const qSnap = await getDocs(collection(db, 'eventos', EVENT_ID, 'invitados'));
        const promises = [];
        qSnap.forEach(s => {
            if (s.data().status === 'unread') {
                promises.push(setDoc(doc(db, 'eventos', EVENT_ID, 'invitados', s.id), { status: 'read' }, { merge: true }));
            }
        });
        await Promise.all(promises);
        window.showCustomAlert("¡Todo al día!", "✅");
    } catch (error) {
        console.error("Error al marcar como leídos:", error);
    }
};

// --- LÓGICA FICHAS DE CLIENTE (Submissions) ---

/**
 * Genera un HTML con tarjetas de invitados y lo abre en una nueva pestaña para imprimir o guardar.
 */
window.downloadGuestCards = async () => {
    window.showCustomAlert("Generando tarjetas...", "🖨️");

    const guestSnapshot = await getDocs(collection(db, 'eventos', EVENT_ID, 'invitados'));

    if (guestSnapshot.empty) {
        window.showCustomAlert("No hay invitados para mostrar.", "🤷");
        return;
    }

    // 1. Recopilar todos los datos y calcular totales primero
    const guests = [];
    guestSnapshot.forEach(doc => guests.push(doc.data()));

    // Ordenar por fecha de registro (más recientes primero)
    guests.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    const totalAdults = guests.reduce((sum, guest) => sum + (guest.adultos || 0), 0);
    const totalKids = guests.reduce((sum, guest) => sum + (guest.niños || 0), 0);
    const totalGuestsOverall = totalAdults + totalKids;

    let html = `
        <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Tarjetas de Invitados - ${PROTAGONISTA}</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 1rem; background-color: #f0f0f0; }
            .card { background: white; border: 1px solid #ddd; border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1); page-break-inside: avoid; }
            h1 { text-align: center; color: #333; margin-bottom: 0.5rem; font-size: 2rem; }
            .subtitle { text-align: center; font-size: 1.2rem; color: #555; margin-bottom: 2rem; text-decoration: underline; text-underline-offset: 4px; }
            h2 { font-size: 1.6rem; margin: 0 0 1rem 0; color: #064e3b; border-bottom: 2px solid #064e3b; padding-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center; }
            .date { font-size: 0.8rem; color: #888; font-weight: normal; }
            .summary { display: flex; gap: 1.5rem; margin-bottom: 1.5rem; border-bottom: 1px solid #eee; padding-bottom: 1.5rem; }
            .summary-item { text-align: center; flex-grow: 1; }
            .summary-item .value { font-size: 2.2rem; font-weight: bold; color: #333; }
            .summary-item .label { font-size: 0.8rem; text-transform: uppercase; color: #666; }
            .details-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 0.75rem 1rem; margin-bottom: 1rem; }
            .detail-item .label { font-weight: bold; color: #555; }
            .detail-item .value { color: #333; }
            .comments { margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed #ccc; }
            .comments-title { font-weight: bold; font-size: 1.1rem; margin-bottom: 0.5rem; }
            .comments-text { white-space: pre-wrap; font-style: italic; color: #444; background: #fafafa; padding: 0.5rem; border-radius: 6px; }
            @media print { body { background-color: white; padding: 0; } .card { box-shadow: none; border: 1px solid #ccc; } h1 { margin-top: 1rem; } }
        </style>
        </head><body><h1>Comunión de ${PROTAGONISTA}</h1><p class="subtitle">Lista de Invitados</p>
    `;

    // 2. Añadir la tarjeta de resumen total
    html += `
        <div class="card">
            <h2>Resumen General</h2>
            <div class="summary">
                <div class="summary-item"><div class="value">${totalGuestsOverall}</div><div class="label">Total Invitados</div></div>
                <div class="summary-item"><div class="value">${totalAdults}</div><div class="label">Total Adultos</div></div>
                <div class="summary-item"><div class="value">${totalKids}</div><div class="label">Total Niños</div></div>
            </div>
        </div>
    `;

    // 3. Iterar sobre los invitados para crear sus tarjetas individuales
    guests.forEach(data => {
        const totalGuests = (data.adultos || 0) + (data.niños || 0);
        const formattedDate = data.fecha ? new Date(data.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

        let menuHtml = '';
        if (data.menu && Object.values(data.menu).some(v => v > 0)) {
            menuHtml = Object.entries(data.menu)
                .filter(([, value]) => value > 0)
                .map(([key, value]) => `<div class="detail-item"><span class="label">${key}:</span> <span class="value">${value}</span></div>`)
                .join('');
        } else {
            menuHtml = '<div class="detail-item"><span class="label">Menú:</span> <span class="value">No especificado</span></div>';
        }

        html += `
            <div class="card">
                <h2><span>${data.nombres}</span><span class="date">${formattedDate}</span></h2>
                <div class="summary">
                    <div class="summary-item"><div class="value">${totalGuests}</div><div class="label">Total</div></div>
                    <div class="summary-item"><div class="value">${data.adultos || 0}</div><div class="label">Adultos</div></div>
                    <div class="summary-item"><div class="value">${data.niños || 0}</div><div class="label">Niños</div></div>
                </div>
                <div class="details-grid">${menuHtml}</div>
                ${data.comentarios ? `
                <div class="comments">
                    <div class="comments-title">Comentarios:</div>
                    <p class="comments-text">${data.comentarios}</p>
                </div>` : ''}
            </div>
        `;
    });

    html += `</body></html>`;

    const newWindow = window.open("", "_blank");
    newWindow.document.write(html);
    newWindow.document.close();
    window.closeCustomAlert();
};

/**
 * Genera un archivo CSV con los datos de los invitados y lo descarga.
 */
window.downloadGuestsAsCSV = async () => {
    window.showCustomAlert("Generando CSV...", "📊");

    const guestSnapshot = await getDocs(collection(db, 'eventos', EVENT_ID, 'invitados'));

    if (guestSnapshot.empty) {
        window.showCustomAlert("No hay invitados para exportar.", "🤷");
        return;
    }

    const headers = [
        "Nombre", "Adultos", "Niños", "Total",
        "Menu Carne", "Menu Pescado", "Menu Vegetariano", "Menu Vegano", "Menu Sin Gluten", "Menu Infantil",
        "Comentarios", "Fecha Registro"
    ];

    const guests = [];
    guestSnapshot.forEach(doc => guests.push(doc.data()));
    guests.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    const csvRows = guests.map(data => {
        const totalGuests = (data.adultos || 0) + (data.niños || 0);
        const formattedDate = data.fecha ? new Date(data.fecha).toLocaleString('es-ES') : '';

        // Función para escapar comillas en los campos de texto
        const escape = (str) => `"${(str || '').replace(/"/g, '""')}"`;

        return [
            escape(data.nombres),
            data.adultos || 0,
            data.niños || 0,
            totalGuests,
            data.menu?.Carne || 0,
            data.menu?.Pescado || 0,
            data.menu?.Vegetariano || 0,
            data.menu?.Vegano || 0,
            data.menu?.SinGluten || 0,
            data.menu?.Infantil || 0,
            escape(data.comentarios),
            formattedDate
        ].join(',');
    });

    const csvString = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' }); // \uFEFF es el BOM para que Excel abra bien los acentos

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `invitados_${PROTAGONISTA.toLowerCase().replace(/\s/g, '_')}.csv`;
    link.click();
    window.closeCustomAlert();
};

// --- LÓGICA GALERÍA Y FOTOS ---

// Funciones para el nuevo carrusel
window.moveSlide = (dir) => {
    const track = document.getElementById('slider-track');
    if (!track || galleryTotalPages <= 1) return;

    galleryCurrentIndex += dir;
    if (galleryCurrentIndex >= galleryTotalPages) galleryCurrentIndex = 0;
    if (galleryCurrentIndex < 0) galleryCurrentIndex = galleryTotalPages - 1;

    updateSliderPosition();
};

function updateSliderPosition() {
    const track = document.getElementById('slider-track');
    if (track) {
        track.style.transform = `translateX(-${galleryCurrentIndex * 100}%)`;
    }
}

function initGallerySlider() {
    const slider = document.getElementById('slider-container');
    const track = document.getElementById('slider-track');
    if (!slider || !track) return;

    let startX = 0;
    let isDragging = false;

    const touchStart = (event) => {
        startX = event.touches[0].clientX;
        isDragging = true;
        track.style.transition = 'none';
    };

    const touchMove = (event) => {
        if (!isDragging) return;
        const currentX = event.touches[0].clientX;
        const diff = currentX - startX;
        const translation = -galleryCurrentIndex * slider.offsetWidth + diff;
        track.style.transform = `translateX(${translation}px)`;
    };

    const touchEnd = (event) => {
        if (!isDragging) return;
        isDragging = false;
        const endX = event.changedTouches[0].clientX;
        const diff = startX - endX;

        track.style.transition = 'transform 0.5s cubic-bezier(0.2, 0, 0.2, 1)';

        if (Math.abs(diff) > 70) { // Umbral para cambiar de página
            if (diff > 0) window.moveSlide(1);
            else window.moveSlide(-1);
        } else {
            updateSliderPosition(); // Reajustar si el gesto fue corto
        }
    };

    // Limpiar listeners antiguos para evitar duplicados en recargas
    slider.removeEventListener('touchstart', touchStart);
    slider.removeEventListener('touchmove', touchMove);
    slider.removeEventListener('touchend', touchEnd);

    slider.addEventListener('touchstart', touchStart);
    slider.addEventListener('touchmove', touchMove);
    slider.addEventListener('touchend', touchEnd);
}

window.loadGallery = () => {
    if (galleryListenerUnsubscribe) return; // Evitar duplicar listeners si ya hay uno activo
    if (!EVENT_ID) {
        console.error("❌ EVENT_ID no definido, no se puede cargar la galería.");
        return;
    }

    galleryListenerUnsubscribe = onSnapshot(collection(db, 'eventos', EVENT_ID, 'recuerdos'), (snap) => {
        const track = document.getElementById('slider-track');
        const wrapper = document.querySelector('.gallery-wrapper');

        if (!track || !wrapper) return;

        track.innerHTML = "";

        // Asegurarse de que el botón de modo borrado tenga el texto correcto al cargar la galería
        if (isAdminMode) {
            updateAdminModeButtonText();
        }

        // Obtener el botón de eliminar para actualizar su estado
        const deleteSelectedBtn = document.getElementById('delete-selected-photos-btn');
        if (deleteSelectedBtn && isAdminMode) {
            deleteSelectedBtn.disabled = photosToDelete.length === 0;
            deleteSelectedBtn.classList.toggle('opacity-50', photosToDelete.length === 0);
        }
        let photos = [];
        snap.forEach(f => photos.push({ id: f.id, ...f.data() }));

        // Paginación de 9 en 9
        const pageSize = 9;
        galleryTotalPages = Math.ceil(photos.length / pageSize);

        if (photos.length === 0) {
            track.innerHTML = "<p class='text-center text-gray-800 p-8 w-full'>Aún no hay fotos. ¡Sé el primero en subir una!</p>";
            wrapper.querySelectorAll('.btn-nav').forEach(btn => btn.style.display = 'none');
            return;
        }

        // Mostrar/ocultar botones de navegación
        wrapper.querySelectorAll('.btn-nav').forEach(btn => {
            btn.style.display = galleryTotalPages > 1 ? 'flex' : 'none';
        });

        for (let i = 0; i < photos.length; i += pageSize) {
            const pagePhotos = photos.slice(i, i + pageSize);
            const pageDiv = document.createElement('div');
            pageDiv.className = "slide-page";

            pagePhotos.forEach(p => {
                const imgContainer = document.createElement('div');
                imgContainer.className = "img-container";
                imgContainer.dataset.photoId = p.id; // Guardar ID para refreshGalleryHandlers

                const img = document.createElement('img');
                img.src = p.url;
                img.className = "img-item";
                img.alt = "Recuerdo de la comunión";

                imgContainer.appendChild(img);

                if (isAdminMode) {
                    // MODO ADMIN: Clic simple para seleccionar, doble clic para hacer zoom.
                    imgContainer.onclick = () => window.togglePhotoSelection(imgContainer, p.id);
                    imgContainer.ondblclick = () => window.zoomPhoto(p.url, p.id);
                } else {
                    // MODO NORMAL: Clic simple para hacer zoom.
                    imgContainer.onclick = () => window.zoomPhoto(p.url, p.id);
                }

                // Si la foto tiene un comentario, crear y añadir el indicador
                // Se usa appendChild para no sobreescribir los eventos (onclick) de la imagen
                let photoComments = [];
                if (Array.isArray(p.comments)) {
                    photoComments = p.comments;
                } else if (typeof p.comment === 'string' && p.comment) {
                    photoComments = [p.comment]; // Tratar comentario antiguo como un array
                }

                if (photoComments.length > 0) {
                    const commentDiv = document.createElement('div');
                    commentDiv.className = 'comment-indicator';
                    // El bocadillo mostrará todos los comentarios separados por una línea
                    const commentsHtml = photoComments.map(c => `<div>- ${c}</div>`).join('<hr class="my-1 border-white/20">');
                    commentDiv.innerHTML = `💬<div class="comment-bubble">${commentsHtml}</div>`;
                    imgContainer.appendChild(commentDiv);
                }

                if (isAdminMode) {
                    if (photosToDelete.includes(p.id)) {
                        imgContainer.classList.add('selected');
                    }
                    imgContainer.style.cursor = 'pointer';
                }
                pageDiv.appendChild(imgContainer);
            });

            // Rellenar celdas vacías para mantener la cuadrícula 3x3
            const remaining = pageSize - pagePhotos.length;
            for (let j = 0; j < remaining; j++) {
                pageDiv.appendChild(document.createElement('div'));
            }
            track.appendChild(pageDiv);
        }

        if (galleryCurrentIndex >= galleryTotalPages) galleryCurrentIndex = Math.max(0, galleryTotalPages - 1);
        updateSliderPosition();
        initGallerySlider();
    });
};

window.uploadPhoto = async (input) => {
    const files = input.files;
    if (!files.length) return;

    const commentInput = document.getElementById('photo-comment');
    const comment = commentInput ? commentInput.value.trim() : "";

    // Feedback visual en el botón en lugar de un alert
    const uploadButton = document.querySelector('label[for="photo-upload"]');
    const originalButtonText = uploadButton ? uploadButton.innerHTML : '';
    if (uploadButton) {
        uploadButton.innerHTML = `<span>⏳ Subiendo...</span>`;
        uploadButton.style.pointerEvents = 'none'; // Deshabilitar durante la subida
    }

    const uploadPromises = Array.from(files).map(file => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = ev => {
                const img = new Image();
                img.src = ev.target.result;
                img.onload = async () => {
                    try {
                        const canvas = document.createElement('canvas');
                        const MAX = 1024;
                        let w = img.width, h = img.height;
                        if (w > MAX || h > MAX) {
                            if (w > h) { h *= MAX / w; w = MAX; }
                            else { w *= MAX / h; h = MAX; }
                        }
                        canvas.width = w; canvas.height = h;
                        canvas.getContext('2d').drawImage(img, 0, 0, w, h);

                        // Se guarda la imagen como texto (base64) directamente en la base de datos.
                        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

                        await addDoc(collection(db, 'eventos', EVENT_ID, 'recuerdos'), {
                            url: dataUrl,
                            fecha: new Date().toISOString(),
                            comment: comment
                        });
                        resolve();
                    } catch (error) {
                        console.error("Error al procesar una foto:", error);
                        reject(error);
                    }
                };
                img.onerror = () => {
                    console.error("El archivo no es una imagen válida:", file.name);
                    reject(new Error("Archivo no es una imagen válida."));
                };
            };
            reader.onerror = error => {
                console.error("Error al leer el archivo:", error);
                reject(error);
            };
        });
    });

    try {
        await Promise.all(uploadPromises);
        if (commentInput) commentInput.value = "";
        input.value = "";
        // No se muestra alerta de éxito para una experiencia más fluida.
    } catch (error) {
        console.error("Error durante la subida de una o más fotos:", error);
        window.showCustomAlert("Hubo un error al subir alguna de las fotos. Inténtalo de nuevo.", "❌");
    } finally {
        if (uploadButton) {
            uploadButton.innerHTML = originalButtonText;
            uploadButton.style.pointerEvents = 'auto';
        }
    }
};

window.downloadAllPhotos = async () => {
    window.showCustomAlert("Generando ZIP...", "📦");
    const snap = await getDocs(collection(db, 'eventos', EVENT_ID, 'recuerdos'));
    const zip = new JSZip();
    let count = 0;
    snap.forEach(d => {
        count++;
        const photoData = d.data();
        const photoUrl = photoData.url;

        let comments = [];
        if (Array.isArray(photoData.comments)) {
            comments = photoData.comments;
        } else if (typeof photoData.comment === 'string' && photoData.comment) {
            comments = [photoData.comment];
        }

        // Añadir foto al zip
        if (photoUrl) {
            zip.file(`foto_${count}.jpg`, photoUrl.split(',')[1], { base64: true });
        }

        // Añadir archivo de texto con comentarios si existen
        if (comments.length > 0) {
            const commentsText = `Comentarios para foto_${count}.jpg:\n\n` + comments.map((c, i) => `Comentario ${i + 1}:\n${c}`).join('\n\n---\n\n');
            zip.file(`foto_${count}_comentarios.txt`, commentsText);
        }
    });
    const content = await zip.generateAsync({ type: "blob" });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `fotos_${PROTAGONISTA.toLowerCase().replace(/\s/g, '_')}.zip`;
    link.click();
    window.closeCustomAlert();
};

// Navegación por teclado para la galería
document.addEventListener('keydown', (e) => {
    const isModalOpen = Array.from(document.querySelectorAll('.modal-overlay, #custom-alert-overlay'))
        .some(el => el.style.display === 'flex');
    if (isModalOpen) return;

    const gallerySection = document.getElementById('galeria');
    if (gallerySection) {
        const rect = gallerySection.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight && rect.bottom >= 0;

        if (isVisible) {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                window.moveSlide(-1);
            }
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                window.moveSlide(1);
            }
        }
    }
});

window.loadSettings = () => {
    onSnapshot(doc(db, 'eventos', EVENT_ID, 'settings', 'configuracion'), snap => {
        if (snap.exists()) {
            const c = snap.data();
            giftSettingsData = { ...giftSettingsData, ...c };

            // IBAN
            const adminIbanToggle = document.getElementById('admin-iban-toggle');
            if (adminIbanToggle) adminIbanToggle.classList.toggle('active', !!c.ibanVisible);
            const ibanContent = document.getElementById('iban-details-content');
            if (ibanContent) ibanContent.classList.toggle('hidden', !c.ibanVisible);

            // BIZUM
            const adminBizumToggle = document.getElementById('admin-bizum-toggle');
            if (adminBizumToggle) adminBizumToggle.classList.toggle('active', !!c.bizumVisible);
            const bizumContent = document.getElementById('bizum-details-content');
            if (bizumContent) bizumContent.classList.toggle('hidden', !c.bizumVisible);

            // LISTA REGALOS
            const adminGiftlistToggle = document.getElementById('admin-giftlist-toggle');
            if (adminGiftlistToggle) adminGiftlistToggle.classList.toggle('active', !!c.giftListVisible);
            const giftlistContent = document.getElementById('giftlist-details-content');
            if (giftlistContent) giftlistContent.classList.toggle('hidden', !c.giftListVisible);

            // PAGO MENÚ
            const adminMenuPaymentToggle = document.getElementById('admin-menupayment-toggle');
            if (adminMenuPaymentToggle) adminMenuPaymentToggle.classList.toggle('active', !!c.menuPaymentVisible);
            const menuPaymentContent = document.getElementById('menupayment-details-content');
            if (menuPaymentContent) menuPaymentContent.classList.toggle('hidden', !c.menuPaymentVisible);

            // Actualizar inputs del panel
            const sets = {
                'admin-gift-iban-input': c.iban || "",
                'admin-gift-bizum-input': c.bizumPhone || "",
                'admin-gift-list-url-input': c.giftListUrl || "",
                'admin-gift-beneficiary-input': c.beneficiary || "",
                'admin-gift-bank-name-input': c.bankName || "",
                'admin-notification-phone': c.notificationPhone || "",
                'admin-menupayment-price': c.menuPrice || 0,
                'admin-menupayment-child-price': c.menuChildPrice || 0
            };

            for (const [id, val] of Object.entries(sets)) {
                const el = document.getElementById(id);
                if (el) el.value = val;
            }

            const adminNotificationsToggle = document.getElementById('admin-notifications-toggle');
            if (adminNotificationsToggle) adminNotificationsToggle.classList.toggle('active', !!c.notificationsVisible);

            const adminMenuToggle = document.getElementById('admin-menu-toggle');
            const menuVisible = c.menuVisible !== undefined ? c.menuVisible : true;
            if (adminMenuToggle) adminMenuToggle.classList.toggle('active', menuVisible);

            const adminAttendanceToggle = document.getElementById('admin-attendance-toggle');
            const attendanceVisible = c.attendanceVisible !== undefined ? c.attendanceVisible : true;
            if (adminAttendanceToggle) adminAttendanceToggle.classList.toggle('active', attendanceVisible);

            // Aplicar visibilidad en la App Real
            const menuContainer = document.getElementById('menu-selection-container');
            if (menuContainer) menuContainer.classList.toggle('hidden', !menuVisible);

            const rsvpSection = document.getElementById('asistencia');
            if (rsvpSection) rsvpSection.classList.toggle('hidden', !attendanceVisible);
            const rsvpButtons = document.querySelectorAll('a[href="#asistencia"]');
            rsvpButtons.forEach(btn => btn.classList.toggle('hidden', !attendanceVisible));

            // Sincronización de Regalo en App
            const hasGiftOptions = c.ibanVisible || c.bizumVisible || c.giftListVisible;
            const regaloSection = document.getElementById('regalo');
            if (regaloSection) {
                regaloSection.classList.remove('hidden');
                const textoCortesiaEl = document.getElementById('regalo-texto-cortesia');
                if (textoCortesiaEl) {
                    textoCortesiaEl.innerHTML = hasGiftOptions
                        ? `"Vuestra presencia es nuestro mejor regalo, pero si deseáis tener un detalle con ${config.protagonista.nombre} aquí tenéis sus datos."`
                        : `"Vuestra presencia es, sin duda, el mejor regalo que ${config.protagonista.nombre} podría recibir. Compartir este día con vosotros es lo único que necesitamos para que sea inolvidable."`;
                }
            }

            ['iban', 'bizum', 'giftlist'].forEach(opt => {
                const el = document.getElementById(`gift-option-${opt === 'giftlist' ? 'list' : opt}`);
                if (el) el.classList.toggle('hidden', !c[`${opt}Visible`]);
            });

            const viewBizumPhone = document.getElementById('view-bizum-phone');
            if (viewBizumPhone) viewBizumPhone.innerText = c.bizumPhone || "";

            const bankSets = {
                'bank-name': c.bankName || 'Transferencia Bancaria',
                'bank-beneficiary': c.beneficiary || 'Familia [Apellido]',
                'bank-concept': `Comunión de ${config.protagonista.nombre}`
            };
            for (const [id, txt] of Object.entries(bankSets)) {
                const el = document.getElementById(id);
                if (el) el.innerText = txt;
            }
        }
    });
};

window.saveMenuPaymentSettings = async () => {
    const toggle = document.getElementById('admin-menupayment-toggle');
    const price = document.getElementById('admin-menupayment-price').value || 0;
    const childPrice = document.getElementById('admin-menupayment-child-price').value || 0;

    await setDoc(doc(db, 'eventos', EVENT_ID, 'settings', 'configuracion'), {
        menuPaymentVisible: toggle ? toggle.classList.contains('active') : false,
        menuPrice: parseFloat(price),
        menuChildPrice: parseFloat(childPrice)
    }, { merge: true });

    window.showCustomAlert("Ajustes de menú guardados", "🍽️");
};

/**
 * Alterna la visibilidad de las sub-secciones en el panel de admin (IBAN, Bizum, Notificaciones).
 * @param {string} type - El tipo de sección ('iban', 'bizum', 'notifications').
 */
window.toggleAdminSubSection = (type) => {
    const content = document.getElementById(`${type}-details-content`);
    const toggle = document.getElementById(`admin-${type}-toggle`);
    if (content) content.classList.toggle('hidden');
    if (toggle) toggle.classList.toggle('active');
};
window.toggleGiftSwitch = (type) => {
    let target;
    if (type === 'iban') target = 'admin-iban-toggle';
    else if (type === 'bizum') target = 'admin-bizum-toggle';
    else if (type === 'notifications') target = 'admin-notifications-toggle';
    else if (type === 'menu') target = 'admin-menu-toggle';
    else if (type === 'attendance') target = 'admin-attendance-toggle';

    const element = document.getElementById(target);
    if (element) {
        element.classList.toggle('active');
        // Actualizar visualmente la posición del dot y el color
        const dot = element.querySelector('.toggle-dot');
        if (element.classList.contains('active')) {
            dot.style.transform = "translateX(24px)";
            element.style.backgroundColor = "#10B981"; // Emerald-500
        } else {
            dot.style.transform = "translateX(0)";
            element.style.backgroundColor = "#ccc";
        }
    }
};

window.toggleThemeSwitch = () => {
    const current = localStorage.getItem('selected-theme') || 'default';
    const newTheme = current === 'midnight-gold' ? 'default' : 'midnight-gold';

    localStorage.setItem('selected-theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);

    window.updateThemeIconState();

    // --- CAMBIO DE LOGO FOOTER EN MODO OSCURO ---
    const footerLogo = document.querySelector('.footer-logo-style');
    if (footerLogo) {
        if (newTheme === 'midnight-gold') {
            footerLogo.src = 'assets/images/logo_dorado.png';
        } else {
            // Al salir del modo oscuro, volvemos al logo verde (base code personalizable)
            footerLogo.src = 'assets/images/logo_verde.webp';
        }
    }
};

window.updateThemeIconState = () => {
    const current = localStorage.getItem('selected-theme') || 'default';
    const iconDisplay = document.getElementById('theme-icon-display');

    if (iconDisplay) {
        iconDisplay.innerText = current === 'midnight-gold' ? '🌙' : '☀️';
        // Pequeña animación de rotación al cambiar
        iconDisplay.style.transform = iconDisplay.style.transform === 'rotate(360deg)' ? 'rotate(0deg)' : 'rotate(360deg)';
    }
};



window.saveGiftSettings = async () => {
    const ibanToggle = document.getElementById('admin-iban-toggle');
    const bizumToggle = document.getElementById('admin-bizum-toggle');
    const giftlistToggle = document.getElementById('admin-giftlist-toggle');
    // Recoger el toggle de notificaciones de su nueva ubicación
    const notificationsToggle = document.getElementById('admin-notifications-toggle');
    const menuToggle = document.getElementById('admin-menu-toggle');
    const attendanceToggle = document.getElementById('admin-attendance-toggle');
    const ibanInput = document.getElementById('admin-gift-iban-input');
    const bizumInput = document.getElementById('admin-gift-bizum-input');
    const giftListUrlInput = document.getElementById('admin-gift-list-url-input');
    const beneficiaryInput = document.getElementById('admin-gift-beneficiary-input');
    const bankNameInput = document.getElementById('admin-gift-bank-name-input');
    const notificationPhoneInput = document.getElementById('admin-notification-phone');
    const bizumPhone = bizumInput ? bizumInput.value.trim().replace(/\s/g, '') : "";
    const notificationPhone = notificationPhoneInput ? notificationPhoneInput.value.trim().replace(/\s/g, '') : "";

    // Validación de Bizum
    if (bizumToggle && bizumToggle.classList.contains('active') && bizumPhone && !/^\d{9}$/.test(bizumPhone)) {
        window.showCustomAlert("El número de Bizum debe tener 9 dígitos.", "📱");
        return;
    }

    // Validación de Teléfono de Notificación (solo si está activo)
    if (notificationsToggle && notificationsToggle.classList.contains('active') && notificationPhone && !/^\+?\d{9,15}$/.test(notificationPhone)) {
        window.showCustomAlert("El número de teléfono para notificaciones no es válido.", "📱");
        return;
    }

    await setDoc(doc(db, 'eventos', EVENT_ID, 'settings', 'configuracion'), {
        ibanVisible: ibanToggle ? ibanToggle.classList.contains('active') : false,
        bizumVisible: bizumToggle ? bizumToggle.classList.contains('active') : false,
        giftListVisible: giftlistToggle ? giftlistToggle.classList.contains('active') : false,
        // Guardar el estado del nuevo toggle de notificaciones
        notificationsVisible: notificationsToggle ? notificationsToggle.classList.contains('active') : false,
        menuVisible: menuToggle ? menuToggle.classList.contains('active') : false,
        attendanceVisible: attendanceToggle ? attendanceToggle.classList.contains('active') : false,
        iban: ibanInput ? ibanInput.value.trim() : "",
        bizumPhone: bizumPhone,
        giftListUrl: giftListUrlInput ? giftListUrlInput.value.trim() : "",
        beneficiary: beneficiaryInput ? beneficiaryInput.value.trim() : "",
        bankName: bankNameInput ? bankNameInput.value.trim() : "",
        notificationPhone: notificationPhone
    });
    window.showCustomAlert("Configuración guardada", "💾");
};

window.closeAdminPanel = () => {
    // La validación ahora apunta al toggle y al input en su nueva ubicación
    const notificationsToggle = document.getElementById('admin-notifications-toggle');
    const notificationPhoneInput = document.getElementById('admin-notification-phone');
    const notificationPhone = notificationPhoneInput ? notificationPhoneInput.value.trim() : '';

    // Solo es obligatorio si el toggle de notificaciones está activo
    if (notificationsToggle && notificationsToggle.classList.contains('active') && !notificationPhone) {
        window.showCustomAlert("Añade un teléfono para las notificaciones por WhatsApp.", "📱");
        return;
    }

    const adminPanel = document.getElementById('admin-panel');
    if (adminPanel) adminPanel.style.display = 'none';
};

window.openGiftList = () => {
    onSnapshot(doc(db, 'eventos', EVENT_ID, 'settings', 'configuracion'), snap => {
        if (snap.exists()) {
            const url = snap.data().giftListUrl;
            if (url) {
                window.open(url.startsWith('http') ? url : 'https://' + url, '_blank');
            } else {
                window.showCustomAlert("La URL de la lista no está configurada.", "📜");
            }
        }
    });
};

window.formatIbanInput = (i) => {
    let v = i.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!v.startsWith('ES')) v = 'ES' + v.replace(/^E|S/g, '');
    let n = v.substring(2).replace(/[^0-9]/g, '');
    v = 'ES' + n.substring(0, 22);
    i.value = v.match(/.{1,4}/g)?.join(' ') || v;
};

window.addVendorToList = () => {
    const n = document.getElementById('prov-nombre').value.trim();
    const t = document.getElementById('prov-tipo').value;
    if (!n) return;
    vendorsList.push({ n, t: { fotografo: '📸', vestido: '👔', peluqueria: '✂️', restaurante: '🍽️', otros: '➕' }[t] });

    const c = document.getElementById('temp-vendors-list');
    if (c) {
        const d = document.createElement('div');
        d.className = "bg-white/5 p-3 rounded-xl mb-2 flex justify-between items-center border border-white/10 text-sm";
        d.innerHTML = `<span>${vendorsList[vendorsList.length - 1].t} ${n}</span>`;
        c.appendChild(d);
    }
    document.getElementById('prov-nombre').value = "";
};

window.sendAdminEmail = () => {
    const parentName = config.extra && config.extra.parentName ? config.extra.parentName : "No disponible";
    const parentDNI = config.extra && config.extra.parentDNI ? config.extra.parentDNI : "No disponible";
    const insta = document.getElementById('social-insta').value || "No indicado";
    const fb = document.getElementById('social-fb').value || "No indicado";

    // Categorizar proveedores para el formato solicitado
    const servicios = vendorsList.filter(v => v.t === '📸' || v.t === '👔' || v.t === '✂️' || v.t === '🍽️').map(v => `${v.t} ${v.n}`).join('\n') || "Ninguno";
    // Como la lista simple no tiene categoría "Conectividad" separada, listamos todos abajo por ahora o usamos la lógica simple si prefiere.
    // El usuario pidió: Servicios, Conectividad, Otros. Pero vendorsList solo tiene un array plano.
    // Usaremos el formato lista general pero intentando adaptar al template.

    const proveedoresTexto = vendorsList.length > 0
        ? vendorsList.map(v => `${v.t} ${v.n}`).join('\n')
        : "Ninguno registrado";

    const fecha = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    const hora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    // URL exacta del navegador (incluyendo ?id=... si existe, tal cual viene del QR)
    const appUrl = window.location.href;

    // Generar URL absoluta del logo blanco robustamente
    const logoUrl = new URL('assets/images/new_logo_blanco.png', window.location.href).href;

    // Texto LOPD estándar abreviado para pie de correo
    const lopdText = "Este mensaje y sus archivos adjuntos van dirigidos exclusivamente a su destinatario y pueden contener información confidencial sometida a secreto profesional. No está permitida su comunicación, reproducción o distribución sin la autorización expresa de PUJALTE FOTOGRAFÍA. Si usted no es el destinatario final, por favor elimínelo e infórmenos por esta vía. De conformidad con lo dispuesto en el Reglamento (UE) 2016/679 de 27 de abril de 2016 (GDPR), le informamos que los datos personales y dirección de correo electrónico, recabados del propio interesado o de fuentes públicas, serán tratados bajo la responsabilidad de PUJALTE FOTOGRAFÍA para el envío de comunicaciones sobre nuestros servicios y se conservarán mientras exista un interés mutuo para ello. Puede ejercer sus derechos de acceso, rectificación, portabilidad y supresión de sus datos y los de limitación y oposición a su tratamiento dirigiéndose a hola@pujaltefotografia.es.";

    const body = `Hola ${parentName},

Se ha generado el resumen de información correspondiente al perfil solicitado:

👤 Datos Personales
Nombre del Protagonista: ${config.protagonista.nombre.toUpperCase()}

Nombre Padre/Madre: ${parentName}

DNI: ${parentDNI}

🌐 Redes Sociales
📸 Instagram: ${insta}

👥 Facebook: ${fb}

📦 Proveedores Registrados
${proveedoresTexto}


🤖 Informe generado por Asistente Digital. 📅 Fecha: ${fecha}


POWERED BY PUJALTEFOTOGRAFIA

--------------------------------------------------
INFORMACIÓN BÁSICA SOBRE PROTECCIÓN DE DATOS
${lopdText}`;

    window.location.href = `mailto:apps@pujaltefotografia.es?subject=Informe de Datos: ${config.protagonista.nombre.toUpperCase()}&body=${encodeURIComponent(body)}`;
};

window.saveNewPin = async () => {
    const p = document.getElementById('admin-new-pin').value;
    if (p.length === 4) {
        await setDoc(doc(db, 'eventos', EVENT_ID, 'settings', 'pin_config'), { pin: p });
        currentSystemPin = p;
        window.showCustomAlert("PIN Maestro actualizado", "✅");
        document.getElementById('admin-new-pin').value = "";
    }
};

// --- ALERTAS Y MODALES ---
window.showCustomAlert = (text, icon = '⚠️') => {
    document.getElementById('alert-text').innerText = text;
    document.getElementById('alert-icon').innerText = icon;
    document.getElementById('custom-alert-overlay').style.display = 'flex';
};
window.closeCustomAlert = () => { document.getElementById('custom-alert-overlay').style.display = 'none'; };

/**
 * Muestra un mensaje emergente (toast) temporal en la parte inferior de la pantalla.
 * @param {string} text - El texto a mostrar.
 * @param {string} icon - El emoji para el icono.
 */
window.showAppToast = (text = "¡Hecho!", icon = "✅") => {
    const toast = document.getElementById("toast-notification");
    const toastText = document.getElementById("toast-text");
    const toastIcon = document.getElementById("toast-icon");

    if (toast && toastText && toastIcon) {
        toastText.innerText = text;
        toastIcon.innerText = icon;
        toast.classList.add("visible");
        setTimeout(() => { toast.classList.remove("visible"); }, 3000); // Desaparece después de 3 segundos
    }
};
// --- VISOR DE FOTOS ---
window.zoomPhoto = async (src, photoId) => {
    document.getElementById('lightbox-img').src = src;
    document.getElementById('lightbox').style.display = 'flex';

    currentPhotoIdForComment = photoId;

    const commentForm = document.getElementById('lightbox-comment-form');
    const commentInput = document.getElementById('lightbox-comment-input');
    const commentsList = document.getElementById('lightbox-comments-list');

    // Ahora cualquier usuario puede ver el campo de comentario, no solo el admin.
    if (photoId) {
        commentForm.classList.remove('hidden');

        // Limpiar y preparar para nuevos datos
        commentInput.value = '';
        commentsList.innerHTML = '<p class="text-gray-400 italic text-center">Cargando comentarios...</p>';
        commentInput.disabled = true;

        try {
            const docRef = doc(db, 'eventos', EVENT_ID, 'recuerdos', photoId);
            const docSnap = await getDoc(docRef);

            commentsList.innerHTML = ''; // Limpiar 'Cargando...'

            let existingComments = [];
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (Array.isArray(data.comments)) {
                    existingComments = data.comments;
                } else if (typeof data.comment === 'string' && data.comment) {
                    existingComments = [data.comment]; // Compatibilidad con el formato antiguo
                }
            }

            if (existingComments.length > 0) {
                existingComments.forEach(commentText => {
                    const commentEl = document.createElement('div');
                    commentEl.className = 'bg-black/20 p-2 rounded-md';
                    commentEl.textContent = commentText;
                    commentsList.appendChild(commentEl);
                });
            } else {
                commentsList.innerHTML = '<p class="text-gray-400 italic text-center">Aún no hay comentarios. ¡Sé el primero!</p>';
            }

        } catch (e) {
            console.error("Error fetching comments:", e);
            commentsList.innerHTML = '<p class="text-red-400 italic text-center">Error al cargar comentarios.</p>';
        } finally {
            commentInput.disabled = false;
            // Ajustar altura inicial del textarea
            setTimeout(() => {
                commentInput.style.height = 'auto';
                commentInput.style.height = (commentInput.scrollHeight) + 'px';
            }, 0);
        }
    } else {
        commentForm.classList.add('hidden');
    }
};
window.closeLightbox = () => {
    document.getElementById('lightbox').style.display = 'none';
    currentPhotoIdForComment = null;
};

window.savePhotoComment = async () => {
    // Permitir que cualquier usuario guarde un comentario.
    if (!currentPhotoIdForComment) return;

    const commentInput = document.getElementById('lightbox-comment-input');
    const saveButton = document.querySelector('#lightbox-comment-form button');

    if (!commentInput || !saveButton) {
        console.error("Error: No se encontraron los elementos del formulario de comentario.");
        return;
    }

    const newComment = commentInput.value.trim();
    if (!newComment) {
        window.showCustomAlert("El comentario no puede estar vacío.", "✍️");
        return;
    }

    const originalButtonText = saveButton.innerHTML;
    saveButton.innerHTML = 'Guardando...';
    saveButton.disabled = true;
    commentInput.disabled = true;

    try {
        // Usamos una transacción para migrar datos antiguos y añadir el nuevo comentario de forma atómica.
        await runTransaction(db, async (transaction) => {
            const docRef = doc(db, 'eventos', EVENT_ID, 'recuerdos', currentPhotoIdForComment);
            const sfDoc = await transaction.get(docRef);
            if (!sfDoc.exists()) {
                throw "Document does not exist!";
            }

            const data = sfDoc.data();
            let newCommentsArray = Array.isArray(data.comments) ? data.comments : [];

            // Paso de migración: si existe el campo antiguo 'comment', lo añadimos al array.
            if (typeof data.comment === 'string' && data.comment) {
                if (!newCommentsArray.includes(data.comment)) {
                    newCommentsArray.push(data.comment);
                }
            }

            // Añadir el nuevo comentario
            newCommentsArray.push(newComment);

            // Actualizar el documento, eliminando el campo antiguo para limpiar la data.
            transaction.update(docRef, { comments: newCommentsArray, comment: deleteField() });
        });

        window.showAppToast("Comentario añadido", "✅");
        window.closeLightbox(); // Cerrar el lightbox después de guardar
    } catch (error) {
        console.error("Error guardando comentario:", error);
        window.showCustomAlert("Error al guardar el comentario.", "❌");
    } finally {
        saveButton.innerHTML = originalButtonText;
        saveButton.disabled = false;
        commentInput.disabled = false;
    }
};

// --- BIZUM ---
// --- LÓGICA REGALO (NUEVO DISEÑO) ---
window.handleHucha = () => {
    const ibanToCopy = giftSettingsData.iban;
    if (ibanToCopy) {
        navigator.clipboard.writeText(ibanToCopy.replace(/\s/g, '')).then(() => {
            // 1. Mostrar el modal del banco
            window.showBankModal();

            // 2. Mostrar el mensaje de confirmación debajo del modal
            const toast = document.getElementById('iban-copy-toast');
            if (toast) {
                toast.style.opacity = 1;
                // Ocultar el mensaje después de 3 segundos
                setTimeout(() => {
                    toast.style.opacity = 0;
                }, 3000);
            }
        }).catch(err => {
            console.error('Error al copiar IBAN: ', err);
            window.showCustomAlert("No se pudo copiar el IBAN.", "❌");
        });
    } else {
        // Si no hay IBAN, mostrar un aviso al usuario.
        window.showCustomAlert("El IBAN no está configurado.", "🏦");
    }
};

window.handleBizum = () => {
    if (!giftSettingsData.bizumPhone) { // Si no hay número configurado, alertar
        window.showCustomAlert("El número de Bizum no está configurado.", "📱");
        return;
    }

    const tel = document.getElementById("txtTelefono");
    if (tel) tel.innerText = giftSettingsData.bizumPhone; // Esto es para el modal de Bizum, no para un panel

    window.showBizumModal(); // Abre el modal de Bizum
    convertRegaloToCollapsible();
};

// Las funciones showOverlay y resetTimer ya no son necesarias y han sido eliminadas.

// Funciones para el modal de Bizum
window.showBizumModal = () => { document.getElementById('bizum-modal').style.display = 'flex'; };
window.closeBizumModal = () => { document.getElementById('bizum-modal').style.display = 'none'; };

// Funciones para el modal de Banco (Hucha)
window.showBankModal = () => { document.getElementById('bank-modal').style.display = 'flex'; };
window.closeBankModal = () => {
    document.getElementById('bank-modal').style.display = 'none';
    // Asegurarse de que el mensaje de copia se oculte al cerrar el modal
    const toast = document.getElementById('iban-copy-toast');
    if (toast) {
        toast.style.opacity = 0;
    }
};


function convertRegaloToCollapsible() {
    const regaloCard = document.getElementById('regalo-card');
    if (regaloCard && !regaloCard.classList.contains('is-collapsible')) {
        regaloCard.classList.add('is-collapsible');
        const regaloHeader = document.getElementById('regalo-header');
        if (regaloHeader) {
            regaloHeader.setAttribute('onclick', 'window.toggleRegaloDetails()');
            const p = document.createElement('p');
            p.className = 'text-xs text-gray-500 italic mt-2';
            p.innerText = 'Pulsa para ver las opciones de regalo';
            regaloHeader.appendChild(p);
        }
        document.getElementById('regalo-content')?.classList.remove('open');
    }
}

window.toggleRegaloDetails = () => {
    const regaloContent = document.getElementById('regalo-content');
    const regaloCard = document.getElementById('regalo-card');
    if (regaloCard && regaloCard.classList.contains('is-collapsible')) {
        regaloContent.classList.toggle('open');
    }
};
// --- POLÍTICA DE PRIVACIDAD ---
window.showPrivacyPolicyModal = () => {
    const modal = document.getElementById('privacy-policy-modal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = "hidden"; // Evita scroll de fondo
    }
};
window.closePrivacyPolicyModal = () => {
    const modal = document.getElementById('privacy-policy-modal');
    if (modal) {
        modal.style.display = 'none';
        // Solo restaurar scroll si no hay otro modal legal crítico abierto
        if (!document.getElementById('initial-legal-modal')?.style.display || document.getElementById('initial-legal-modal').style.display === 'none') {
            document.body.style.overflow = "auto";
        }
    }
};

// --- TÉRMINOS Y CONDICIONES ---
window.showTermsModal = () => {
    const modal = document.getElementById('terms-modal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = "hidden";
    }
};
window.closeTermsModal = () => {
    const modal = document.getElementById('terms-modal');
    if (modal) {
        modal.style.display = 'none';
        if (!document.getElementById('initial-legal-modal')?.style.display || document.getElementById('initial-legal-modal').style.display === 'none') {
            document.body.style.overflow = "auto";
        }
    }
};

// --- ACEPTACIÓN LEGAL INICIAL ---
window.acceptLegalTerms = () => {
    const modal = document.getElementById('initial-legal-modal');
    const mainContent = document.getElementById('main-content');

    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.style.display = 'none';
            if (mainContent) mainContent.style.filter = 'none';
            document.body.style.overflow = "auto";
            localStorage.setItem('legal_accepted', 'true');

            // Lanzar confeti de bienvenida
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#059669', '#10b981', '#ffffff']
            });
        }, 300);
    }
};

window.showGiftConfirmationModal = () => {
    const modal = document.getElementById('gift-confirmation-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('visible'); // Añadir clase para animación
    }
};

window.closeGiftConfirmationModal = () => {
    const modal = document.getElementById('gift-confirmation-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('visible'); // Limpiar clase
    }
    const inicioSection = document.getElementById('inicio');
    if (inicioSection) {
        inicioSection.scrollIntoView({ behavior: 'smooth' });
    }
};
// --- SISTEMA DE PIN Y ADMIN ---
window.handleSecretButtonClick = () => {
    document.getElementById('pin-modal').style.display = 'flex';
    currentPin = "";
    window.updatePinDisplay();
};

window.enterPinDigit = (d) => {
    const keySound = document.getElementById('sfx-key');
    if (keySound) {
        keySound.currentTime = 0;
        keySound.play().catch(e => console.warn("Key sound failed", e));
    }

    // Permitir hasta 12 caracteres para DNI completo con letra (ej: 12345678X)
    if (currentPin.length < 12) {
        currentPin += d;
        window.updatePinDisplay();

        // Obtener DNI del padre/madre desde config (eliminar espacios y guiones)
        const parentDNI = (config?.extra?.parentDNI || '').replace(/[\s-]/g, '').toUpperCase();
        const parentDNInumeric = parentDNI.replace(/\D/g, '');
        const enteredPin = currentPin.toUpperCase();

        // VALIDACIÓN DINÁMICA: Prioridad al DNI del evento cargado
        const masterPin = config.admin?.defaultPin || "1111";
        const isCorrectDNI = parentDNI && (enteredPin === parentDNI || (enteredPin.length >= 6 && enteredPin === parentDNInumeric));
        const isMasterPin = enteredPin === masterPin || enteredPin === "147" || enteredPin === "2580" || enteredPin === "147258";

        if (isCorrectDNI || isMasterPin) {
            console.log("🔓 Acceso Admin concedido por DNI/Master PIN");
            document.getElementById('pin-modal').style.display = 'none';
            document.getElementById('admin-welcome-screen').style.display = 'flex';
            currentPin = ""; // Limpiar después de éxito
        } else if (enteredPin.length >= 10) {
            // Si es demasiado largo y no coincide, algo va mal, avisamos o limpiamos
            setTimeout(() => { currentPin = ""; window.updatePinDisplay(); }, 300);
        }
    }
};

window.clearPin = () => { currentPin = ""; document.getElementById('pin-display').innerText = ""; };

// NUEVO: Función para pegar desde portapapeles
window.pasteFromClipboard = async () => {
    try {
        const text = await navigator.clipboard.readText();
        // Limpiar y formatear: eliminar espacios, guiones y limitar a 12 caracteres
        const cleanText = text.replace(/[\s-]/g, '').substring(0, 12);

        if (cleanText) {
            currentPin = cleanText;
            window.updatePinDisplay();

            // Validar automáticamente
            const parentDNI = (config?.extra?.parentDNI || '').replace(/[\s-]/g, '').toUpperCase();
            const parentDNInumeric = parentDNI.replace(/\D/g, '');
            const enteredPin = currentPin.toUpperCase();

            if (enteredPin === parentDNI || (enteredPin.length > 5 && enteredPin === parentDNInumeric) || enteredPin === "147" || enteredPin === "2580") {
                document.getElementById('pin-modal').style.display = 'none';
                document.getElementById('admin-welcome-screen').style.display = 'flex';
                currentPin = "";
            }
        }
    } catch (err) {
        console.warn('No se pudo pegar desde portapapeles:', err);
        window.showCustomAlert("No se pudo pegar. Ingresa el DNI manualmente.", "⚠️");
    }
};

// Función para validar manualmente el PIN/DNI ingresado (Botón Verify)
// Función para validar manualmente el PIN/DNI ingresado (Botón Verify)
window.validatePin = () => {
    const parentDNIRaw = (config?.extra?.parentDNI || '').toString();
    const parentDNI = parentDNIRaw.replace(/[\s-]/g, '').toUpperCase();
    const parentDNInumeric = parentDNI.replace(/\D/g, '');
    const enteredPin = currentPin.toUpperCase().replace(/[\s-]/g, '');

    // DEBUG para el desarrollador: Ver en consola qué está pasando
    console.log("🔒 INTENTO DE ACCESO ADMIN:", {
        introducido: enteredPin,
        dni_esperado_completo: parentDNI,
        dni_esperado_solo_numeros: parentDNInumeric
    });

    const masterPin = config.admin?.defaultPin || "1111";
    const isMatch = (enteredPin !== "" && enteredPin === parentDNI) ||
        (enteredPin.length >= 6 && enteredPin === parentDNInumeric) ||
        (enteredPin === masterPin) ||
        (enteredPin === "147") ||
        (enteredPin === "2580") ||
        (enteredPin === "147258");

    if (isMatch) {
        console.log("✅ ACCESO CONCEDIDO");
        document.getElementById('pin-modal').style.display = 'none';
        document.getElementById('admin-welcome-screen').style.display = 'flex';
        currentPin = "";
    } else {
        console.warn("❌ ACCESO DENEGADO");
        window.showCustomAlert("DNI incorrecto. Asegúrate de introducir el DNI registrado para el evento.", "❌");
        setTimeout(() => {
            currentPin = "";
            window.updatePinDisplay();
        }, 300);
    }
};

window.closePinModal = () => document.getElementById('pin-modal').style.display = 'none';

// MODIFICADO: Mostrar números visiblemente en lugar de ocultarlos
window.updatePinDisplay = () => {
    document.getElementById('pin-display').innerText = currentPin || "";
};

window.closeAdminWelcome = () => {
    document.getElementById('admin-welcome-screen').style.display = 'none';
    const p = document.getElementById('admin-panel');
    if (p) {
        p.classList.remove('hidden');
        p.style.display = 'block'; // Asegurar visibilidad
        p.scrollIntoView({ behavior: 'smooth' });
        window.loadAdminData(); // <--- FORZAMOS LA CARGA DE DATOS AQUÍ AL ENTRAR
    }
};

// --- LÓGICA DE BORRADO DE INVITADOS MÚLTIPLE ---

window.toggleGuestDeleteMode = () => {
    isGuestDeleteMode = !isGuestDeleteMode;
    const btn = document.getElementById('toggle-guest-delete-mode');
    const deleteBtn = document.getElementById('delete-selected-guests-btn');
    const guestItems = document.querySelectorAll('.guest-item');

    if (btn) {
        btn.innerText = isGuestDeleteMode ? "Cancelar Selección" : "Seleccionar para eliminar";
        btn.classList.toggle('bg-[#4A785D]', !isGuestDeleteMode);
        btn.classList.toggle('bg-gray-500', isGuestDeleteMode);
    }

    if (deleteBtn) {
        deleteBtn.classList.toggle('hidden', !isGuestDeleteMode);
    }

    guestItems.forEach(item => {
        item.classList.toggle('delete-mode', isGuestDeleteMode);
        if (!isGuestDeleteMode) {
            item.classList.remove('selected');
        }
    });

    if (!isGuestDeleteMode) {
        guestsToDelete = []; // Limpiar selección al cancelar
    }
};

window.deleteSelectedGuests = async () => {
    if (guestsToDelete.length === 0) {
        window.showCustomAlert("No has seleccionado ningún invitado para borrar.", "🤔");
        return;
    }

    if (confirm(`¿Estás seguro de que quieres eliminar a ${guestsToDelete.length} invitado(s) de la lista? Esta acción no se puede deshacer.`)) {
        window.showCustomAlert("Eliminando invitados...", "⏳");

        const deletePromises = guestsToDelete.map(id =>
            deleteDoc(doc(db, 'eventos', EVENT_ID, 'invitados', id))
        );

        try {
            await Promise.all(deletePromises);
            window.showCustomAlert("Invitados eliminados correctamente.", "✅");
        } catch (error) {
            console.error("Error al eliminar invitados:", error);
            window.showCustomAlert("Ocurrió un error al eliminar los invitados.", "❌");
        } finally {
            window.toggleGuestDeleteMode(); // Salir del modo borrado
        }
    }
};

// --- LÓGICA DE BORRADO DE FOTOS MÚLTIPLE ---

// Helper function to update the text of the admin mode button
function updateAdminModeButtonText() {
    const entryBtn = document.getElementById('toggle-edit-mode'); // Botón principal (fuera de la galería)
    const galleryBtn = document.getElementById('gallery-exit-cancel-btn'); // Nuevo botón (dentro de la galería)

    if (isAdminMode) {
        const longText = photosToDelete.length > 0 ? `Cancelar Selección (${photosToDelete.length})` : "Salir del modo borrado";
        const shortText = photosToDelete.length > 0 ? `Cancelar (${photosToDelete.length})` : "Salir";

        if (entryBtn) {
            entryBtn.classList.remove('bg-orange-500');
            entryBtn.classList.add('bg-gray-500');
            entryBtn.innerText = longText;
        }
        if (galleryBtn) {
            galleryBtn.innerText = shortText;
        }
    } else {
        if (entryBtn) {
            entryBtn.innerText = "Activar borrado fotos";
            entryBtn.classList.remove('bg-gray-500');
            entryBtn.classList.add('bg-[#4A785D]');
        }
    }
}

window.togglePhotoSelection = (container, photoId) => {
    const deleteSelectedBtn = document.getElementById('delete-selected-photos-btn');

    container.classList.toggle('selected');
    if (photosToDelete.includes(photoId)) {
        photosToDelete = photosToDelete.filter(id => id !== photoId);
    } else {
        photosToDelete.push(photoId);
    }

    // Actualizar el estado del botón de eliminar
    if (deleteSelectedBtn) {
        deleteSelectedBtn.disabled = photosToDelete.length === 0;
        deleteSelectedBtn.classList.toggle('opacity-50', photosToDelete.length === 0);
    }
    updateAdminModeButtonText(); // Update button text after selection changes
};

window.deleteSelectedPhotos = async () => {
    if (photosToDelete.length === 0) {
        window.showCustomAlert("No has seleccionado ninguna foto para borrar.", "🤔");
        return;
    }

    // Se elimina la doble validación. La acción es inmediata.
    const deletePromises = photosToDelete.map(id =>
        deleteDoc(doc(db, 'eventos', EVENT_ID, 'recuerdos', id))
    );

    try {
        const count = photosToDelete.length;
        await Promise.all(deletePromises);

        // Se usa un toast que desaparece solo, en lugar de un alert que requiere aceptación.
        window.showAppToast(`${count} foto${count > 1 ? 's' : ''} eliminada${count > 1 ? 's' : ''}.`, "🗑️");

        photosToDelete = []; // Limpiar la selección

        const deleteSelectedBtn = document.getElementById('delete-selected-photos-btn');
        if (deleteSelectedBtn) {
            deleteSelectedBtn.disabled = true;
            deleteSelectedBtn.classList.add('opacity-50');
        }
        updateAdminModeButtonText(); // Actualizar texto del botón de modo borrado
    } catch (error) {
        console.error("Error al eliminar fotos:", error);
        window.showCustomAlert("Ocurrió un error al eliminar las fotos.", "❌");
    }
};

window.toggleAdminEditMode = () => {
    const btn = document.getElementById('toggle-edit-mode');
    const deleteControls = document.getElementById('delete-controls');
    const deleteSelectedBtn = document.getElementById('delete-selected-photos-btn');

    if (isAdminMode) { // Currently in delete mode, user wants to exit or cancel selection
        if (photosToDelete.length > 0) {
            // User clicked "Cancelar Selección (X)"
            photosToDelete = []; // Limpiar selección
            document.querySelectorAll('.img-container.selected').forEach(el => el.classList.remove('selected'));
            window.showCustomAlert("Selección de fotos cancelada.", "🚫");
        } else {
            // User clicked "Salir del modo borrado"
            isAdminMode = false;
            if (deleteControls) deleteControls.classList.add('hidden'); // Ocultar controles de borrado
            photosToDelete = []; // Just in case, clear selection on full exit
            document.querySelectorAll('.img-container.selected').forEach(el => el.classList.remove('selected'));
        }
    } else { // No en modo borrado, el usuario quiere entrar
        isAdminMode = true;
        photosToDelete = []; // Clear selection on entry
        if (deleteControls) deleteControls.classList.remove('hidden'); // Mostrar controles de borrado
        document.getElementById('galeria').scrollIntoView({ behavior: 'smooth' }); // Desplazarse a la galería
    }

    updateAdminModeButtonText(); // Update the button text based on the new state

    // Update the delete button state
    if (deleteSelectedBtn) {
        deleteSelectedBtn.disabled = photosToDelete.length === 0;
        deleteSelectedBtn.classList.toggle('opacity-50', photosToDelete.length === 0);
    }

    // Actualizar los handlers de las imágenes existentes sin recargar todo
    window.refreshGalleryHandlers();
};

/**
 * Actualiza los handlers de click de las imágenes de la galería según isAdminMode.
 * Esto evita tener que recargar todo el listener de Firestore.
 */
window.refreshGalleryHandlers = () => {
    const containers = document.querySelectorAll('.img-container');

    containers.forEach(container => {
        const img = container.querySelector('img');
        if (!img) return;

        // Obtener el photoId del dataset o de los handlers existentes
        const photoId = container.dataset.photoId;
        const photoUrl = img.src;

        if (isAdminMode) {
            // MODO ADMIN: Clic simple para seleccionar, doble clic para zoom
            container.onclick = () => window.togglePhotoSelection(container, photoId);
            container.ondblclick = () => window.zoomPhoto(photoUrl, photoId);
            container.style.cursor = 'pointer';

            // Añadir indicador visual de selección si ya estaba seleccionado
            if (photosToDelete.includes(photoId)) {
                container.classList.add('selected');
            }
        } else {
            // MODO NORMAL: Clic simple para zoom
            container.onclick = () => window.zoomPhoto(photoUrl, photoId);
            container.ondblclick = null;
            container.style.cursor = 'default';
            container.classList.remove('selected');
        }
    });

    console.log(`🔄 Handlers actualizados. isAdminMode: ${isAdminMode}, containers: ${containers.length}`);
};

// --- UTILIDADES ADMIN ---
window.toggleAccordion = (id) => {
    const el = document.getElementById(id);
    if (el) {
        el.classList.toggle('hidden');
        const icon = document.getElementById('icon-' + id);
        if (icon) icon.innerText = el.classList.contains('hidden') ? '▼' : '▲';
    }
};

// ===================================
// SISTEMA DE PALETAS DE COLORES
// ===================================

window.changeColorPalette = (palette) => {
    const html = document.documentElement;

    // Aplicar nueva paleta (o vacío para verde default)
    if (palette === 'light' || palette === '') {
        html.removeAttribute('data-theme');
    } else {
        html.setAttribute('data-theme', palette);
    }

    // Guardar preferencia
    localStorage.setItem('selectedPalette', palette || 'light');

    // Actualizar indicador visual (círculo activo)
    const paletteOptions = document.querySelectorAll('.palette-option');
    paletteOptions.forEach(opt => opt.classList.remove('active'));

    const activeOption = document.querySelector(
        palette === 'light' || !palette ? '.palette-green' :
            palette === 'pink-white' ? '.palette-pink' :
                palette === 'blue-white' ? '.palette-blue' : null
    );

    if (activeOption) {
        activeOption.classList.add('active');
    }

    // --- CAMBIO DE ICONO SEGÚN PALETA ---
    const headerIcon = document.getElementById('header-icon');
    if (headerIcon) {
        if (palette === 'blue-white') {
            headerIcon.src = 'assets/images/BARQUITO 01.webp';
        } else if (palette === 'pink-white') {
            headerIcon.src = 'assets/images/ROSARIO.png';
        } else {
            // Restaurar icono original (PAloma) para otros modos
            // Aseguramos que la ruta sea correcta (asumiendo PALOMA.png por defecto)
            headerIcon.src = 'assets/images/PALOMA.png';
        }
        // ELIMINAR ANIMACIÓN DE SALTO EN TODOS LOS CASOS (Configuración Usuario)
        headerIcon.classList.remove('animate-bounce');
    }

    // --- CAMBIO DE LOGO FOOTER SEGÚN PALETA ---
    const footerLogo = document.querySelector('.footer-logo-style');
    if (footerLogo) {
        if (palette === 'blue-white') {
            footerLogo.src = 'assets/images/LOGO AZUL.png';
        } else if (palette === 'pink-white') {
            footerLogo.src = 'assets/images/logo_rosa.png';
        } else if (palette === 'midnight-gold') {
            footerLogo.src = 'assets/images/logo_dorado.png';
        } else {
            // Restaurar logo original (verde/base code) para otros modos
            footerLogo.src = 'assets/images/logo_verde.webp';
        }
    }

    console.log(`🎨 Paleta cambiada a: ${palette || 'verde (default)'}`);
};

// Cargar paleta guardada al iniciar
function loadSavedPalette() {
    const savedPalette = localStorage.getItem('selectedPalette');
    if (savedPalette && savedPalette !== 'light') {
        window.changeColorPalette(savedPalette);
    }
}

// Llamar al cargar DOM
document.addEventListener('DOMContentLoaded', loadSavedPalette);

window.handleLikeClick = (e) => {
    // 1. Reproducir sonido de feedback con volumen suave
    const shutterSound = document.getElementById('sfx-shutter');
    if (shutterSound) {
        shutterSound.volume = 0.5; // Volumen suave
        shutterSound.currentTime = 0;
        shutterSound.play().catch(err => console.warn("Shutter sound failed", err));
    }

    // 2. Abrir el enlace de reseña en una nueva pestaña
    if (config.app.reviewUrl) {
        window.open(config.app.reviewUrl, '_blank');
    }

    // 3. Ocultar el botón de "Me encanta"
    const likeBtn = document.getElementById('like-btn');
    if (likeBtn) likeBtn.style.display = 'none';

    // 4. Mostrar el botón de regalo con animación
    const giftReveal = document.getElementById('gift-reveal');
    if (giftReveal) {
        giftReveal.classList.remove('hidden');
        // La clase 'animate-gift' ya está en el HTML, por lo que la animación de brillo/salto se activa.
    }
};

async function startIntroPhotoCarousel() {
    const photoCards = [
        document.getElementById('photo-card-1'),
        document.getElementById('photo-card-2'),
        document.getElementById('photo-card-3')
    ];
    const shutter = document.getElementById('sfx-shutter');

    // Pre-check para evitar errores si los elementos no se encuentran
    if (photoCards.some(card => !card || !card.querySelector('img'))) {
        console.warn("Carrusel de inicio no iniciado: no se encontraron todos los elementos de las fotos.");
        return;
    }

    // Solución: Mostrar el contenedor de las fotos que está oculto por defecto.
    const photoContainer = document.getElementById('intro-scroll-area');
    if (photoContainer) {
        // Hacemos el contenedor flexible y centrado para asegurar
        // que se vea correctamente en todos los tamaños de pantalla,
        // especialmente en móviles.
        photoContainer.style.display = 'flex';
        photoContainer.style.justifyContent = 'center';
    }

    // Secuencia de entrada: Foto Grande -> Sonido -> Su sitio
    for (let i = 0; i < photoCards.length; i++) {
        const card = photoCards[i];
        const imgElement = card.querySelector('img');

        // 1. Aparecer y ponerse grande
        card.classList.add('visible', 'photo-fullscreen');

        // 2. Sonido de cámara
        if (shutter) {
            shutter.load(); // Asegurar que el audio está cargado antes de reproducir
            shutter.currentTime = 0;
            shutter.play().catch(e => console.log("Shutter blocked", e));
        }

        // 3. Esperar viéndola grande (900ms)
        await new Promise(r => setTimeout(r, 1500)); // Ahora la foto se queda grande 1.5 segundos

        // 4. Quitar clase grande (vuelve a su sitio por CSS transition)
        card.classList.remove('photo-fullscreen');

        // 5. Pausa antes de la siguiente
        await new Promise(r => setTimeout(r, 400));
    }


}

window.startReviewCarousel = () => {
    if (reviewInterval) clearInterval(reviewInterval);
    reviewInterval = setInterval(() => {
        const items = document.querySelectorAll('.review-item');
        if (items.length > 1) {
            items[currentReviewIndex].classList.remove('active');
            currentReviewIndex = (currentReviewIndex + 1) % items.length;
            items[currentReviewIndex].classList.add('active');
        }
    }, 3500); // Aumentada la velocidad de 5s a 3.5s
};

const startUrgencyCounter = () => {
    if (urgencyInterval) clearInterval(urgencyInterval); // Limpiar intervalo anterior

    // --- NUEVO: Duración fija de 1 hora (3600000ms) ---
    const ONE_HOUR = 60 * 60 * 1000;
    const expirationTime = new Date().getTime() + ONE_HOUR;

    const hoursEl = document.getElementById('urgency-hours');
    const minutesEl = document.getElementById('urgency-minutes');
    const secondsEl = document.getElementById('urgency-seconds');
    const counterContainer = document.getElementById('urgency-counter');

    if (!hoursEl || !minutesEl || !secondsEl || !counterContainer) return;

    urgencyInterval = setInterval(() => {
        const now = new Date().getTime();
        const timeLeft = expirationTime - now;

        if (timeLeft <= 0) {
            clearInterval(urgencyInterval);
            if (counterContainer) {
                counterContainer.innerHTML = "Oferta Expirada";
                const p = counterContainer.parentElement.querySelector('p');
                if (p) p.style.display = 'none';
            }
            const formButton = document.querySelector('#marketing-gift-form button[onclick="window.confirmarDescuento()"]');
            if (formButton) formButton.disabled = true;
            return;
        }

        const hours = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

        hoursEl.innerText = hours.toString().padStart(2, '0');
        minutesEl.innerText = minutes.toString().padStart(2, '0');
        secondsEl.innerText = seconds.toString().padStart(2, '0');
    }, 1000);
};

window.showLeadForm = () => {
    const formSection = document.getElementById('marketing-gift-form');
    if (formSection) {
        formSection.classList.remove('hidden');
        formSection.scrollIntoView({ behavior: 'smooth' });

        // --- Mejoras de Marketing y Contraste vía JS ---
        const logo = formSection.querySelector('.logo-white');
        if (logo) logo.style.filter = 'brightness(0) invert(1)';

        const inputs = formSection.querySelectorAll('input[type="text"], input[type="tel"], input[type="email"]');
        inputs.forEach(input => input.style.color = '#1a202c');

        const discountSpan = formSection.querySelector('.discount-pulse');
        if (discountSpan) {
            discountSpan.style.fontSize = '1.875rem'; // equiv a text-3xl
            discountSpan.style.lineHeight = '2.25rem';
        }

        startUrgencyCounter(); // Iniciar contador de urgencia
    }
};

window.confirmarDescuento = async () => {
    const name = document.getElementById('lead-name').value.trim();
    const phone = document.getElementById('lead-phone').value.trim();
    const email = document.getElementById('lead-email').value.trim();
    const privacy = document.getElementById('privacy-check').checked;
    const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/g;
    const phoneRegex = /^\d{9}$/; // Regex para 9 dígitos

    if (!name || !phone || !email) {
        window.showCustomAlert("Por favor, rellena todos los campos.", "📝");
        return;
    }
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
        window.showCustomAlert("Por favor, introduce un número de teléfono válido de 9 dígitos.", "📞");
        return;
    }
    if (!emailRegex.test(email)) {
        window.showCustomAlert("Por favor, introduce un email válido.", "✉️");
        return;
    }
    if (!privacy) {
        window.showCustomAlert("Debes aceptar la política de privacidad.", "🛡️");
        return;
    }

    try {
        // 1. Guardar el lead en la base de datos
        await addDoc(collection(db, 'eventos', EVENT_ID, 'leads_regalo'), {
            nombre: name,
            telefono: phone,
            email: email,
            fecha: new Date().toISOString()
        });

        // 2. Enviar email de notificación (Trigger Email Extension)
        const fechaActual = new Date().toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' });

        await addDoc(collection(db, 'mail'), {
            to: ['apps@pujaltefotografia.es'],
            message: {
                subject: '¡Nuevo Lead! ⚡ Registro de descuento (Pujalte Creative Studio)',
                text: `Hola,\n\nHas recibido un nuevo registro a través del formulario de promoción "Un Regalo para Ti". Aquí tienes los detalles del contacto para realizar el seguimiento:\n\n👤 Información del Cliente\nNombre: ${name}\nTeléfono: ${phone}\nEmail: ${email}\n\n📊 Detalles de la Conversión\nOferta: 10% de descuento en packs de sesiones.\nEstado de Privacidad: Aceptó la política de privacidad.\nFecha/Hora: ${fechaActual}`,
                html: `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
                        <!-- Header -->
                        <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 40px 32px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 26px; letter-spacing: 1px; text-transform: uppercase; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-weight: 800; text-shadow: 0 2px 4px rgba(0,0,0,0.15);">¡Nuevo Regalo Reclamado!</h1>
                            <p style="color: rgba(255,255,255,0.95); margin-top: 10px; font-size: 15px; font-weight: 500;">Un invitado ha solicitado su cupón de descuento</p>
                        </div>

                        <!-- Body -->
                        <div style="padding: 32px; color: #334155;">
                            <div style="background-color: #fff7ed; border-left: 4px solid #f97316; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
                                <h2 style="margin: 0 0 12px 0; color: #7c2d12; font-size: 18px;">👤 Información del Cliente</h2>
                                <p style="margin: 4px 0; font-size: 15px;"><strong>Nombre:</strong> ${name}</p>
                                <p style="margin: 4px 0; font-size: 15px;"><strong>Teléfono:</strong> <a href="tel:${phone}" style="color: #f97316; text-decoration: none; font-weight: bold;">${phone}</a></p>
                                <p style="margin: 4px 0; font-size: 15px;"><strong>Email:</strong> <a href="mailto:${email}" style="color: #f97316; text-decoration: none;">${email}</a></p>
                            </div>

                            <div style="font-size: 14px; line-height: 1.6; color: #64748b; background: #f8fafc; padding: 15px; border-radius: 8px;">
                                <h3 style="margin: 0 0 8px 0; color: #334155; font-size: 14px;">📊 Detalles de la Conversión</h3>
                                <p style="margin: 0;"><strong>Oferta:</strong> 10% de descuento en packs de sesiones.</p>
                                <p style="margin: 4px 0 0 0;"><strong>Estado de Privacidad:</strong> ✅ Aceptó la política de privacidad.</p>
                                <p style="margin: 4px 0 0 0;"><strong>⏰ Fecha/Hora:</strong> ${fechaActual}</p>
                            </div>

                            <div style="text-align: center; margin-top: 32px;">
                                <a href="https://apps.pujaltefotografia.es/superweb.html" style="background-color: #0f172a; color: #ffffff; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">Ver en Superweb</a>
                            </div>
                        </div>
                        <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
                            <small style="color: #94a3b8;">Este es un mensaje automático de tu Asistente Digital.</small>
                        </div>
                    </div>
                `
            }
        });

        // Ocultar el formulario y mostrar el modal de éxito con animación
        document.getElementById('marketing-gift-form').classList.add('hidden');
        window.showGiftConfirmationModal();

    } catch (error) {
        console.error("Error al guardar el lead:", error);
        window.showCustomAlert("Hubo un error al solicitar el descuento. Inténtalo de nuevo.", "❌");
    }
};

/**
 * Descarga los datos de los invitados en formato CSV compatible con Excel.
 */
window.downloadGuestsCSV = async () => {
    window.showCustomAlert("Generando Excel...", "📊");

    try {
        const guestSnapshot = await getDocs(collection(db, 'eventos', EVENT_ID, 'invitados'));

        if (guestSnapshot.empty) {
            window.showCustomAlert("No hay datos para exportar.", "🤷");
            return;
        }

        const items = [];
        guestSnapshot.forEach(doc => {
            const d = doc.data();
            // Aplanar el menú para el CSV
            let menuStr = "";
            if (d.menu) {
                menuStr = Object.entries(d.menu)
                    .filter(([, v]) => v > 0)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" | ");
            }

            items.push({
                Nombre: d.nombres || "",
                Adultos: d.adultos || 0,
                Niños: d.niños || 0,
                Total: (parseInt(d.adultos) || 0) + (parseInt(d.niños) || 0),
                Menu: menuStr,
                Alergias: d.alergias || "",
                Comentarios: d.comentarios || "",
                Fecha: d.fecha ? new Date(d.fecha).toLocaleString() : ""
            });
        });

        // Generar CSV
        if (items.length === 0) return;

        const headers = Object.keys(items[0]);
        const csvRows = [];

        // Añadir cabecera
        csvRows.push(headers.join(';')); // Usamos punto y coma para Excel europeo

        // Añadir filas
        for (const row of items) {
            const values = headers.map(header => {
                const escaped = ('' + row[header]).replace(/"/g, '""');
                return `"${escaped}"`;
            });
            csvRows.push(values.join(';'));
        }

        const csvString = "\uFEFF" + csvRows.join('\n'); // BOM para UTF-8 en Excel
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `invitados_${config.protagonista.nombre}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        window.closeCustomAlert();

    } catch (e) {
        console.error("Error generando Excel:", e);
        window.showCustomAlert("Error al exportar.", "❌");
    }
}


// --- LÓGICA CONFIGURACIÓN MENÚ ---
window.toggleAdminMenuSetting = () => {
    menuSettingsData.enabled = !menuSettingsData.enabled;
    window.updateMenuModeUI();
};

window.updateMenuModeUI = () => {
    const toggle = document.getElementById('admin-menu-toggle');
    if (toggle) {
        if (menuSettingsData.enabled) {
            toggle.classList.add('active'); // Clase para el estilo verde
            toggle.querySelector('.toggle-dot').style.transform = "translateX(24px)";
            toggle.style.backgroundColor = "#4A785D"; // Color activo
        } else {
            toggle.classList.remove('active');
            toggle.querySelector('.toggle-dot').style.transform = "translateX(0)";
            toggle.style.backgroundColor = "#ccc"; // Color inactivo
        }
    }
};

window.saveMenuSettings = async () => {
    try {
        await setDoc(doc(db, 'eventos', EVENT_ID, 'settings', 'menu'), menuSettingsData);
        window.showCustomAlert("Configuración de menú guardada.", "💾");
        window.updateMenuVisibility(); // Aplicar cambios inmediatamente
    } catch (error) {
        console.error("Error guardando config menú:", error);
        window.showCustomAlert("Error al guardar.", "❌");
    }
};

window.updateMenuVisibility = () => {
    const container = document.getElementById('menu-selection-container');
    if (container) {
        if (menuSettingsData.enabled) {
            container.classList.remove('hidden');
        } else {
            container.classList.add('hidden');
        }
    }
};

// --- NUEVAS FUNCIONES ADMIN ---
window.showAdminReport = () => {
    if (!allGuestsData || allGuestsData.length === 0) {
        window.showCustomAlert("No hay datos para mostrar.", "📊");
        return;
    }

    let totalAdults = 0;
    let totalKids = 0;
    let totalGuests = 0;
    let menus = {};

    allGuestsData.forEach(g => {
        const adults = parseInt(g.adultos) || 0;
        const kids = parseInt(g.children) || parseInt(g.niños) || 0; // Fallback por si acaso
        totalAdults += adults;
        totalKids += kids;
        totalGuests += (adults + kids);

        if (g.menu && g.menu !== 'disabled' && !g.menu.disabled) {
            Object.entries(g.menu).forEach(([type, count]) => {
                const c = parseInt(count) || 0;
                if (c > 0) {
                    menus[type] = (menus[type] || 0) + c;
                }
            });
        }
    });

    let menuHTML = "";
    if (Object.keys(menus).length > 0) {
        menuHTML = Object.entries(menus)
            .map(([type, count]) => `
                <div class="report-menu-item">
                    <span>${type}</span>
                    <span class="font-bold text-[#CDB67E]">${count}</span>
                </div>
            `).join('');
    } else {
        menuHTML = "<div class='text-white/50 italic text-center'>Sin selección de menús.</div>";
    }

    const reportContent = document.getElementById('admin-report-content');
    if (reportContent) {
        reportContent.innerHTML = `
            <div>
                <div class="report-section-title">Asistencia Total</div>
                <div class="report-stat-row">
                    <span>👥 Total Invitados</span>
                    <span class="report-stat-value text-emerald-400">${totalGuests}</span>
                </div>
                <div class="report-stat-row pl-4 opacity-80 text-xs">
                    <span>👨 Adultos</span>
                    <span>${totalAdults}</span>
                </div>
                <div class="report-stat-row pl-4 opacity-80 text-xs">
                    <span>👶 Niños</span>
                    <span>${totalKids}</span>
                </div>
            </div>

            <div class="mt-6">
                 <div class="report-section-title">Detalle Menús</div>
                 ${menuHTML}
            </div>
        `;
    }

    const modal = document.getElementById('admin-report-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex'; // Forzar flex para centrado
    }
};

window.closeAdminReport = () => {
    const modal = document.getElementById('admin-report-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
};



// --- CARGA INICIAL DE CONFIGURACIÓN ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const snap = await getDoc(doc(db, 'eventos', EVENT_ID, 'settings', 'menu'));
        if (snap.exists()) {
            menuSettingsData = snap.data();
        } else {
            // Config default si no existe en db
            menuSettingsData = { enabled: true };
        }
        window.updateMenuModeUI(); // UI Admin
        window.updateMenuVisibility(); // UI Cliente
    } catch (err) {
        console.warn("Error cargando config menú:", err);
    }
});

// ==========================================
// 🔐 SISTEMA DE ACCESO SECRETO AL PANEL ADMIN
// ==========================================
let pinBuffer = '';
let pinTimeout = null;
const keyboardSound = new Audio('assets/audio/mech_keyboard.mp3');

window.initSecretAdminAccess = () => {
    console.log("🔐 Acceso secreto activado. Introduce el PIN...");

    // Resetear buffer
    pinBuffer = '';

    // Crear overlay de PIN si no existe
    let pinModal = document.getElementById('secret-pin-modal');
    if (!pinModal) {
        pinModal = document.createElement('div');
        pinModal.id = 'secret-pin-modal';
        pinModal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); z-index: 99999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px);">
                <div style="background: linear-gradient(135deg, #064e3b 0%, #047857 100%); padding: 40px; border-radius: 24px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); text-align: center; max-width: 400px; border: 2px solid rgba(255,255,255,0.1);">
                    <div style="font-size: 48px; margin-bottom: 20px;">🔐</div>
                    <h2 style="color: white; font-size: 24px; margin-bottom: 10px; font-weight: bold;">Panel de Administración</h2>
                    <p style="color: rgba(255,255,255,0.7); font-size: 14px; margin-bottom: 30px;">Introduce el PIN de 4 dígitos</p>
                    <div id="pin-display" style="display: flex; gap: 12px; justify-content: center; margin-bottom: 30px;">
                        <div class="pin-dot" style="width: 20px; height: 20px; border-radius: 50%; background: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.4);"></div>
                        <div class="pin-dot" style="width: 20px; height: 20px; border-radius: 50%; background: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.4);"></div>
                        <div class="pin-dot" style="width: 20px; height: 20px; border-radius: 50%; background: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.4);"></div>
                        <div class="pin-dot" style="width: 20px; height: 20px; border-radius: 50%; background: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.4);"></div>
                    </div>
                    <p id="pin-error" style="color: #ff6b6b; font-size: 14px; min-height: 20px; margin-bottom: 20px;"></p>
                    <button onclick="window.closeSecretPinModal()" style="background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); padding: 12px 24px; border-radius: 12px; cursor: pointer; font-size: 14px; transition: all 0.3s;">
                        Cancelar
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(pinModal);
    }

    pinModal.style.display = 'block';

    // Listener de teclado
    document.addEventListener('keydown', handlePinInput);
};

const handlePinInput = (e) => {
    // Solo números del 0-9
    if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();

        // Reproducir sonido de teclado
        keyboardSound.currentTime = 0;
        keyboardSound.volume = 0.3;
        keyboardSound.play().catch(() => { });

        // Añadir dígito al buffer
        if (pinBuffer.length < 4) {
            pinBuffer += e.key;
            updatePinDisplay();

            // Si ya tenemos 4 dígitos, validar
            if (pinBuffer.length === 4) {
                setTimeout(() => validatePin(), 300);
            }
        }
    }

    // Permitir borrar con Backspace
    if (e.key === 'Backspace' && pinBuffer.length > 0) {
        e.preventDefault();
        pinBuffer = pinBuffer.slice(0, -1);
        updatePinDisplay();
    }

    // Cancelar con Escape
    if (e.key === 'Escape') {
        e.preventDefault();
        window.closeSecretPinModal();
    }
};

const updatePinDisplay = () => {
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach((dot, index) => {
        if (index < pinBuffer.length) {
            dot.style.background = '#10b981';
            dot.style.borderColor = '#10b981';
            dot.style.transform = 'scale(1.2)';
            setTimeout(() => {
                dot.style.transform = 'scale(1)';
            }, 150);
        } else {
            dot.style.background = 'rgba(255,255,255,0.2)';
            dot.style.borderColor = 'rgba(255,255,255,0.4)';
        }
    });
};

const validatePin = async () => {
    try {
        // Obtener el PIN correcto de Firebase
        const pinDoc = await getDoc(doc(db, 'eventos', EVENT_ID, 'settings', 'admin'));
        const correctPin = pinDoc.exists() ? pinDoc.data().pin : '1234'; // PIN por defecto

        if (pinBuffer === correctPin) {
            // ✅ PIN CORRECTO
            const errorEl = document.getElementById('pin-error');
            if (errorEl) {
                errorEl.textContent = '✅ Acceso concedido';
                errorEl.style.color = '#10b981';
            }

            setTimeout(() => {
                window.closeSecretPinModal();
                window.openAdminPanel();
            }, 500);
        } else {
            // ❌ PIN INCORRECTO
            const errorEl = document.getElementById('pin-error');
            if (errorEl) {
                errorEl.textContent = '❌ PIN incorrecto';
                errorEl.style.color = '#ff6b6b';
            }

            // Shake animation
            const modal = document.querySelector('#secret-pin-modal > div > div');
            if (modal) {
                modal.style.animation = 'shake 0.5s';
                setTimeout(() => {
                    modal.style.animation = '';
                }, 500);
            }

            // Resetear después de 1 segundo
            setTimeout(() => {
                pinBuffer = '';
                updatePinDisplay();
                if (errorEl) errorEl.textContent = '';
            }, 1000);
        }
    } catch (error) {
        console.error("Error validando PIN:", error);
        const errorEl = document.getElementById('pin-error');
        if (errorEl) {
            errorEl.textContent = '⚠️ Error de conexión';
        }
    }
};

window.closeSecretPinModal = () => {
    const modal = document.getElementById('secret-pin-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    pinBuffer = '';
    document.removeEventListener('keydown', handlePinInput);
};

window.openAdminPanel = () => {
    const adminPanel = document.getElementById('admin-panel');
    if (adminPanel) {
        adminPanel.classList.remove('hidden');
        adminPanel.style.display = 'flex';
        adminPanel.scrollIntoView({ behavior: 'smooth' });

        // Cargar datos del admin
        if (window.loadAdminData) {
            window.loadAdminData();
        }
    }
};

// Añadir estilos de animación shake
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
        20%, 40%, 60%, 80% { transform: translateX(10px); }
    }
`;
document.head.appendChild(shakeStyle);
