import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, doc, setDoc, runTransaction, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { config } from './config.js';

// --- INICIALIZACIÓN DE FIREBASE ---
let db;
let storage;
try {
    const app = initializeApp(config.firebase);
    db = getFirestore(app);
    storage = getStorage(app);
    console.log("Firebase inicializado correctamente.");
} catch (e) {
    console.error("Error inicializando Firebase:", e);
}

// --- VARIABLES GLOBALES ---
const urlParams = new URLSearchParams(window.location.search);
const PHOTOGRAPHER_ID = urlParams.get('f') || 'pujaltefotografia';

let cropper;
let currentUploadIndex;
let uploadedImages = { foto1: null, foto2: null, foto3: null };
let activeUploads = 0;

const cropperModal = document.getElementById('cropper-modal');
const cropperImage = document.getElementById('cropper-image');
const cropBtn = document.getElementById('crop-btn');

// --- PANTALLA LEGAL (GATE) ---
const legalCheck = document.getElementById('legal-check');
const btnStart = document.getElementById('btn-start');
const legalGate = document.getElementById('legal-gate');
const mainForm = document.getElementById('mainForm');

if (legalCheck && btnStart && legalGate) {
    legalCheck.addEventListener('change', () => {
        btnStart.disabled = !legalCheck.checked;
        btnStart.style.opacity = legalCheck.checked ? '1' : '0.3';
    });

    btnStart.addEventListener('click', () => {
        legalGate.style.display = 'none';
        mainForm.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// --- PREVISUALIZACIÓN Y CORTES ---
window.handleImageUpload = (event, index) => {
    const file = event.target.files[0];
    if (!file) return;

    currentUploadIndex = index;
    const reader = new FileReader();
    reader.onload = (e) => {
        cropperImage.src = e.target.result;
        cropperModal.style.display = 'flex';
        if (cropper) cropper.destroy();
        cropper = new Cropper(cropperImage, {
            aspectRatio: 1 / 1,
            viewMode: 1,
            autoCropArea: 0.9,
        });
    };
    reader.readAsDataURL(file);
    event.target.value = '';
};

if (cropBtn) {
    cropBtn.addEventListener('click', () => {
        if (!cropper) return;
        cropper.getCroppedCanvas({ width: 800, height: 800 }).toBlob((blob) => {
            const previewUrl = URL.createObjectURL(blob);
            const uploadBox = document.getElementById(`upload-box-${currentUploadIndex}`);
            uploadBox.style.backgroundImage = `url(${previewUrl})`;
            uploadBox.style.backgroundSize = 'cover';
            uploadBox.querySelector('.upload-prompt').style.display = 'none';
            uploadImage(blob, currentUploadIndex);
            cropperModal.style.display = 'none';
            cropper.destroy();
        }, 'image/jpeg', 0.9);
    });
}

async function uploadImage(fileOrBlob, index) {
    activeUploads++;
    const submitBtn = document.querySelector('.btn-submit');
    if (submitBtn) submitBtn.disabled = true;

    const prompt = document.querySelector(`#upload-box-${index} .upload-prompt`);
    const originalText = prompt.innerHTML;
    prompt.style.display = 'flex';
    prompt.innerHTML = '<span>⏳</span>';

    try {
        const fileName = `intro_fotos/${Date.now()}_${index}.jpg`;
        const storageRef = ref(storage, fileName);
        const snapshot = await uploadBytes(storageRef, fileOrBlob);
        const url = await getDownloadURL(snapshot.ref);
        uploadedImages[`foto${index}`] = url;
        prompt.innerHTML = '<span>✅</span>';
    } catch (e) {
        console.error(e);
        alert("Error al subir la imagen.");
        prompt.innerHTML = originalText;
    } finally {
        activeUploads--;
        if (activeUploads === 0 && submitBtn) submitBtn.disabled = false;
    }
}

// --- ENVÍO DE DATOS ---
window.togglePolicy = (e) => {
    e.preventDefault();
    document.getElementById('policy-content').classList.toggle('open');
};

window.send = async function () {
    const form = document.getElementById('mainForm');
    const errEl = document.getElementById('err');
    const btn = document.querySelector('button.btn-submit');

    if (!form.checkValidity() || !uploadedImages.foto1 || !uploadedImages.foto2 || !uploadedImages.foto3) {
        errEl.style.display = 'block';
        if (!uploadedImages.foto1 || !uploadedImages.foto2 || !uploadedImages.foto3) {
            errEl.innerText = "⚠️ Por favor, sube las 3 fotos obligatorias.";
        }
        return;
    }

    errEl.style.display = 'none';
    btn.innerText = 'Enviando...';
    btn.disabled = true;

    const data = {
        protagonistName: document.getElementById('n').value,
        protagonistLastName: document.getElementById('ln').value,
        photographerId: PHOTOGRAPHER_ID,
        parentName: document.getElementById('parentName').value,
        parentDNI: document.getElementById('parentDNI').value,
        parentPhone: document.getElementById('parentPhone').value,
        eventDate: document.getElementById('f').value,
        ceremony: {
            place: document.getElementById('cl').value,
            time: document.getElementById('ch').value,
            location: document.getElementById('clo').value
        },
        banquet: {
            place: document.getElementById('bl').value,
            time: document.getElementById('bh').value,
            location: document.getElementById('blo').value
        },
        introPhotos: [uploadedImages.foto1, uploadedImages.foto2, uploadedImages.foto3],
        createdAt: new Date().toISOString(),
        status: 'nuevo'
    };

    try {
        const docId = `${data.protagonistName.toLowerCase()}_${data.protagonistLastName.toLowerCase()}`.replace(/\s+/g, '_');
        await setDoc(doc(db, "datos_protagonistas", docId), data);

        // Final
        document.body.innerHTML = `
            <div style="height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; background:#111827; color:white; font-family:sans-serif; padding:20px;">
                <span style="font-size:5rem;">✅</span>
                <h1 style="font-size:2rem; margin:20px 0;">¡Datos enviados!</h1>
                <p style="opacity:0.7;">Gracias por completar la información. Ya puedes cerrar esta ventana.</p>
            </div>
        `;
    } catch (e) {
        console.error(e);
        alert("Error al guardar los datos.");
        btn.innerText = 'Reintentar';
        btn.disabled = false;
    }
};
