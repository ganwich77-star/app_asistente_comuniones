// --- INICIALIZACIÓN DE FIREBASE CENTRALIZADA (Fix Circular Dependency) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { config } from './config.js';

const app = initializeApp(config.firebase);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
