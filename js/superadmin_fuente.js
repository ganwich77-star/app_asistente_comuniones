import { db, storage } from './firebase_init.js';
import { collection, getDocs, getDoc, doc, updateDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { config } from './config.js';

async function loadData() {
    const list = document.getElementById('photographers-list');
    const select = document.getElementById('select-target-photo');
    if (!list) return;
    list.innerHTML = '<p class="col-span-full text-center py-10 opacity-50">Cargando fotógrafos...</p>';

    try {
        // 1. Contar eventos por fotógrafo en todas las colecciones
        const collections = ['eventos', '_internal_temp', 'datos_protagonistas'];
        const counts = {};
        for (const col of collections) {
            const snap = await getDocs(collection(db, col));
            snap.forEach(d => {
                const pid = d.data().photographerId;
                if (pid) counts[pid] = (counts[pid] || 0) + 1;
            });
        }

        // 2. Cargar fotógrafos
        const snap = await getDocs(collection(db, "fotografos"));
        list.innerHTML = '';
        if (select) select.innerHTML = '<option value="">Selecciona un fotógrafo destino...</option>';

        if (snap.empty) {
            list.innerHTML = '<p class="col-span-full text-center py-10 opacity-50">No hay fotógrafos todavía.</p>';
            return;
        }

        // Separar pendientes y aprobados
        const pending = [];
        const approved = [];

        snap.forEach(d => {
            const p = d.data();
            if (p.status === 'pendiente') {
                pending.push({ id: d.id, data: p });
            } else {
                approved.push({ id: d.id, data: p });
            }
        });

        // Mostrar PRIMERO los pendientes
        [...pending, ...approved].forEach(({ id, data: p }) => {
            const totalEvents = counts[id] || 0;
            const pName = p.nombre_comercial || p.name || id;
            const pLogo = p.logo_url || p.logoUrl || 'assets/images/new_lobo_black.webp';
            const isPending = p.status === 'pendiente';

            list.innerHTML += `
            <div class="glass p-8 rounded-3xl flex flex-col items-center text-center group hover:border-emerald-500/50 transition duration-500 ${isPending ? 'border-amber-500/50 bg-amber-500/5' : 'cursor-pointer hover:bg-white/5'} relative overflow-hidden" ${!isPending ? `onclick="openEventsViewer('${id}', '${pName}', '${pLogo}')"` : ''}>
                
                ${isPending ? `
                <div class="absolute top-4 left-4 bg-amber-500 text-black text-[10px] font-black px-3 py-1 rounded-full shadow-xl uppercase tracking-wider animate-pulse">
                    ⏳ Pendiente
                </div>
                ` : totalEvents > 0 ? `
                <div class="absolute top-4 right-4 bg-red-600 text-white text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded-full shadow-xl border-2 border-slate-900 z-10 animate-pulse">
                    ${totalEvents}
                </div>
                ` : ''}

                <div class="w-24 h-24 bg-white/5 rounded-2xl flex items-center justify-center p-4 mb-4 backdrop-blur-sm group-hover:scale-110 transition duration-500">
                    <img src="${pLogo}" class="max-w-full max-h-full object-contain" onerror="this.src='assets/images/new_lobo_black.webp'">
                </div>
                <h3 class="font-bold text-xl mb-1">${pName}</h3>
                <p class="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-2">${id}</p>
                <p class="text-slate-500 text-[10px] mb-6">${p.instagram || ''}</p>
                
                ${isPending ? `
                    <div class="w-full space-y-2">
                        <button onclick="approvePhotographer('${id}', event)" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl text-xs font-black transition shadow-lg shadow-emerald-500/20 uppercase tracking-wider">
                            ✅ APROBAR Y ENVIAR CREDENCIALES
                        </button>
                        <button onclick="showEditModal('${id}')" class="w-full bg-white/10 hover:bg-white/20 text-white py-2 rounded-xl text-xs transition font-bold border border-white/10">
                            📝 REVISAR DATOS
                        </button>
                        <button onclick="deletePhotographer('${id}')" class="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 py-2 rounded-xl text-xs transition font-bold">
                            🗑️ RECHAZAR
                        </button>
                    </div>
                ` : `
                    <div class="w-full space-y-2">
                        <button onclick="copyFormLink('${id}')" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-500/10">🔗 LINK NUEVO CLIENTE</button>
                        <button onclick="openRegistrationForm('${id}')" class="w-full bg-sky-600 hover:bg-sky-500 text-white py-2 rounded-xl text-xs font-bold transition shadow-lg shadow-sky-500/10">📝 COMPLETAR FORMULARIO</button>
                        <button onclick="copyProfileLink('${id}')" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-500/10">👤 LINK MI PERFIL PRO</button>
                        <div class="flex gap-2">
                            <button onclick="showEditModal('${id}')" class="flex-1 bg-white/10 hover:bg-white/20 text-white py-2 rounded-xl text-xs transition font-bold border border-white/10">EDITAR</button>
                            <button onclick="deletePhotographer('${id}')" class="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 py-2 rounded-xl text-xs transition font-bold">ELIMINAR</button>
                        </div>
                    </div>
                `}
            </div>`;

            // Solo añadir al select si está aprobado
            if (select && !isPending) {
                select.innerHTML += `<option value="${id}">${pName} (${id})</option>`;
            }
        });
    } catch (e) { console.error(e); }
}

window.toggleSelectAll = () => {
    const checks = document.querySelectorAll('input[name="event-to-tag"]');
    const btn = document.getElementById('btn-select-all');
    const allChecked = Array.from(checks).every(c => c.checked);

    checks.forEach(c => c.checked = !allChecked);
    btn.innerText = allChecked ? "Seleccionar Todos" : "Desmarcar Todos";
};

let currentViewerEvents = [];

window.openEventsViewer = async (photoId, photoName, photoLogo) => {
    const modal = document.getElementById('events-viewer-modal');
    const grid = document.getElementById('viewer-grid');
    const searchInput = document.getElementById('viewer-search');
    if (searchInput) searchInput.value = '';

    document.getElementById('viewer-photo-name').innerText = photoName;
    document.getElementById('viewer-photo-logo').src = photoLogo || 'assets/images/new_lobo_black.webp';

    grid.innerHTML = '<div class="col-span-full text-center py-20 opacity-50">Buscando eventos creados...</div>';
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    try {
        // SOLO COLECCIÓN EVENTOS (FILTRADO)
        const snap = await getDocs(collection(db, "eventos"));
        currentViewerEvents = [];
        snap.forEach(d => {
            const ev = d.data();
            // Solo si pertenece al fotógrafo Y tiene nombre real Y no es basura de migración
            const isRealEvent = ev.protagonistName && !d.id.includes('MIGRATED_') && !d.id.includes('SUBMISSION_') && !d.id.includes('_');
            if (ev.photographerId === photoId && isRealEvent) {
                currentViewerEvents.push({ ...ev, id: d.id, _col: "eventos" });
            }
        });
        currentViewerEvents.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        renderViewerGrid(currentViewerEvents);
    } catch (e) { console.error(e); }
};

window.openGlobalAppsDirectory = async () => {
    const modal = document.getElementById('events-viewer-modal');
    const grid = document.getElementById('viewer-grid');
    const searchInput = document.getElementById('viewer-search');

    if (searchInput) searchInput.value = '';

    document.getElementById('viewer-photo-name').innerText = "Consola de Despliegue";
    document.getElementById('viewer-photo-logo').src = 'assets/images/new_lobo_black.webp';

    grid.innerHTML = '<div class="col-span-full text-center py-20 opacity-50">Cargando eventos reales...</div>';
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    try {
        const snap = await getDocs(collection(db, "eventos"));
        currentViewerEvents = [];
        snap.forEach(d => {
            const ev = d.data();
            // Limpieza profunda: Excluir migración, submissions brutas y registros sin nombre
            const isBasura = d.id.includes('MIGRATED_') || d.id.includes('SUBMISSION_') || d.id.includes('__');
            if (ev.protagonistName && !isBasura && ev.protagonistName.length > 2) {
                currentViewerEvents.push({ ...ev, id: d.id, _col: "eventos" });
            }
        });
        currentViewerEvents.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        renderViewerGrid(currentViewerEvents);
    } catch (e) { console.error(e); }
};

window.filterViewerSearch = (query) => {
    const q = query.toLowerCase().trim();
    if (!q) {
        renderViewerGrid(currentViewerEvents);
        return;
    }

    const filtered = currentViewerEvents.filter(ev => {
        const name = (ev.protagonistName || '').toLowerCase();
        const id = (ev.id || '').toLowerCase();
        const photographer = (ev.photographerId || '').toLowerCase();
        return name.includes(q) || id.includes(q) || photographer.includes(q);
    });

    renderViewerGrid(filtered);
};

window.generateZipDirect = (id) => {
    if (confirm("Para generar el paquete ZIP, te redirigiremos al Creador con los datos cargados. ¿Continuar?")) {
        window.location.href = `creador_eventos.html?e=${id}&c=eventos`;
    }
};

function renderViewerGrid(events) {
    const grid = document.getElementById('viewer-grid');
    if (events.length === 0) {
        grid.innerHTML = `
        <div class="col-span-full text-center py-20">
            <p class="text-4xl mb-4">📭</p>
            <h3 class="text-xl font-bold">No hay eventos publicados</h3>
        </div>`;
        return;
    }

    grid.innerHTML = events.map(ev => {
        const photos = ev.introPhotos || [];
        const f1 = photos[0] || ev.introFoto1 || ev.foto1 || 'assets/images/new_lobo_black.webp';
        const f2 = photos[1] || ev.introFoto2 || ev.foto2 || 'assets/images/new_lobo_black.webp';
        const f3 = photos[2] || ev.introFoto3 || ev.foto3 || 'assets/images/new_lobo_black.webp';

        const eventUrl = `https://apps.pujaltefotografia.es/comuniones2026/${ev.id}/index.html?id=${ev.id}`;
        const editUrl = `creador_eventos.html?e=${ev.id}&c=${ev._col}`;

        return `
        <div class="glass p-4 rounded-3xl flex flex-col gap-4 hover:border-emerald-500/30 transition group scale-up bg-slate-900/40">
            <!-- Cuadrícula de fotos (Mini Galería) -->
            <div class="grid grid-cols-3 gap-2 h-32">
                <div class="col-span-2 h-full rounded-xl overflow-hidden bg-slate-800 border border-white/5">
                    <img src="${f1}" class="w-full h-full object-cover group-hover:scale-105 transition duration-700" onerror="this.src='assets/images/new_lobo_black.webp'">
                </div>
                <div class="grid grid-rows-2 gap-2 h-full">
                    <div class="rounded-lg overflow-hidden bg-slate-800 border border-white/5">
                        <img src="${f2}" class="w-full h-full object-cover" onerror="this.src='assets/images/new_lobo_black.webp'">
                    </div>
                    <div class="rounded-lg overflow-hidden bg-slate-800 border border-white/5">
                        <img src="${f3}" class="w-full h-full object-cover" onerror="this.src='assets/images/new_lobo_black.webp'">
                    </div>
                </div>
            </div>

            <div class="px-1">
                <h4 class="font-bold text-base leading-tight group-hover:text-emerald-400 transition truncate">${ev.protagonistName || ev.id}</h4>
                <div class="flex justify-between items-center mt-2">
                    <span class="text-[8px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md font-mono uppercase">${ev.id}</span>
                    <span class="text-[8px] text-white/30 uppercase font-bold tracking-widest">${ev.eventDate || ''}</span>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-2 mt-auto">
                <a href="${editUrl}" class="flex items-center justify-center gap-1 bg-emerald-500 hover:bg-emerald-400 text-black py-2.5 rounded-xl text-center text-[10px] font-black transition uppercase tracking-widest">
                    <span>✏️</span> Editar
                </a>
                <button onclick="generateZipDirect('${ev.id}')" class="flex items-center justify-center gap-1 bg-white/10 hover:bg-indigo-600 text-white py-2.5 rounded-xl text-center text-[10px] font-black transition uppercase tracking-widest">
                    <span>📦</span> ZIP
                </button>
                <a href="${eventUrl}" target="_blank" class="col-span-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white py-2 rounded-xl text-center text-[9px] font-bold transition uppercase tracking-[0.2em] border border-white/5 mt-1">
                    Ver Web en directo
                </a>
            </div>
        </div>`;
    }).join('');
}

window.closeEventsViewer = () => {
    document.getElementById('events-viewer-modal').classList.add('hidden');
    document.body.style.overflow = 'auto';
};

window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert("URL copiada al portapapeles ✅");
};

