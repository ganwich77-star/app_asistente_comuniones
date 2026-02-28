import { db, auth } from './firebase_init.js';
import { doc, getDoc, collection, query, where, getDocs, orderBy, updateDoc, collectionGroup } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { config } from './config.js';

// Sistema de Notificaciones Premium (Toast)
function showPremiumToast(message, type = 'success') {
    // Eliminar toasts previos del mismo tipo para no saturar
    const oldToast = document.getElementById('premium-toast');
    if (oldToast) oldToast.remove();

    const toast = document.createElement('div');
    toast.id = 'premium-toast';

    let icon = 'check_circle';
    let borderColor = 'border-primary/50';
    let bgColor = 'bg-[#1A2721]/90';
    let iconColor = 'text-primary';

    if (type === 'error') {
        icon = 'error_outline';
        borderColor = 'border-red-500/50';
        bgColor = 'bg-red-950/90';
        iconColor = 'text-red-400';
    } else if (type === 'warning') {
        icon = 'warning_amber';
        borderColor = 'border-amber-500/50';
        bgColor = 'bg-amber-950/90';
        iconColor = 'text-amber-400';
    }

    toast.className = `fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3 ${bgColor} ${borderColor} border backdrop-blur-md px-6 py-4 rounded-2xl shadow-2xl transform translate-y-20 opacity-0 transition-all duration-500 ease-out pointer-events-auto cursor-pointer`;

    // Limpiar emojis del mensaje original de los alerts
    const cleanMsg = message.replace(/[✅❌⚠️] /g, '');

    toast.innerHTML = `
        <span class="material-icons-outlined ${iconColor}">${icon}</span>
        <span class="text-white text-xs font-bold uppercase tracking-widest">${cleanMsg}</span>
    `;

    document.body.appendChild(toast);

    // Animación de entrada
    setTimeout(() => {
        toast.classList.remove('translate-y-20', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');
    }, 50);

    // Auto-eliminación
    const timer = setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => toast.remove(), 500);
    }, 3500);

    toast.onclick = () => {
        clearTimeout(timer);
        toast.remove();
    };
}

// Elementos del DOM (Solo Auth y Layout)
const modalLegal = document.getElementById('legal-modal');
const btnAcceptLegal = document.getElementById('accept-legal');
const legalCheckbox = document.getElementById('legal-checkbox-main');
const modalLogin = document.getElementById('login-modal');
const btnLoginSubmit = document.getElementById('btn-login-submit');
const inputLoginUser = document.getElementById('login-user');
const inputLoginPass = document.getElementById('login-pass');
const mainWrapper = document.getElementById('main-content-wrapper');
const eventsGrid = document.getElementById('events-grid');
const eventsCountStr = document.querySelector('span.text-xs.font-bold.text-gray-500.uppercase.tracking-widest');
const btnDownloadExcel = document.getElementById('btn-download-excel');
const txtDownloadExcel = document.getElementById('txt-download-excel');
const searchContainer = document.getElementById('search-container');
const searchInput = document.getElementById('event-search-input');
const btnToggleSearch = document.getElementById('btn-toggle-search');

let USER_ID = '';
let LOADED_EVENTS = [];
let isMaster = false;
let sortDesc = true;
let currentSort = 'recent'; // recent, oldest, name_asc
let currentView = 'grid'; // grid, list

// 1. Detectar ID de la URL (?f=id) para personalización (opcional)
const params = new URLSearchParams(window.location.search);
let PHOTO_ID_URL = params.get('f');

// --- FUNCIONES LEGALES ---
window.showPrivacyPolicyModal = () => {
    const modal = document.getElementById('privacy-policy-modal');
    if (modal) modal.style.display = 'flex';
};
window.closePrivacyPolicyModal = () => {
    const modal = document.getElementById('privacy-policy-modal');
    if (modal) modal.style.display = 'none';
};
window.showTermsModal = () => {
    const modal = document.getElementById('terms-modal');
    if (modal) modal.style.display = 'flex';
};
window.closeTermsModal = () => {
    const modal = document.getElementById('terms-modal');
    if (modal) modal.style.display = 'none';
};

// --- LÓGICA MODAL LEGAL Y LOGIN ---
if (btnAcceptLegal && modalLegal && legalCheckbox) {
    legalCheckbox.addEventListener('change', () => {
        if (legalCheckbox.checked) {
            btnAcceptLegal.disabled = false;
            btnAcceptLegal.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            btnAcceptLegal.disabled = true;
            btnAcceptLegal.classList.add('opacity-50', 'cursor-not-allowed');
        }
    });

    btnAcceptLegal.addEventListener('click', () => {
        modalLegal.style.display = 'none';
        modalLogin.classList.remove('hidden');
        modalLogin.classList.add('flex');
    });
}

// FUNCIÓN PARA GENERAR SLUG (Mismo que en registro)
function generateSlug(name) {
    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
}

