import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { config } from './config.js';

const app = initializeApp(config.firebase);
const db = getFirestore(app);

// 1. Cargar lista de eventos para autocompletar
async function loadEvents() {
    try {
        const querySnapshot = await getDocs(collection(db, "eventos"));
        const datalist = document.getElementById('event-list');
        if (!datalist) return;
        querySnapshot.forEach((doc) => {
            const option = document.createElement('option');
            option.value = doc.id;
            datalist.appendChild(option);
        });
    } catch (e) {
        console.warn("Fallo al cargar lista de eventos:", e);
    }
}
loadEvents();

// 2. Gestión del Input (Ahora permite GUIONES)
const input = document.getElementById('event-id');
if (input) {
    input.addEventListener('input', (e) => {
        // Permitir letras, números, guiones bajos y GUIONES medios
        let val = e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '');
        e.target.value = val;
    });

    // Soporte tecla Enter
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') window.goToApp();
    });
}

// 3. Capturar ID de la URL si existe (?id=xxx)
const urlParams = new URLSearchParams(window.location.search);
const urlId = urlParams.get('id');
if (urlId && input) {
    input.value = urlId;
}

// 4. Navegación
window.goToApp = function () {
    const id = input ? input.value.trim() : "";
    if (!id) return alert("Por favor, introduce un código de evento.");
    window.location.href = `../index.html?id=${id}`;
}