window.copyFormLink = (photoId) => {
    const baseUrl = window.location.href.split('super_admin.html')[0];
    const link = `${baseUrl}datos_evento.html?f=${photoId}`;
    copyToClipboard(link);
};

window.openRegistrationForm = (photoId) => {
    const baseUrl = window.location.href.split('super_admin.html')[0];
    const link = `${baseUrl}acceso_fotografo.html?f=${photoId}`;
    window.open(link, '_blank');
};

window.copyProfileLink = (photoId) => {
    const baseUrl = window.location.href.split('super_admin.html')[0];
    const link = `${baseUrl}acceso_fotografo.html?f=${photoId}`;
    copyToClipboard(link);
};

window.openMigration = async () => {
    const list = document.getElementById('unassigned-list');
    list.innerHTML = '<div class="p-10 text-center">Escaneando eventos sin organizar...</div>';
    document.getElementById('migration-modal').classList.remove('hidden');

    const collections = ['eventos', '_internal_temp', 'datos_protagonistas'];
    let html = '';
    let count = 0;

    for (const col of collections) {
        try {
            const snap = await getDocs(collection(db, col));
            snap.forEach(d => {
                const ev = d.data();
                if (!ev.photographerId || ev.photographerId === "none") {
                    count++;
                    html += `
                    <label class="flex items-center justify-between p-5 bg-slate-800/40 rounded-2xl cursor-pointer hover:bg-slate-700/50 transition border border-white/5 group">
                        <div class="flex items-center gap-4">
                            <input type="checkbox" name="event-to-tag" value="${col}:${d.id}" class="w-6 h-6 border-2 rounded-lg accent-emerald-500">
                            <div>
                                <p class="font-bold text-slate-200 group-hover:text-emerald-400 transition">${ev.protagonistName || ev.nombre || d.id}</p>
                                <div class="flex gap-2 mt-1">
                                    <span class="text-[9px] bg-slate-700 px-2 py-0.5 rounded-full text-slate-400 font-bold uppercase">${col}</span>
                                    <span class="text-[9px] text-slate-500 uppercase font-bold">${d.id}</span>
                                </div>
                            </div>
                        </div>
                        <span class="text-indigo-400 text-[10px] font-bold">SIN ASIGNAR</span>
                    </label>`;
                }
            });
        } catch (e) { }
    }
    list.innerHTML = html || '<div class="p-10 text-center opacity-50">¡Genial! Todo está organizado.</div>';
};

