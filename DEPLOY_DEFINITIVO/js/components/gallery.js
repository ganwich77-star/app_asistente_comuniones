import { collection, onSnapshot, doc, getDoc, addDoc, getDocs, runTransaction, deleteField } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/**
 * Módulo de Galería y Visor de Fotos
 * Estándares Senior Fullstack - Bloques <150 líneas
 */

let listenerUnsubscribe = null;
let currentPhotoId = null;

export const initGallery = (db, storage, EVENT_ID, config) => {

    window.loadGallery = () => {
        if (listenerUnsubscribe) listenerUnsubscribe();
        if (!EVENT_ID) return;

        const track = document.getElementById('slider-track') || document.getElementById('gallery-container');
        if (!track) return;

        listenerUnsubscribe = onSnapshot(collection(db, 'eventos', EVENT_ID, 'recuerdos'), (snap) => {
            const photos = [];
            snap.forEach(d => photos.push({ id: d.id, ...d.data() }));
            photos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
            renderGallery(photos, track);
        });
    };

    const renderGallery = (photos, container) => {
        container.innerHTML = photos.map(p => `
            <div class="gallery-item group relative aspect-square overflow-hidden rounded-2xl bg-gray-200 cursor-pointer" 
                 onclick="${window.isAdminMode ? `window.togglePhotoSelection(this, '${p.id}')` : `window.zoomPhoto('${p.url}', '${p.id}')`}">
                <img src="${p.url}" class="h-full w-full object-cover transition-transform group-hover:scale-105">
                ${(p.comments?.length || p.comment) ? '<span class="absolute top-2 right-2 drop-shadow-md">💬</span>' : ''}
                ${window.isAdminMode ? '<div class="absolute inset-0 bg-red-500/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><span class="text-white text-3xl">🗑️</span></div>' : ''}
            </div>
        `).join('');
    };

    window.zoomPhoto = async (src, photoId) => {
        currentPhotoId = photoId;
        const lightbox = document.getElementById('lightbox');
        const img = document.getElementById('lightbox-img');
        if (!lightbox || !img) return;

        img.src = src;
        lightbox.style.display = 'flex';

        if (photoId) {
            loadComments(photoId);
        }
    };

    const loadComments = async (id) => {
        const list = document.getElementById('lightbox-comments-list');
        if (!list) return;
        list.innerHTML = "<p class='text-center opacity-50'>Cargando...</p>";

        const snap = await getDoc(doc(db, 'eventos', EVENT_ID, 'recuerdos', id));
        if (!snap.exists()) return;

        const data = snap.data();
        let comments = data.comments || [];
        if (data.comment && !comments.includes(data.comment)) comments.push(data.comment);

        list.innerHTML = comments.length
            ? comments.map(c => `<div class="bg-white/5 p-2 rounded-lg text-sm mb-2 border border-white/10">${c}</div>`).join('')
            : "<p class='text-center opacity-30 italic'>Sin comentarios.</p>";
    };

    window.savePhotoComment = async () => {
        if (!currentPhotoId) return;
        const input = document.getElementById('lightbox-comment-input');
        const text = input?.value.trim();
        if (!text) return;

        try {
            await runTransaction(db, async (t) => {
                const ref = doc(db, 'eventos', EVENT_ID, 'recuerdos', currentPhotoId);
                const d = await t.get(ref);
                let arr = d.data().comments || [];
                arr.push(text);
                t.update(ref, { comments: arr, comment: deleteField() });
            });
            input.value = "";
            loadComments(currentPhotoId);
            window.showAppToast("Comentario guardado", "✅");
        } catch (e) {
            window.showCustomAlert("Error al guardar.", "❌");
        }
    };

    window.closeLightbox = () => {
        const lightbox = document.getElementById('lightbox');
        if (lightbox) lightbox.style.display = 'none';
        currentPhotoId = null;
    };

    console.log("📸 Galería y Lightbox inicializados");
};