if (btnLoginSubmit) {
    btnLoginSubmit.addEventListener('click', async () => {
        const userRaw = inputLoginUser.value.trim();
        const pass = inputLoginPass.value.trim();

        if (!userRaw || !pass) {
            return showPremiumToast("Por favor, introduce usuario y contraseña.", "warning");
        }

        const userSlug = generateSlug(userRaw);

        // 1. Acceso Maestro (ADMIN)
        if ((userRaw.toLowerCase() === 'admin' || userRaw.toLowerCase() === 'pujaltefotografia') && pass === '11111111') {
            return unlockPanel('pujaltefotografia', true);
        }

        // 2. Acceso por Fotógrafo (Búsqueda por Slug)
        const targetId = PHOTO_ID_URL || userSlug;

        try {
            const snap = await getDoc(doc(db, "fotografos", targetId));
            if (snap.exists()) {
                const data = snap.data();

                // La contraseña son los 8 primeros dígitos del DNI (fiscalId)
                const dbPass = (data.fiscalId || '').replace(/[^0-9]/g, '').slice(0, 8);

                if (pass === dbPass) {
                    return unlockPanel(targetId, false);
                } else {
                    showPremiumToast("Contraseña incorrecta (DNI).", "error");
                }
            } else {
                showPremiumToast("No se encontró ningún fotógrafo con ese nombre comercial.", "warning");
            }
        } catch (e) {
            console.error("Error en login:", e);
            showPremiumToast("Error de conexión con la base de datos.", "error");
        }
    });
}