window.applyAssignment = async () => {
    const target = document.getElementById('select-target-photo').value;
    if (!target) return alert("Por favor, selecciona un fotógrafo de la lista.");

    const selected = document.querySelectorAll('input[name="event-to-tag"]:checked');
    if (selected.length === 0) return alert("Selecciona al menos un evento para organizar.");

    if (confirm(`Se van a marcar ${selected.length} eventos como propiedad de '${target}'. ¿Confirmar acción segura?`)) {
        for (const input of selected) {
            const [col, id] = input.value.split(':');
            await updateDoc(doc(db, col, id), {
                photographerId: target,
                organizedAt: new Date().toISOString()
            });
        }
        alert("✅ Organización completada. Los eventos cargaran la marca del fotógrafo al abrirse.");
        closeMigration();
        loadData();
    }
};

window.approvePhotographer = async (id, event) => {
    if (event) event.stopPropagation();

    if (!confirm(`¿Aprobar el registro de ${id}?\n\nSe enviará un email con las credenciales de acceso.`)) return;

    try {
        const docSnap = await getDoc(doc(db, "fotografos", id));
        if (!docSnap.exists()) {
            alert("❌ Error: Fotógrafo no encontrado");
            return;
        }

        const data = docSnap.data();

        await updateDoc(doc(db, "fotografos", id), {
            status: 'aprobado',
            approvedAt: new Date().toISOString()
        });

        // 3. Enviar email de confirmación
        await addDoc(collection(db, 'mail'), {
            to: [data.email],
            message: {
                subject: "✅ Registro Aprobado - Acceso a tu Panel Profesional",
                html: `
                    <div style="font-family: sans-serif; padding: 20px; color: #333; background-color: #f9f9f9; border-radius: 20px;">
                        <h2 style="color: #10b981;">¡Bienvenido/a, ${data.nombre_comercial}!</h2>
                        <p>Tu registro ha sido <strong>aprobado</strong>. Ya puedes acceder a tu panel profesional para gestionar tus eventos y leads.</p>
                        <div style="background: #000; color: #D4AF37; padding: 20px; border-radius: 15px; text-align: center;">
                            <h3 style="margin-top: 0; color: #D4AF37;">🔐 ACCESO AL PANEL</h3>
                            <p style="color: white; margin: 10px 0;"><strong>Usuario:</strong> <span style="color: #D4AF37;">${id}</span></p>
                            <p style="color: white; margin: 10px 0;"><strong>Contraseña:</strong> <span style="color: #D4AF37;">${(data.fiscalId || '').replace(/[^0-9]/g, '').slice(0, 8)}</span></p>
                            <p style="margin-top: 20px;"><a href="https://apps.pujaltefotografia.es/acceso_fotografo.html" style="background: #D4AF37; color: black; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">ENTRAR AL PANEL</a></p>
                        </div>
                    </div>
                `
            }
        });

        alert("✅ Fotógrafo aprobado. Se ha enviado el email con las credenciales.");
        loadData();
    } catch (e) {
        console.error(e);
        alert("❌ Error al aprobar: " + e.message);
    }
};

