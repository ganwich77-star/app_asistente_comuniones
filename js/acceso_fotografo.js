import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { config } from './config.js';

// Inicialización de Firebase
const app = initializeApp(config.firebase);
const db = getFirestore(app);
const storage = getStorage(app);

// 1. Detectar ID de la URL (?f=id)
const params = new URLSearchParams(window.location.search);
const PHOTO_ID_URL = params.get('f');

// Elementos del DOM
const form = document.getElementById('photographer-form');
const inputId = document.getElementById('photo-id');
const inputFile = document.getElementById('photo-file');
const logoPreview = document.getElementById('logo-preview');
const logoPreviewContainer = document.getElementById('logo-preview-container');
const fileLabel = document.getElementById('file-label');

// --- LÓGICA DE PANTALLA LEGAL (GATE) ---
const legalCheck = document.getElementById('legal-check');
const btnStart = document.getElementById('btn-start');
const legalGate = document.getElementById('legal-gate');

if (legalCheck && btnStart && legalGate) {
    legalCheck.addEventListener('change', () => {
        btnStart.disabled = !legalCheck.checked;
        btnStart.style.opacity = legalCheck.checked ? '1' : '0.5';
    });

    btnStart.addEventListener('click', () => {
        legalGate.style.display = 'none';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// --- AUTO-FORMATEO DEL ID (SLUG) ---
if (inputId) {
    inputId.addEventListener('input', (e) => {
        let val = e.target.value.toLowerCase();
        // Cambiar espacios por guiones bajos
        val = val.replace(/\s+/g, '_');
        // Eliminar caracteres especiales (solo dejar letras, números y guiones bajos)
        val = val.replace(/[^a-z0-9_]/g, '');
        e.target.value = val;
    });
}

// Cargar datos si existe el ID en la URL
if (PHOTO_ID_URL) {
    inputId.value = PHOTO_ID_URL;
    inputId.disabled = true; // Bloqueamos el ID si es edición
    loadPhotographerData(PHOTO_ID_URL);
}

async function loadPhotographerData(id) {
    try {
        const docRef = doc(db, "fotografos", id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const data = snap.data();
            document.getElementById('photo-name').value = data.name || '';
            document.getElementById('photo-insta').value = data.instagram || '';
            document.getElementById('photo-whatsapp').value = data.whatsapp || '';
            document.getElementById('photo-email').value = data.email || '';
            document.getElementById('photo-web').value = data.web || '';
            document.getElementById('fiscal-name').value = data.fiscalName || '';
            document.getElementById('fiscal-id').value = data.fiscalId || '';
            document.getElementById('fiscal-phone').value = data.fiscalPhone || '';
            document.getElementById('fiscal-address-detail').value = data.fiscalAddressDetail || '';
            document.getElementById('fiscal-address').value = data.fiscalAddress || '';

            if (data.logoUrl) {
                logoPreview.src = data.logoUrl;
                logoPreviewContainer.classList.remove('hidden');
            }
        }
    } catch (e) {
        console.error("Error cargando datos:", e);
    }
}

// Previsualización de logo
inputFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        fileLabel.innerText = file.name;
        const reader = new FileReader();
        reader.onload = (ev) => {
            logoPreview.src = ev.target.result;
            logoPreviewContainer.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
});

// Guardar datos
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = document.getElementById('btn-submit');
    const originalBtnHtml = btnSubmit.innerHTML;

    const id = inputId.value.toLowerCase().trim();
    if (!id) return alert("Por favor, introduce un ID válido.");

    btnSubmit.disabled = true;
    btnSubmit.innerHTML = "<span>⏳</span> Guardando cambios...";

    try {
        let logoUrl = logoPreview.src.startsWith('http') ? logoPreview.src : "";

        // Subida de logo si hay archivo nuevo
        if (inputFile.files[0]) {
            const file = inputFile.files[0];
            const storageRef = ref(storage, `fotografos/${id}/logo_${Date.now()}`);
            const snapshot = await uploadBytes(storageRef, file);
            logoUrl = await getDownloadURL(snapshot.ref);
        }

        // Formatear Web si no tiene protocolo
        let webUrl = document.getElementById('photo-web').value.trim();
        if (webUrl && !webUrl.startsWith('http')) {
            webUrl = 'https://' + webUrl;
        }

        // Datos a guardar
        const dataToSave = {
            name: document.getElementById('photo-name').value,
            logoUrl: logoUrl,
            instagram: document.getElementById('photo-insta').value,
            whatsapp: document.getElementById('photo-whatsapp').value,
            email: document.getElementById('photo-email').value,
            web: webUrl,
            fiscalName: document.getElementById('fiscal-name').value,
            fiscalId: document.getElementById('fiscal-id').value,
            fiscalPhone: document.getElementById('fiscal-phone').value,
            fiscalAddressDetail: document.getElementById('fiscal-address-detail').value,
            fiscalAddress: document.getElementById('fiscal-address').value,
            updatedAt: new Date().toISOString()
        };

        await setDoc(doc(db, "fotografos", id), dataToSave, { merge: true });

        // Enviar correos de notificación y bienvenida
        try {
            dataToSave.id = id; // Asegurar que el ID va en los datos para el email
            await fetch("mail_handler.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dataToSave)
            });
        } catch (e) {
            console.warn("Error enviando notificaciones por email:", e);
        }

        alert("✅ ¡Perfil profesional guardado con éxito!");
        if (!PHOTO_ID_URL) {
            window.location.href = `acceso_fotografo.html?f=${id}`;
        }
    } catch (error) {
        console.error("Error al guardar:", error);
        alert("❌ Error al guardar los datos.");
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalBtnHtml;
    }
});