function unlockPanel(photographerId, isMaster = false) {
    USER_ID = photographerId;
    modalLogin.style.display = 'none';
    modalLogin.classList.remove('flex');
    modalLogin.classList.add('hidden');

    mainWrapper.classList.remove('hidden');
    setTimeout(() => {
        mainWrapper.classList.remove('opacity-0');
        mainWrapper.classList.add('opacity-100');
    }, 100);

    window.scrollTo({ top: 0, behavior: 'smooth' });

    // No hay selector de sort estático, hemos añadido funcionalidad interactiva abajo.

    // Activar buscador desplegable
    if (btnToggleSearch && searchContainer) {
        btnToggleSearch.addEventListener('click', () => {
            searchContainer.classList.toggle('hidden');
            if (!searchContainer.classList.contains('hidden')) {
                searchInput.focus();
            } else {
                searchInput.value = '';
                filterEventsGrid('');
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterEventsGrid(e.target.value);
        });
    }

    const sortSelector = document.getElementById('sort-selector');
    if (sortSelector) {
        sortSelector.addEventListener('change', (e) => {
            currentSort = e.target.value;
            filterEventsGrid(searchInput ? searchInput.value : '');
        });
    }

    const btnViewGrid = document.getElementById('view-grid');
    const btnViewList = document.getElementById('view-list');

    if (btnViewGrid && btnViewList) {
        btnViewGrid.addEventListener('click', () => {
            currentView = 'grid';
            btnViewGrid.className = 'w-8 h-8 rounded-md bg-primary text-black flex items-center justify-center transition-all';
            btnViewList.className = 'w-8 h-8 rounded-md text-primary hover:bg-primary/20 flex items-center justify-center transition-all';
            filterEventsGrid(searchInput ? searchInput.value : '');
        });

        btnViewList.addEventListener('click', () => {
            currentView = 'list';
            btnViewList.className = 'w-8 h-8 rounded-md bg-primary text-black flex items-center justify-center transition-all';
            btnViewGrid.className = 'w-8 h-8 rounded-md text-primary hover:bg-primary/20 flex items-center justify-center transition-all';
            filterEventsGrid(searchInput ? searchInput.value : '');
        });
    }

    // Cargar y mostrar eventos y la info del panel de whatsapp/perfil
    loadEvents(USER_ID, isMaster);
    loadPhotographerPrefs(USER_ID);
}

// LÓGICA DE MENSAJE PERSONALIZADO Y LOGO INTELIGENTE
function getDefaultWAMsg() {
    return `¡Ya lo tenéis listo! 🚀 Podéis descubrir el regalo de {{NOMBRE}} aquí: 🔗 {{URL}}`;
}

function getDefaultWAMsgForm() {
    return `¡Hola! 👋✨ Reserva un momento para completar los datos de vuestro evento aquí: 🔗 {{URL}}`;
}

function getDefaultWAMsgExtra() {
    return `¡Hola! 👋 ¿Podríais confirmarme estos detalles para que todo salga perfecto? 🔗 {{URL}}`;
}

function setSmartLogoBackground(imgUrl) {
    const logoContainer = document.getElementById('smart-logo-container');
    const photogLogo = document.getElementById('photographer-logo');

    if (!logoContainer || !photogLogo || !imgUrl) return;

    photogLogo.src = imgUrl;

    photogLogo.onload = () => {
        logoContainer.classList.remove('hidden');
        logoContainer.classList.add('flex');
    };
}

async function loadPhotographerPrefs(userId) {
    const waTextarea = document.getElementById('custom-wa-msg-panel');
    try {
        const snap = await getDoc(doc(db, "fotografos", userId));
        if (snap.exists()) {
            const data = snap.data();
            // WhatsApp Msgs
            const waForm = document.getElementById('custom-wa-msg-panel-form');
            const waExtra = document.getElementById('custom-wa-msg-panel-extra');
            const discountInput = document.getElementById('discount-percentage-input');

            if (waTextarea) {
                waTextarea.value = data.waTemplate || getDefaultWAMsg();
            }
            if (waForm) {
                waForm.value = data.waTemplateForm || getDefaultWAMsgForm();
            }
            if (waExtra) {
                waExtra.value = data.waTemplateExtra || getDefaultWAMsgExtra();
            }
            if (discountInput) {
                discountInput.value = data.giftDiscount || data.discountPercentage || "10";
            }

            // Logo
            const logoToUse = data.logo || data.logo_url || data.logoUrl;
            if (logoToUse) {
                setSmartLogoBackground(logoToUse);
            }

            // Lema
            // Lema a prueba de caché estricta de HTML
            const combinedLema = data.slogan || data.lema;
            if (combinedLema) {
                let lemaElem = document.getElementById('photographer-lema');
                const textLogo = document.getElementById('text-logo');

                if (!lemaElem && textLogo) {
                    // Injecting dynamically in case of old HTML local caching
                    lemaElem = document.createElement('p');
                    lemaElem.id = 'photographer-lema';
                    lemaElem.className = 'text-xs text-primary/70 italic tracking-widest mt-1';

                    // Si el cache del user no tiene el wrapper col que le pusimos, se lo creamos
                    if (!textLogo.parentNode.classList.contains('flex-col')) {
                        const wrapper = document.createElement('div');
                        wrapper.className = 'flex flex-col justify-center';
                        textLogo.parentNode.insertBefore(wrapper, textLogo);
                        wrapper.appendChild(textLogo);
                        // Remover margen inferior si lo tuviera para alinear a ras, e inyectar
                        textLogo.classList.remove('leading-none');
                        textLogo.classList.add('leading-none');
                        wrapper.appendChild(lemaElem);
                    } else {
                        textLogo.parentNode.insertBefore(lemaElem, textLogo.nextSibling);
                    }
                }

                if (lemaElem) {
                    lemaElem.innerText = `"${combinedLema}"`;
                    lemaElem.classList.remove('hidden');
                }
            }
        } else {
            if (waTextarea) waTextarea.value = getDefaultWAMsg();
        }
    } catch (e) {
        console.error(e);
        if (waTextarea) waTextarea.value = getDefaultWAMsg();
    }
}

window.saveCustomWAPanel = async () => {
    const waTextarea = document.getElementById('custom-wa-msg-panel');
    if (!waTextarea || !USER_ID) return;
    try {
        await updateDoc(doc(db, "fotografos", USER_ID), { waTemplate: waTextarea.value.trim() });
        showPremiumToast("Mensaje guardado correctamente.");
    } catch (e) { showPremiumToast("Error al guardar el mensaje.", "error"); }
};

window.saveCustomWAPanelForm = async () => {
    const waTextarea = document.getElementById('custom-wa-msg-panel-form');
    if (!waTextarea || !USER_ID) return;
    try {
        await updateDoc(doc(db, "fotografos", USER_ID), { waTemplateForm: waTextarea.value.trim() });
        showPremiumToast("Mensaje de formulario guardado.");
    } catch (e) { showPremiumToast("Error al guardar el mensaje.", "error"); }
};

window.saveCustomWAPanelExtra = async () => {
    const waTextarea = document.getElementById('custom-wa-msg-panel-extra');
    if (!waTextarea || !USER_ID) return;
    try {
        await updateDoc(doc(db, "fotografos", USER_ID), { waTemplateExtra: waTextarea.value.trim() });
        showPremiumToast("Mensaje recordatorio guardado.");
    } catch (e) { showPremiumToast("Error al guardar el mensaje.", "error"); }
};

window.saveDiscountPercentage = async () => {
    const discountInput = document.getElementById('discount-percentage-input');
    if (!discountInput || !USER_ID) return;
    try {
        await updateDoc(doc(db, "fotografos", USER_ID), { giftDiscount: discountInput.value.trim() });
        showPremiumToast("Porcentaje de descuento actualizado.");
        window.closeDiscountModal();
    } catch (e) { showPremiumToast("Error al guardar el descuento.", "error"); }
};

// Modales
window.openDiscountModal = () => document.getElementById('discount-modal')?.classList.replace('hidden', 'flex');
window.closeDiscountModal = () => document.getElementById('discount-modal')?.classList.replace('flex', 'hidden');
window.openShareFormModal = () => document.getElementById('share-form-modal')?.classList.replace('hidden', 'flex');
window.closeShareFormModal = () => document.getElementById('share-form-modal')?.classList.replace('flex', 'hidden');

let selectedWAMessageType = 'form';
window.selectWAMessage = (type) => {
    selectedWAMessageType = type;
    ['form', 'app', 'extra'].forEach(t => {
        const btn = document.getElementById(`wa-btn-select-${t}`);
        if (btn) {
            btn.classList.remove('bg-sky-600/10', 'border-sky-600/30', 'ring-2', 'ring-sky-500/50', 'border-2');
            btn.classList.add('bg-white/5', 'border-white/10');
        }
    });
    const target = document.getElementById(`wa-btn-select-${type}`);
    if (target) {
        target.classList.remove('bg-white/5', 'border-white/10');
        target.classList.add('bg-sky-600/10', 'border-sky-600/30', 'ring-2', 'ring-sky-500/50', 'border-2');
    }
};

window.sendWAMessageSelected = () => {
    const phoneInput = document.getElementById('wa-target-phone');
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const baseUrl = window.location.origin + window.location.pathname.replace('acceso_fotografo.html', '');
    const formUrl = `${baseUrl}datos_evento.html?f=${USER_ID}`;

    let template = "";
    if (selectedWAMessageType === 'form') template = document.getElementById('custom-wa-msg-panel-form').value;
    else if (selectedWAMessageType === 'app') template = document.getElementById('custom-wa-msg-panel').value;
    else template = document.getElementById('custom-wa-msg-panel-extra').value;

    const message = template.replace(/{{URL}}/g, formUrl).replace(/{{NOMBRE}}/g, 'familia');
    const finalPhone = phone.replace(/\s+/g, '').replace('+', '');
    window.open(`https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodeURIComponent(message)}`, '_blank');
};

// polyfill simple
window.jQuerySelectorContains = function (text) { return null; }; // Ignorar

async function loadEvents(photographerId, isMaster) {
    if (!eventsGrid) return;
    eventsGrid.innerHTML = '<p class="text-xs text-primary/60 col-span-2 text-center py-10 uppercase tracking-widest">Cargando eventos...</p>';

    try {
        let q;
        if (isMaster) {
            q = collection(db, "eventos");
        } else {
            q = query(collection(db, "eventos"), where("photographerId", "==", photographerId));
        }

        const snapshot = await getDocs(q);
        const events = [];
        snapshot.forEach(doc => {
            events.push({ id: doc.id, ...doc.data() });
        });

        if (events.length === 0) {
            eventsGrid.innerHTML = '<p class="text-xs text-gray-400 col-span-2 text-center py-10">No hay eventos disponibles.</p>';
            if (eventsCountStr) eventsCountStr.innerText = '0 Colecciones disponibles';
            return;
        }

        // Guardar todos los eventos internamente (orden inicial por fecha desc)
        const getTs = (val) => {
            if (!val) return 0;
            if (val.seconds) return val.seconds * 1000;
            const pd = Date.parse(val);
            return isNaN(pd) ? 0 : pd;
        };
        events.sort((a, b) => getTs(b.savedAt || b.createdAt || b.eventDate) - getTs(a.savedAt || a.createdAt || a.eventDate));
        LOADED_EVENTS = events;

        // Primera renderización general
        renderEventsGrid(events);

        // Actualizar contador visual de leads en segundo plano
        updateLeadsCounter();

    } catch (e) {
        console.error("Error loading events: ", e);
        eventsGrid.innerHTML = '<p class="text-xs text-red-500 col-span-2 text-center py-10">Error cargando eventos.</p>';
    }
}

function filterEventsGrid(query) {
    const q = (query || '').toLowerCase().trim();
    let filtered = LOADED_EVENTS;

    if (q) {
        filtered = LOADED_EVENTS.filter(ev => {
            const name = `${ev.photagonistName || ev.protagonistName || ''} ${ev.protagonistLastName || ''}`.toLowerCase();
            const date = (ev.eventDate || '').toLowerCase();
            let dateTranslated = '';
            if (ev.eventDate) {
                try {
                    dateTranslated = new Date(ev.eventDate).toLocaleDateString("es-ES", { year: 'numeric', month: 'long', day: 'numeric' }).toLowerCase();
                } catch (e) { }
            }
            const ceremony = (ev.ceremonyPlace || '').toLowerCase();
            const banquet = (ev.banquetPlace || '').toLowerCase();

            return name.includes(q) || date.includes(q) || dateTranslated.includes(q) || ceremony.includes(q) || banquet.includes(q);
        });
    }

    let sorted = [...filtered];

    const getTimestamp = (val) => {
        if (!val) return 0;
        if (val.seconds) return val.seconds * 1000; // Firebase timestamp
        const parsed = Date.parse(val);
        return isNaN(parsed) ? 0 : parsed;
    };

    if (currentSort === 'recent') {
        sorted.sort((a, b) => {
            const timeA = getTimestamp(a.savedAt || a.createdAt || a.eventDate);
            const timeB = getTimestamp(b.savedAt || b.createdAt || b.eventDate);
            return timeB - timeA;
        });
    } else if (currentSort === 'oldest') {
        sorted.sort((a, b) => {
            const timeA = getTimestamp(a.savedAt || a.createdAt || a.eventDate);
            const timeB = getTimestamp(b.savedAt || b.createdAt || b.eventDate);
            return timeA - timeB;
        });
    } else if (currentSort === 'name_asc') {
        sorted.sort((a, b) => {
            const nameA = `${a.photagonistName || a.protagonistName || ''} ${a.protagonistLastName || ''}`.trim().toLowerCase();
            const nameB = `${b.photagonistName || b.protagonistName || ''} ${b.protagonistLastName || ''}`.trim().toLowerCase();
            return nameA.localeCompare(nameB);
        });
    }

    renderEventsGrid(sorted);
}

function renderEventsGrid(events) {
    if (events.length === 0) {
        eventsGrid.innerHTML = '<p class="text-xs text-primary/40 col-span-2 text-center py-10">No se encontraron eventos con esa búsqueda.</p>';
        const mainCountStr = document.getElementById('events-count-str') || eventsCountStr;
        if (mainCountStr) mainCountStr.innerText = '0 Colecciones disponibles';
        const badgeExcel = document.getElementById('badge-excel');
        if (badgeExcel) badgeExcel.innerText = '0';
        if (txtDownloadExcel) txtDownloadExcel.innerHTML = 'Descargar<br>Eventos';
        return;
    }

    const mainCountStr = document.getElementById('events-count-str') || eventsCountStr;
    if (mainCountStr) mainCountStr.innerText = `${events.length} Colecci${events.length === 1 ? 'ón' : 'ones'} disponible${events.length === 1 ? '' : 's'}`;
    const badgeExcel = document.getElementById('badge-excel');
    if (badgeExcel) badgeExcel.innerText = events.length.toString();
    if (txtDownloadExcel) txtDownloadExcel.innerHTML = 'Descargar<br>Eventos';

    if (currentView === 'list') {
        eventsGrid.className = 'flex flex-col gap-4';
    } else {
        eventsGrid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6';
    }

    let html = '';
    events.forEach(event => {
        const covPhoto1 = event.introFoto1 || event.foto1 || 'assets/images/new_logo_blanco.png';
        const covPhoto2 = event.introFoto2 || event.foto2 || 'assets/images/new_logo_blanco.png';
        const covPhoto3 = event.introFoto3 || event.foto3 || 'assets/images/new_logo_blanco.png';
        const eventDate = event.eventDate ? new Date(event.eventDate).toLocaleDateString("es-ES", { year: 'numeric', month: 'long', day: 'numeric' }) : 'Fecha desconocida';
        const realName = event.photagonistName || event.protagonistName || 'Evento';
        const lastName = event.protagonistLastName || '';
        const contactName = event.parentName || event.contactName || 'Desconocido';
        const phone = event.parentPhone || event.phone || event.whatsapp || '';

        if (currentView === 'list') {
            html += `
                <div class="bg-card-dark border border-primary/20 rounded-3xl p-4 hover:border-primary/50 transition-all flex items-center justify-between group w-full gap-4 relative overflow-hidden">
                    <div class="flex items-center gap-4 flex-1">
                        <div class="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-black">
                            <img src="${covPhoto1}" class="w-full h-full object-cover">
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-1">
                                <h3 class="font-display text-lg text-primary truncate">${realName} ${lastName}</h3>
                                ${event.status === 'unread' ? `<span class="bg-primary text-black text-[8px] font-black px-1.5 py-0.5 rounded shadow-lg uppercase tracking-tighter shrink-0">NUEVO</span>` : ''}
                            </div>
                            <p class="text-[10px] text-gray-400 mb-1 flex items-center gap-1"><span class="material-icons-outlined text-[10px]">person</span> ${contactName} | <span class="material-icons-outlined text-[10px]">calendar_today</span> ${eventDate}</p>
                            <div class="flex items-center gap-2 mt-2">
                                <button type="button" onclick="window.sendWAPanel('${event.id}')" class="flex items-center gap-1 bg-[#1A2721] text-[#25D366] hover:text-black hover:bg-[#25D366] text-[9px] px-3 py-1.5 rounded-lg border border-[#1A5C38] transition-colors">
                                    <span class="material-icons-outlined text-[12px]">smartphone</span> WhatsApp
                                </button>
                                <button type="button" onclick="window.location.href='creador_eventos.html?e=${event.id}&c=eventos'" class="flex items-center gap-1 bg-[#2D2A1A] text-primary hover:text-black hover:bg-primary text-[9px] px-3 py-1.5 rounded-lg border border-[#7A6A24] transition-colors">
                                    <span class="material-icons-outlined text-[12px]">edit</span> Editar
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="bg-black border border-primary/30 rounded-xl p-3 shrink-0 lg:w-[420px] flex flex-col justify-center">
                        <p class="text-[8px] text-primary font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1"><span class="material-icons-outlined text-[10px]">language</span> URL APP</p>
                        <div class="flex items-center gap-2">
                            <input type="text" readonly value="https://apps.pujaltefotografia.es/index.html?id=${event.id}" 
                                class="w-full bg-transparent border-none text-gray-300 text-[10px] p-0 focus:ring-0 truncate cursor-text pointer-events-auto">
                            <button type="button" onclick="window.copyToClipboardPremium('https://apps.pujaltefotografia.es/index.html?id=${event.id}', this)" class="text-primary hover:text-primary/70 transition-colors bg-[#1A1810] p-1.5 rounded-lg border border-primary/20 shrink-0">
                                <span class="material-icons-outlined text-[14px]">content_copy</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Grid original
            html += `
                <div class="bg-card-dark border border-primary/20 rounded-3xl p-5 hover:border-primary/50 transition-all flex flex-col justify-between group relative w-full h-full min-h-[350px]">
                    <div>
                        <!-- Nombre y estado -->
                        <div class="flex justify-between items-start mb-2">
                            <h3 class="font-display text-xl text-primary truncate pr-2">${realName} ${lastName}</h3>
                            ${event.status === 'unread' ? `<span class="bg-primary text-black text-[9px] font-black px-2 py-1 rounded shadow-lg uppercase tracking-tighter shrink-0">NUEVO</span>` : ''}
                        </div>

                        <!-- Contacto / Fecha -->
                        <p class="text-xs text-gray-400 mb-1 flex items-center gap-1"><span class="material-icons-outlined text-[12px]">person</span> Contacto:  <strong class="text-white ml-1">${contactName}</strong></p>
                        <p class="text-xs text-gray-400 mb-4 flex items-center gap-1"><span class="material-icons-outlined text-[12px]">calendar_today</span> ${eventDate}</p>

                        <!-- Botones -->
                        <div class="grid grid-cols-2 gap-3 mb-6 mt-2">
                            <button type="button" onclick="window.sendWAPanel('${event.id}')" class="flex items-center justify-center gap-2 bg-[#1A2721] border border-[#1A5C38] hover:bg-[#25D366] text-[#25D366] hover:text-black rounded-xl py-3 transition-all">
                                <span class="material-icons-outlined text-[16px]">smartphone</span>
                                <span class="text-[10px] font-bold uppercase tracking-[0.1em]">WhatsApp</span>
                            </button>
                            <button type="button" onclick="window.location.href='creador_eventos.html?e=${event.id}&c=eventos'" class="flex items-center justify-center gap-2 bg-[#2D2A1A] border border-[#7A6A24] hover:bg-primary hover:text-black text-primary rounded-xl py-3 transition-all">
                                <span class="material-icons-outlined text-[16px]">edit</span>
                                <span class="text-[10px] font-bold uppercase tracking-[0.1em]">Editar</span>
                            </button>
                        </div>

                        <!-- Fotos (3 cols x 1 row) aspecto cuadrado -->
                        <div class="grid grid-cols-3 gap-2 mb-6">
                            <div class="aspect-square rounded-xl overflow-hidden bg-black/50 border border-white/5 cursor-pointer" onclick="window.open('index.html?id=${event.id}', '_blank')">
                                <img src="${covPhoto1}" class="w-full h-full object-cover opacity-80 hover:opacity-100 hover:scale-110 transition-all">
                            </div>
                            <div class="aspect-square rounded-xl overflow-hidden bg-black/50 border border-white/5 cursor-pointer" onclick="window.open('index.html?id=${event.id}', '_blank')">
                                <img src="${covPhoto2}" class="w-full h-full object-cover opacity-80 hover:opacity-100 hover:scale-110 transition-all">
                            </div>
                            <div class="aspect-square rounded-xl overflow-hidden bg-black/50 border border-white/5 cursor-pointer" onclick="window.open('index.html?id=${event.id}', '_blank')">
                                <img src="${covPhoto3}" class="w-full h-full object-cover opacity-80 hover:opacity-100 hover:scale-110 transition-all">
                            </div>
                        </div>
                    </div>

                    <!-- URL abajo siempre fijo -->
                    <div class="bg-black border border-primary/30 rounded-xl p-4 mt-auto">
                        <p class="text-[8px] text-primary font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5"><span class="material-icons-outlined text-[12px]">language</span> URL DE LA APP</p>
                        <div class="flex items-center gap-3">
                            <input type="text" readonly value="https://apps.pujaltefotografia.es/index.html?id=${event.id}" 
                                class="w-full bg-transparent border-none text-gray-300 text-[11px] p-0 focus:ring-0 truncate cursor-text pointer-events-auto">
                            <button type="button" onclick="window.copyToClipboardPremium('https://apps.pujaltefotografia.es/index.html?id=${event.id}', this)" class="text-primary hover:text-primary/70 transition-colors bg-[#1A1810] p-2.5 rounded-lg border border-primary/20 shrink-0 flex items-center justify-center hover:bg-primary/20">
                                <span class="material-icons-outlined text-[16px]">content_copy</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
    });
    eventsGrid.innerHTML = html;
}

// Global functions for events
window.copyToClipboardPremium = async (url, btnElement) => {
    try {
        await navigator.clipboard.writeText(url);
        const icon = btnElement.querySelector('span');
        const oldText = icon.textContent;
        icon.textContent = 'check';
        btnElement.classList.replace('text-primary', 'text-[#25D366]');
        btnElement.classList.add('bg-[#25D366]/20');
        setTimeout(() => {
            icon.textContent = oldText;
            btnElement.classList.replace('text-[#25D366]', 'text-primary');
            btnElement.classList.remove('bg-[#25D366]/20');
        }, 2000);
    } catch (e) {
        console.error("No se pudo copiar", e);
    }
};

window.sendWAPanel = (eventId) => {
    const event = LOADED_EVENTS.find(e => e.id === eventId);
    if (!event) return;

    const phone = event.parentPhone || event.phone || event.whatsapp || event.tel || event.telefono || '';
    const protagonistName = event.photagonistName || event.protagonistName || event.nombre || 'Familia';
    if (!phone) {
        showPremiumToast("Este evento no tiene teléfono registrado.", "warning");
        return;
    }
    const waTextarea = document.getElementById('custom-wa-msg-panel');
    let template = waTextarea ? waTextarea.value.trim() : "";

    // Fallback: si está vacío, usar el default
    if (!template) {
        template = `"Solo para vosotros" ✨\n\n¡Hola, familia! 👋✨\n\nComo clientes VIP sois los primeros en estrenar el regalo exclusivo de este año: algo único, personal y tecnológico que he reservado solo para vosotros. 🎁💎\n\n¡Ya lo tenéis listo! 🚀\n\nPodéis descubrir el regalo de {{NOMBRE}} aquí: 🔗 {{URL}}\n\n¡Espero que lo disfrutéis muchísimo! 🤗📸`;
    }

    const cleanUrl = `https://apps.pujaltefotografia.es/index.html?id=${eventId}`;
    const message = template
        .replace(/{{NOMBRE}}/g, protagonistName)
        .replace(/{{URL}}/g, cleanUrl);

    const cleanPhone = String(phone).replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 9) {
        showPremiumToast("El número registrado (" + phone + ") no es válido para WhatsApp.", "warning");
        return;
    }
    const finalPhone = cleanPhone.length === 9 ? `34${cleanPhone}` : cleanPhone;

    // 🔥 FIX DEFINITIVO EMOJIS (UTF-8) MAC/SAFARI/IOS 🔥
    // En lugar de concatenar URLs vulnerables a pérdida de charset en la redirección,
    // creamos un formulario oculto y forzamos al navegador a codificar nativamente.
    let form = document.getElementById('wa-hidden-form');
    if (!form) {
        form = document.createElement('form');
        form.id = 'wa-hidden-form';
        form.method = 'GET';
        form.target = '_blank';
        form.action = 'https://api.whatsapp.com/send';
        form.acceptCharset = 'UTF-8';
        form.style.display = 'none';

        const phoneInput = document.createElement('input');
        phoneInput.type = 'hidden';
        phoneInput.name = 'phone';
        phoneInput.id = 'wa-phone-input';

        const textInput = document.createElement('input');
        textInput.type = 'hidden';
        textInput.name = 'text';
        textInput.id = 'wa-text-input';

        form.appendChild(phoneInput);
        form.appendChild(textInput);
        document.body.appendChild(form);
    } else {
        form.target = '_blank';
        form.action = 'https://api.whatsapp.com/send';
    }

    document.getElementById('wa-phone-input').value = finalPhone;
    document.getElementById('wa-text-input').value = message;
    form.submit();
};

// LÓGICA DE DESCARGA DE EXCEL (CSV)
if (btnDownloadExcel) {
    btnDownloadExcel.addEventListener('click', () => {
        if (LOADED_EVENTS.length === 0) {
            showPremiumToast("No hay eventos para descargar.", "warning");
            return;
        }

        // Crear estructura HTML para que Numbers/Excel la interpreten con estilos reales
        let tableHtml = `<html xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8"></head>
<body>
    <table border="1" style="border-collapse: collapse; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; width: 100%;">
        <tr>
            <th style="background-color: #161618; color: #D4AF37; font-weight: bold; padding: 14px 10px; text-align: left; text-transform: uppercase;">NOMBRE PROTAGONISTA</th>
            <th style="background-color: #161618; color: #D4AF37; font-weight: bold; padding: 14px 10px; text-align: left; text-transform: uppercase;">NOMBRE PADRE/MADRE</th>
            <th style="background-color: #161618; color: #D4AF37; font-weight: bold; padding: 14px 10px; text-align: left; text-transform: uppercase;">DNI PADRE/MADRE</th>
            <th style="background-color: #161618; color: #D4AF37; font-weight: bold; padding: 14px 10px; text-align: left; text-transform: uppercase;">TELÉFONO</th>
            <th style="background-color: #161618; color: #D4AF37; font-weight: bold; padding: 14px 10px; text-align: left; text-transform: uppercase;">LUGAR CEREMONIA</th>
            <th style="background-color: #161618; color: #D4AF37; font-weight: bold; padding: 14px 10px; text-align: left; text-transform: uppercase;">HORA CER.</th>
            <th style="background-color: #161618; color: #D4AF37; font-weight: bold; padding: 14px 10px; text-align: left; text-transform: uppercase;">LUGAR BANQUETE</th>
            <th style="background-color: #161618; color: #D4AF37; font-weight: bold; padding: 14px 10px; text-align: left; text-transform: uppercase;">HORA BAN.</th>
        </tr>`;

        LOADED_EVENTS.forEach((ev, index) => {
            const protagonistFullName = `${ev.photagonistName || ''} ${ev.protagonistLastName || ''}`.trim() || 'Desconocido';
            const bgColor = index % 2 === 0 ? '#ffffff' : '#f4f4f5'; // Filas alternas para mejor lectura

            tableHtml += `
        <tr style="background-color: ${bgColor}; border-bottom: 1px solid #e4e4e7;">
            <td style="padding: 10px; color: #18181b;">${protagonistFullName}</td>
            <td style="padding: 10px; color: #18181b;">${ev.parentName || ''}</td>
            <td style="padding: 10px; color: #18181b;">${ev.parentDNI || ''}</td>
            <td style="padding: 10px; color: #18181b;">${ev.parentPhone || ''}</td>
            <td style="padding: 10px; color: #18181b;">${String((ev.ceremonyPlace || '') + " " + (ev.ceremonyLocation || '')).trim()}</td>
            <td style="padding: 10px; color: #18181b;">${ev.ceremonyTime || ''}</td>
            <td style="padding: 10px; color: #18181b;">${String((ev.banquetPlace || '') + " " + (ev.banquetLocation || '')).trim()}</td>
            <td style="padding: 10px; color: #18181b;">${ev.banquetTime || ''}</td>
        </tr>`;
        });

        tableHtml += `
    </table>
</body>
</html>`;

        // Generar Blob como archivo de Excel (.xls basado en HTML)
        const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        // Extensión cambiada a .xls
        link.setAttribute("download", `eventos_registrados_${USER_ID}_${new Date().toISOString().slice(0, 10)}.xls`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}

const btnDownloadLeads = document.getElementById('btn-download-leads');
if (btnDownloadLeads) {
    btnDownloadLeads.addEventListener('click', async () => {
        try {
            // Fetch leads from "leads_regalo" collection where formCode / photographer ID is present
            // In earlier codebase iterations this could vary. We will fetch "leads" and filter by the photographer Id if possible
            btnDownloadLeads.classList.add('opacity-50', 'pointer-events-none');
            const originalText = document.getElementById('txt-download-leads').innerText;
            document.getElementById('txt-download-leads').innerText = "GENERANDO...";

            let finalDocs = [];

            // 1. Leads de todos los eventos (OPTIMIZADO EN PARALELO PARA MÁXIMA VELOCIDAD)
            const eventPromises = LOADED_EVENTS.map(async (ev) => {
                try {
                    const snap = await getDocs(collection(db, 'eventos', ev.id, 'leads_regalo'));
                    snap.forEach(doc => {
                        const data = doc.data();
                        data.eventName = `${ev.photagonistName || ''} ${ev.protagonistLastName || ''}`.trim() || 'Desconocido';
                        finalDocs.push(data);
                    });
                } catch (e) { console.warn("Error leyendo leads de evento", ev.id, e); }
            });

            // Esperar a que TODAS las llamadas de Firebase acaben al unísono
            await Promise.all(eventPromises);

            // 2. Leads atrapados en el "limbo" genérico de la URL principal (Demo / Público)
            try {
                const demoSnap = await getDocs(collection(db, 'eventos', 'demo', 'leads_regalo'));
                demoSnap.forEach(doc => {
                    const data = doc.data();
                    data.eventName = 'App Pública / Visitas Orgánicas de la web';
                    finalDocs.push(data);
                });
            } catch (err) { console.warn("Error leyendo leads de demo", err); }

            // 3. Leads atrapados en 'nora2026' específicamente
            try {
                const noraSnap = await getDocs(collection(db, 'eventos', 'nora2026', 'leads_regalo'));
                noraSnap.forEach(doc => {
                    const data = doc.data();
                    data.eventName = 'Nora 2026';
                    finalDocs.push(data);
                });
            } catch (err) { console.warn("Error leyendo leads de nora2026", err); }

            if (finalDocs.length === 0) {
                showPremiumToast("No hay leads registrados para este estudio.", "info");
                document.getElementById('txt-download-leads').innerText = originalText;
                btnDownloadLeads.classList.remove('opacity-50', 'pointer-events-none');
                return;
            }

            // Generar un Excel igual que el de clientes, con estilos (limpio de BOM para que MAC M1 Numbers lea como HTML real)
            let tableHtml = `<html xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8"></head>
<body>
    <table border="1" style="border-collapse: collapse; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; width: 100%;">
        <tr>
            <th style="background-color: #161618; color: #D4AF37; font-weight: bold; padding: 14px 10px; text-align: left; text-transform: uppercase;">FECHA CAPTURA</th>
            <th style="background-color: #161618; color: #D4AF37; font-weight: bold; padding: 14px 10px; text-align: left; text-transform: uppercase;">NOMBRE CLIENTE</th>
            <th style="background-color: #161618; color: #D4AF37; font-weight: bold; padding: 14px 10px; text-align: left; text-transform: uppercase;">EMAIL</th>
            <th style="background-color: #161618; color: #D4AF37; font-weight: bold; padding: 14px 10px; text-align: left; text-transform: uppercase;">TEL&Eacute;FONO</th>
            <th style="background-color: #161618; color: #D4AF37; font-weight: bold; padding: 14px 10px; text-align: left; text-transform: uppercase;">EVENTO</th>
        </tr>`;

            finalDocs.forEach((lead, index) => {
                const dateStr = lead.createdAt ? new Date(lead.createdAt.seconds * 1000).toLocaleString("es-ES") : (lead.fecha ? new Date(lead.fecha).toLocaleString("es-ES") : '');
                const bgColor = index % 2 === 0 ? '#ffffff' : '#f4f4f5';

                tableHtml += `
        <tr style="background-color: ${bgColor}; border-bottom: 1px solid #e4e4e7;">
            <td style="padding: 10px; color: #18181b;">${dateStr}</td>
            <td style="padding: 10px; color: #18181b;">${lead.nombre || ''}</td>
            <td style="padding: 10px; color: #18181b;">${lead.email || ''}</td>
            <td style="padding: 10px; color: #18181b;">${lead.telefono || lead.phone || ''}</td>
            <td style="padding: 10px; color: #18181b; font-weight: bold;">${lead.eventName || ''}</td>
        </tr>`;
            });

            tableHtml += `
    </table>
</body>
</html>`;

            const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `leads_VIP_${USER_ID}_${new Date().toISOString().slice(0, 10)}.xls`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            document.getElementById('txt-download-leads').innerText = originalText;
            btnDownloadLeads.classList.remove('opacity-50', 'pointer-events-none');
        } catch (e) {
            console.error("Error al descargar leads:", e);
            showPremiumToast("Error al intentar descargar los leads.", "error");
        } finally {
            btnDownloadLeads.classList.remove('opacity-50', 'pointer-events-none');
            document.getElementById('txt-download-leads').innerHTML = "Descargar<br>Leads Regalo";
        }
    });
}

// Calcular y actualizar visualmente el total de leads disponibles
async function updateLeadsCounter() {
    const badgeLeads = document.getElementById('badge-leads');
    if (!badgeLeads) return;

    let totalLeads = 0;

    // 1. Leads de eventos (en paralelo)
    const eventPromises = LOADED_EVENTS.map(async (ev) => {
        try {
            const snap = await getDocs(collection(db, 'eventos', ev.id, 'leads_regalo'));
            totalLeads += snap.size;
        } catch (e) { }
    });

    await Promise.all(eventPromises);

    // 2. Demo
    try {
        const demoSnap = await getDocs(collection(db, 'eventos', 'demo', 'leads_regalo'));
        totalLeads += demoSnap.size;
    } catch (e) { }

    // 3. Nora2026
    try {
        const noraSnap = await getDocs(collection(db, 'eventos', 'nora2026', 'leads_regalo'));
        totalLeads += noraSnap.size;
    } catch (e) { }

    badgeLeads.innerText = totalLeads.toString();
}