window.deletePhotographer = async (id) => {
    if (confirm(`¿Deseas eliminar a ${id}? Los eventos asignados a él quedarán "sueltos".`)) {
        await deleteDoc(doc(db, "fotografos", id));
        loadData();
    }
}

window.showAddModal = () => {
    document.getElementById('modal-title').innerText = "Configurar Nuevo Fotógrafo";
    document.getElementById('photo-id').disabled = false;
    document.getElementById('photo-form').reset();
    document.getElementById('modal').classList.remove('hidden');
};

window.showEditModal = async (id) => {
    const docSnap = await getDoc(doc(db, "fotografos", id));
    if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById('modal-title').innerText = "Editar Fotógrafo";
        document.getElementById('photo-id').value = id;
        document.getElementById('photo-id').disabled = true;
        document.getElementById('photo-name').value = data.nombre_comercial || data.name || "";
        document.getElementById('photo-lema').value = data.slogan || data.lema || "";
        document.getElementById('photo-insta').value = data.instagram || "";
        document.getElementById('photo-email').value = data.email || "";
        document.getElementById('photo-whatsapp').value = data.whatsapp || "";
        document.getElementById('photo-web').value = data.web || "";
        document.getElementById('photo-google-reviews').value = data.googleReviewLink || "";
        document.getElementById('photo-razon').value = data.fiscalName || "";
        document.getElementById('photo-nif').value = data.fiscalId || "";
        document.getElementById('photo-tel-fiscal').value = data.fiscalPhone || "";
        document.getElementById('photo-direccion').value = data.fiscalAddress || "";
        document.getElementById('photo-localidad').value = data.fiscalLocalidad || "";
        document.getElementById('photo-provincia').value = data.fiscalProvince || "";
        document.getElementById('photo-cp').value = data.fiscalZip || "";

        const pLogo = data.logo_url || data.logoUrl;
        if (pLogo) {
            document.getElementById('logo-preview').src = pLogo;
            document.getElementById('logo-preview-container').classList.remove('hidden');
        } else {
            document.getElementById('logo-preview-container').classList.add('hidden');
        }

        document.getElementById('modal').classList.remove('hidden');
    }
};

// Lógica de guardado del formulario
const photoForm = document.getElementById('photo-form');
if (photoForm) {
    photoForm.onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('photo-id').value;
        const file = document.getElementById('photo-file').files[0];

        const data = {
            nombre_comercial: document.getElementById('photo-name').value,
            slogan: document.getElementById('photo-lema').value,
            instagram: document.getElementById('photo-insta').value,
            email: document.getElementById('photo-email').value,
            whatsapp: document.getElementById('photo-whatsapp').value,
            web: document.getElementById('photo-web').value,
            googleReviewLink: document.getElementById('photo-google-reviews').value,
            fiscalName: document.getElementById('photo-razon').value,
            fiscalId: document.getElementById('photo-nif').value,
            fiscalPhone: document.getElementById('photo-tel-fiscal').value,
            fiscalAddress: document.getElementById('photo-direccion').value,
            fiscalLocalidad: document.getElementById('photo-localidad').value,
            fiscalProvince: document.getElementById('photo-provincia').value,
            fiscalZip: document.getElementById('photo-cp').value,
            updatedAt: new Date().toISOString()
        };

        try {
            if (file) {
                const storageRef = ref(storage, `logos/${id}_${Date.now()}`);
                const snap = await uploadBytes(storageRef, file);
                data.logo_url = await getDownloadURL(snap.ref);
            }

            await setDoc(doc(db, "fotografos", id), data, { merge: true });
            alert("✅ Cambios guardados correctamente");
            hideModal();
            loadData();
        } catch (err) {
            console.error(err);
            alert("❌ Error al guardar: " + err.message);
        }
    };
}


window.hideModal = () => document.getElementById('modal').classList.add('hidden');
window.closeMigration = () => document.getElementById('migration-modal').classList.add('hidden');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadData();
});

// Forcing early execution if possible
loadData();